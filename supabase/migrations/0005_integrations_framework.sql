-- =============================================================================
-- 0005_integrations_framework.sql — Stage 4: dynamic, GUI-configured providers
--
-- Extends the Stage-2 integration stub (integration_providers /
-- integration_credentials) into the full framework:
--   * catalogue rows carry a JSON Schema (config_schema) that the admin GUI
--     auto-renders into a credential form (x-secret fields → Vault, others →
--     integration_credentials.config)
--   * credentials are Vault-encrypted, replace-only, audit-logged, with at
--     most ONE active credential per (org × building-scope × category)
--   * notification_log records which provider handled every send
--   * SECURITY DEFINER RPCs keep the database the authority: save / activate /
--     deactivate for org admins, secret reveal for service_role ONLY
--
-- Idempotent: safe to re-run. Runs on Supabase (real Vault) and on the local
-- PG16 mirror (vault shim from tests/local_prelude.sql).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Vault must exist (Supabase: supabase_vault extension; local: prelude shim)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_namespace where nspname = 'vault') then
    begin
      create extension if not exists supabase_vault;
    exception when others then
      raise exception using message =
        'Supabase Vault is unavailable. Enable the "supabase_vault" extension '
        || '(Dashboard -> Database -> Extensions) and re-run this script.';
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Catalogue: new columns + JSON Schema per brand
-- ---------------------------------------------------------------------------
alter table public.integration_providers
  add column if not exists slug     text,
  add column if not exists docs_url text,
  add column if not exists sort     int not null default 100;

update public.integration_providers set slug = lower(replace(brand, ' ', '-'))
where slug is null;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conname = 'integration_providers_slug_key') then
    alter table public.integration_providers
      add constraint integration_providers_slug_key unique (slug);
  end if;
end $$;

-- Catalogue upsert. jsonb does NOT preserve key order, so each schema carries
-- an explicit x-field-order the form renderer follows. x-secret fields are
-- vaulted and never returned to the client after save; the rest live in
-- integration_credentials.config. x-mask names the field whose last 4 chars
-- become the masked display string.
insert into public.integration_providers
  (category, brand, slug, capabilities, docs_url, sort, active, config_schema)
values
  ('email', 'Resend', 'resend',
   '["send","sendTemplate","verifyCredentials"]',
   'https://resend.com/docs/api-reference/emails/send-email', 10, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "Resend", "type": "object",
     "required": ["apiKey", "fromEmail"],
     "x-field-order": ["apiKey", "fromEmail", "fromName"],
     "x-mask": "apiKey",
     "properties": {
       "apiKey":   {"type": "string", "title": "API key", "pattern": "^re_",
                    "description": "Starts with re_ — Resend dashboard, API Keys.",
                    "x-secret": true},
       "fromEmail": {"type": "string", "title": "From address", "format": "email",
                    "description": "Must belong to a domain verified in Resend."},
       "fromName": {"type": "string", "title": "From name"}
     }
   }'),
  ('email', 'Postmark', 'postmark',
   '["send","sendTemplate","verifyCredentials"]',
   'https://postmarkapp.com/developer/api/email-api', 20, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "Postmark", "type": "object",
     "required": ["serverToken", "fromEmail"],
     "x-field-order": ["serverToken", "fromEmail", "messageStream"],
     "x-mask": "serverToken",
     "properties": {
       "serverToken":  {"type": "string", "title": "Server API token",
                        "description": "Postmark server -> API Tokens.",
                        "x-secret": true},
       "fromEmail":    {"type": "string", "title": "From address", "format": "email",
                        "description": "A confirmed Sender Signature or verified domain."},
       "messageStream": {"type": "string", "title": "Message stream",
                        "default": "outbound",
                        "description": "Transactional stream id (default: outbound)."}
     }
   }'),
  ('email', 'SendGrid', 'sendgrid',
   '["send","sendTemplate","verifyCredentials"]',
   'https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send', 30, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "SendGrid", "type": "object",
     "required": ["apiKey", "fromEmail"],
     "x-field-order": ["apiKey", "fromEmail", "fromName"],
     "x-mask": "apiKey",
     "properties": {
       "apiKey":   {"type": "string", "title": "API key", "pattern": "^SG\\.",
                    "description": "Starts with SG. — needs the mail.send scope.",
                    "x-secret": true},
       "fromEmail": {"type": "string", "title": "From address", "format": "email",
                    "description": "A verified sender identity or authenticated domain."},
       "fromName": {"type": "string", "title": "From name"}
     }
   }'),
  ('email', 'AWS SES', 'aws-ses',
   '["send","verifyCredentials"]',
   'https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html', 40, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "AWS SES", "type": "object",
     "required": ["accessKeyId", "secretAccessKey", "region", "fromEmail"],
     "x-field-order": ["accessKeyId", "secretAccessKey", "region", "fromEmail"],
     "x-mask": "secretAccessKey",
     "properties": {
       "accessKeyId":     {"type": "string", "title": "Access key ID",
                           "description": "IAM user with ses:SendEmail + ses:GetAccount."},
       "secretAccessKey": {"type": "string", "title": "Secret access key",
                           "x-secret": true},
       "region":          {"type": "string", "title": "Region",
                           "default": "ap-southeast-2",
                           "enum": ["ap-southeast-2", "ap-southeast-1", "us-east-1",
                                    "us-west-2", "eu-west-1", "eu-central-1"],
                           "description": "SES v2 endpoint region (Sydney default)."},
       "fromEmail":       {"type": "string", "title": "From address", "format": "email",
                           "description": "A verified SES identity."}
     }
   }'),
  ('sms', 'Twilio', 'twilio',
   '["send","verifyCredentials","deliveryStatus","whatsapp"]',
   'https://www.twilio.com/docs/messaging/api/message-resource', 10, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "Twilio", "type": "object",
     "required": ["accountSid", "authToken", "from"],
     "x-field-order": ["accountSid", "authToken", "from"],
     "x-mask": "authToken",
     "properties": {
       "accountSid": {"type": "string", "title": "Account SID", "pattern": "^AC",
                      "description": "Starts with AC — Twilio Console home."},
       "authToken":  {"type": "string", "title": "Auth token", "x-secret": true},
       "from":       {"type": "string", "title": "From number / Messaging Service SID",
                      "description": "E.164 number (+61...), alphanumeric sender ID, or MG... service SID."}
     }
   }'),
  ('sms', 'MessageMedia', 'messagemedia',
   '["send","verifyCredentials","deliveryStatus"]',
   'https://messagemedia.github.io/documentation/', 20, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "MessageMedia", "type": "object",
     "required": ["apiKey", "apiSecret"],
     "x-field-order": ["apiKey", "apiSecret", "from"],
     "x-mask": "apiSecret",
     "properties": {
       "apiKey":    {"type": "string", "title": "API key",
                     "description": "MessageMedia Hub -> Configuration -> API Settings."},
       "apiSecret": {"type": "string", "title": "API secret", "x-secret": true},
       "from":      {"type": "string", "title": "Sender ID (optional)",
                     "description": "Alphanumeric sender or dedicated AU number; leave blank for shared."}
     }
   }'),
  ('sms', 'ClickSend', 'clicksend',
   '["send","verifyCredentials","deliveryStatus"]',
   'https://developers.clicksend.com/docs/messaging/sms/', 30, true,
   '{
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "title": "ClickSend", "type": "object",
     "required": ["username", "apiKey"],
     "x-field-order": ["username", "apiKey", "from"],
     "x-mask": "apiKey",
     "properties": {
       "username": {"type": "string", "title": "Username",
                    "description": "ClickSend dashboard username (API subaccount supported)."},
       "apiKey":   {"type": "string", "title": "API key", "x-secret": true},
       "from":     {"type": "string", "title": "Sender ID (optional)",
                    "description": "Alphanumeric sender or dedicated AU number; leave blank for shared."}
     }
   }')
on conflict (category, brand) do update set
  slug          = excluded.slug,
  capabilities  = excluded.capabilities,
  docs_url      = excluded.docs_url,
  sort          = excluded.sort,
  active        = excluded.active,
  config_schema = excluded.config_schema;

-- ---------------------------------------------------------------------------
-- 2. Credentials: framework columns, immutability guard, one-active rule
-- ---------------------------------------------------------------------------
alter table public.integration_credentials
  add column if not exists category      text,
  add column if not exists config        jsonb not null default '{}'::jsonb,
  add column if not exists last_test_at  timestamptz,
  add column if not exists last_test_ok  boolean,
  add column if not exists last_test_note text,
  add column if not exists activated_at  timestamptz,
  add column if not exists updated_at    timestamptz not null default now(),
  add column if not exists replaces      uuid references public.integration_credentials(id);

update public.integration_credentials c
set category = p.category
from public.integration_providers p
where p.id = c.provider_id and c.category is null;

alter table public.integration_credentials alter column category set not null;
-- new saves start inactive; activation is an explicit, audited step
alter table public.integration_credentials alter column active set default false;

-- category always mirrors the provider; updated_at maintained here too
create or replace function app.integration_credentials_fill()
returns trigger language plpgsql as $$
begin
  select p.category into new.category
  from public.integration_providers p where p.id = new.provider_id;
  if new.category is null then
    raise exception 'unknown integration provider %', new.provider_id;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists integration_credentials_fill on public.integration_credentials;
create trigger integration_credentials_fill
  before insert or update on public.integration_credentials
  for each row execute function app.integration_credentials_fill();

-- Replace-only at the DB level: the identity of a credential (who it belongs
-- to, which provider, which vault secret) is immutable after insert. Editing
-- credentials = saving a NEW row that `replaces` the old one.
create or replace function app.integration_credentials_guard()
returns trigger language plpgsql as $$
begin
  if new.org_id      is distinct from old.org_id
  or new.building_id is distinct from old.building_id
  or new.provider_id is distinct from old.provider_id
  or new.secret_ref  is distinct from old.secret_ref
  or new.replaces    is distinct from old.replaces then
    raise exception 'integration credentials are replace-only: save a new credential instead';
  end if;
  return new;
end $$;

drop trigger if exists integration_credentials_guard on public.integration_credentials;
create trigger integration_credentials_guard
  before update on public.integration_credentials
  for each row execute function app.integration_credentials_guard();

-- at most one ACTIVE credential per org × building-scope × category
create unique index if not exists integration_credentials_one_active_idx
  on public.integration_credentials
     (org_id, coalesce(building_id, '00000000-0000-0000-0000-000000000000'::uuid), category)
  where active;

create index if not exists integration_credentials_org_idx
  on public.integration_credentials (org_id, category, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Audit trigger — every credential change lands in audit_logs
-- ---------------------------------------------------------------------------
create or replace function app.audit_integration_credentials()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_action text;
  v_row public.integration_credentials;
begin
  v_row := coalesce(new, old);
  v_action := case
    when tg_op = 'INSERT' then 'integration.credential.saved'
    when tg_op = 'DELETE' then 'integration.credential.deleted'
    when old.active = false and new.active = true  then 'integration.credential.activated'
    when old.active = true  and new.active = false then 'integration.credential.deactivated'
    else 'integration.credential.updated'
  end;
  insert into public.audit_logs (org_id, building_id, actor_id, action, entity, entity_id, payload)
  select v_row.org_id, v_row.building_id, auth.uid(), v_action,
         'integration_credentials', v_row.id::text,
         jsonb_build_object(
           'brand', p.brand, 'category', p.category, 'label', v_row.label,
           'masked', v_row.masked, 'replaces', v_row.replaces,
           'last_test_ok', v_row.last_test_ok)
  from public.integration_providers p where p.id = v_row.provider_id;
  return coalesce(new, old);
end $$;

drop trigger if exists integration_credentials_audit on public.integration_credentials;
create trigger integration_credentials_audit
  after insert or update or delete on public.integration_credentials
  for each row execute function app.audit_integration_credentials();

-- ---------------------------------------------------------------------------
-- 4. notification_log — which provider handled every send
-- ---------------------------------------------------------------------------
create table if not exists public.notification_log (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  channel             text not null check (channel in ('email','sms')),
  provider_brand      text not null,
  credential_id       uuid references public.integration_credentials(id) on delete set null,
  recipient           text not null,           -- stored MASKED (j***@e***.com / +61•••321)
  subject             text,
  status              text not null check (status in ('sent','failed')),
  is_test             boolean not null default false,
  provider_message_id text,
  error               text,
  created_by          uuid references public.users(id),
  created_at          timestamptz not null default now()
);
create index if not exists notification_log_org_idx
  on public.notification_log (org_id, created_at desc);

alter table public.notification_log enable row level security;

-- reads: org managers/admins (same bar as audit_read); writes: service_role
-- only (bypasses RLS — deliberately NO insert/update/delete policies here)
drop policy if exists notification_log_read on public.notification_log;
create policy notification_log_read on public.notification_log for select
  using (app.can(auth.uid(), org_id, null, null, 'manage'));

revoke all on public.notification_log from anon;
grant select on public.notification_log to authenticated;
grant all on public.notification_log to service_role;

-- ---------------------------------------------------------------------------
-- 5. RPCs — the ONLY paths that touch Vault
-- ---------------------------------------------------------------------------

-- Save a credential set: non-secret fields -> config, secrets -> Vault.
-- Starts INACTIVE; activation is a separate, gated, audited step.
create or replace function public.integration_credential_save(
  p_provider  uuid,
  p_org       uuid,
  p_building  uuid default null,
  p_label     text default '',
  p_config    jsonb default '{}'::jsonb,
  p_secrets   jsonb default '{}'::jsonb,
  p_masked    text default null,
  p_test_ok   boolean default null,
  p_test_note text default null,
  p_replaces  uuid default null
) returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_id     uuid := gen_random_uuid();
  v_ref    uuid;
  v_brand  text;
  v_mask_field text;
  v_mask   text;
begin
  if not app.can(auth.uid(), p_org, null, null, 'admin') then
    raise exception 'not authorised to manage integrations for this organisation';
  end if;
  select brand, config_schema ->> 'x-mask' into v_brand, v_mask_field
  from public.integration_providers where id = p_provider and active;
  if v_brand is null then
    raise exception 'unknown or inactive integration provider';
  end if;
  if p_secrets = '{}'::jsonb then
    raise exception 'credential secrets missing';
  end if;
  if p_replaces is not null and not exists (
    select 1 from public.integration_credentials
    where id = p_replaces and org_id = p_org) then
    raise exception 'replaced credential not found in this organisation';
  end if;

  v_mask := coalesce(nullif(p_masked, ''),
    case when v_mask_field is not null and p_secrets ? v_mask_field
         then '•••• ' || right(p_secrets ->> v_mask_field, 4)
         else '•••• ••••' end);

  v_ref := vault.create_secret(p_secrets::text, 'integration_credential:' || v_id::text);

  insert into public.integration_credentials
    (id, org_id, building_id, provider_id, label, secret_ref, masked, config,
     active, last_test_at, last_test_ok, last_test_note, replaces, created_by)
  values
    (v_id, p_org, p_building, p_provider, coalesce(nullif(p_label, ''), v_brand),
     v_ref::text, v_mask, coalesce(p_config, '{}'::jsonb),
     false, case when p_test_ok is null then null else now() end,
     p_test_ok, p_test_note, p_replaces, auth.uid());
  return v_id;
end $$;

-- Activate: requires a passing connection test; deactivates (keeps) the
-- previously active credential for the same scope + category.
create or replace function public.integration_credential_activate(p_id uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
declare v_row public.integration_credentials;
begin
  select * into v_row from public.integration_credentials where id = p_id;
  if v_row.id is null then raise exception 'credential not found'; end if;
  if not app.can(auth.uid(), v_row.org_id, null, null, 'admin') then
    raise exception 'not authorised to manage integrations for this organisation';
  end if;
  if v_row.active then return; end if;
  if v_row.last_test_ok is distinct from true then
    raise exception 'test the connection before activating this credential';
  end if;
  update public.integration_credentials
  set active = false
  where org_id = v_row.org_id
    and category = v_row.category
    and coalesce(building_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_row.building_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and active;
  update public.integration_credentials
  set active = true, activated_at = now()
  where id = p_id;
end $$;

create or replace function public.integration_credential_deactivate(p_id uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid;
begin
  select org_id into v_org from public.integration_credentials where id = p_id;
  if v_org is null then raise exception 'credential not found'; end if;
  if not app.can(auth.uid(), v_org, null, null, 'admin') then
    raise exception 'not authorised to manage integrations for this organisation';
  end if;
  update public.integration_credentials set active = false where id = p_id and active;
end $$;

-- Server-side test runs (API route with the service key) stamp results here.
create or replace function public.integration_credential_record_test(
  p_id uuid, p_ok boolean, p_note text default null
) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  update public.integration_credentials
  set last_test_at = now(), last_test_ok = p_ok, last_test_note = p_note
  where id = p_id;
  if not found then raise exception 'credential not found'; end if;
end $$;

-- Decrypted secrets: service_role ONLY. The client never sees these again.
create or replace function public.integration_secret_reveal(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_ref uuid; v_secret text;
begin
  select secret_ref::uuid into v_ref
  from public.integration_credentials where id = p_id;
  if v_ref is null then raise exception 'credential not found'; end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where id = v_ref;
  if v_secret is null then raise exception 'vault secret missing for credential %', p_id; end if;
  return v_secret::jsonb;
end $$;

-- lock the RPC surface down
revoke all on function public.integration_credential_save(uuid, uuid, uuid, text, jsonb, jsonb, text, boolean, text, uuid) from public, anon;
grant execute on function public.integration_credential_save(uuid, uuid, uuid, text, jsonb, jsonb, text, boolean, text, uuid) to authenticated, service_role;

revoke all on function public.integration_credential_activate(uuid) from public, anon;
grant execute on function public.integration_credential_activate(uuid) to authenticated, service_role;

revoke all on function public.integration_credential_deactivate(uuid) from public, anon;
grant execute on function public.integration_credential_deactivate(uuid) to authenticated, service_role;

revoke all on function public.integration_credential_record_test(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.integration_credential_record_test(uuid, boolean, text) to service_role;

revoke all on function public.integration_secret_reveal(uuid) from public, anon, authenticated;
grant execute on function public.integration_secret_reveal(uuid) to service_role;
