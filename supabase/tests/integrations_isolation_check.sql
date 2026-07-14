-- =============================================================================
-- integrations_isolation_check.sql — Stage 4 acceptance tests as plain SQL.
-- Runs on local Postgres (after tests/local_prelude.sql + migrations + seed)
-- AND in the Supabase SQL editor after APPLY_STAGE4_INTEGRATIONS.sql.
-- Every assertion raises on violation; expect 19 ok-notices. Rolls back —
-- no probe data persists.
-- =============================================================================
begin;

create or replace function pg_temp.become(user_email text) returns void
language plpgsql security definer as $$
declare uid uuid;
begin
  select id into uid from public.users where email = user_email;
  if uid is null then raise exception 'seed user % missing', user_email; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.assert(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ISOLATION FAIL: %', label; end if;
  raise notice 'ok: %', label;
end $$;

create or replace function pg_temp.assert_fails(stmt text, label text) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok: %', label;
    return;
  end;
  raise exception 'ISOLATION FAIL (expected an error): %', label;
end $$;

-- Probe holders created UP FRONT by the applying role (postgres) — creating
-- temp tables later, while running AS authenticated, is refused on hosted
-- Supabase projects even though plain local Postgres allows it.
create temp table probe  (cred_id uuid);
create temp table probe2 (cred_id uuid);
grant all on probe, probe2 to public;

-- ---- catalogue ---------------------------------------------------------------
set local role authenticated;
select pg_temp.become('sandra@meridian.demo');

select pg_temp.assert(
  (select count(*) from public.integration_providers
   where active and config_schema ? 'properties' and config_schema ? 'x-mask') = 7,
  'catalogue: 7 active brands, each with a JSON Schema + mask field');

-- anon must see nothing: either zero rows (RLS) or no table grant at all
-- (0003 hardening) — both are a pass.
create or replace function pg_temp.anon_visible_providers() returns int
language plpgsql as $$
declare n int;
begin
  begin
    select count(*)::int into n from public.integration_providers;
  exception when insufficient_privilege then n := 0;
  end;
  return n;
end $$;
set local role anon;
select pg_temp.assert(pg_temp.anon_visible_providers() = 0,
  'anon sees an EMPTY integrations catalogue');
set local role authenticated;

-- ---- save (org admin, secrets -> vault) --------------------------------------
select pg_temp.become('sandra@meridian.demo');

insert into probe
select public.integration_credential_save(
  p_provider => (select id from public.integration_providers where slug = 'resend'),
  p_org      => (select id from public.organisations where slug = 'meridian-strata'),
  p_label    => 'Meridian email',
  p_config   => '{"fromEmail":"ops@meridian.demo"}',
  p_secrets  => '{"apiKey":"re_PROBE_SECRET_1234"}'
);

select pg_temp.assert(
  (select count(*) from public.integration_credentials c join probe on c.id = probe.cred_id
    where c.active = false and c.masked = '•••• 1234' and c.category = 'email') = 1,
  'org admin saves a credential: starts INACTIVE, masked to last 4');

select pg_temp.assert(
  not exists (select 1 from public.integration_credentials
              where masked like '%re_PROBE%' or label like '%re_PROBE%'
                 or config::text like '%re_PROBE%' or secret_ref like '%re_PROBE%'),
  'plaintext secret appears NOWHERE in integration_credentials');

select pg_temp.assert_fails(
  'select public.integration_credential_activate((select cred_id from probe))',
  'activation is REFUSED before a passing connection test');

select pg_temp.assert_fails(
  'select public.integration_credential_record_test((select cred_id from probe), true)',
  'authenticated users cannot stamp test results (service_role only)');

select pg_temp.assert_fails(
  'select public.integration_secret_reveal((select cred_id from probe))',
  'authenticated users can NEVER read secrets back');

select pg_temp.assert_fails(
  'select * from vault.decrypted_secrets',
  'authenticated users cannot touch the vault directly');

select pg_temp.assert_fails(
  'update public.integration_credentials set secret_ref = gen_random_uuid()::text
   where id = (select cred_id from probe)',
  'credentials are replace-only: secret_ref is immutable');

-- ---- server-side test stamp + activation --------------------------------------
set local role service_role;
select public.integration_credential_record_test((select cred_id from probe), true, 'probe: verified');
select pg_temp.assert(
  (select decrypted->>'apiKey' from (
     select public.integration_secret_reveal((select cred_id from probe)) as decrypted) s
  ) = 're_PROBE_SECRET_1234',
  'service_role (and ONLY service_role) can reveal the secret for sending');
set local role authenticated;

select pg_temp.become('sandra@meridian.demo');
select public.integration_credential_activate((select cred_id from probe));
select pg_temp.assert(
  (select active and activated_at is not null from public.integration_credentials
   where id = (select cred_id from probe)),
  'tested credential activates');

-- ---- provider switch: old credential kept inactive ----------------------------
insert into probe2
select public.integration_credential_save(
  p_provider => (select id from public.integration_providers where slug = 'postmark'),
  p_org      => (select id from public.organisations where slug = 'meridian-strata'),
  p_label    => 'Meridian email (Postmark)',
  p_config   => '{"fromEmail":"ops@meridian.demo","messageStream":"outbound"}',
  p_secrets  => '{"serverToken":"pm-probe-token-9876"}',
  p_replaces => (select cred_id from probe)
);

set local role service_role;
select public.integration_credential_record_test((select cred_id from probe2), true);
set local role authenticated;
select pg_temp.become('sandra@meridian.demo');
select public.integration_credential_activate((select cred_id from probe2));

select pg_temp.assert(
  (select count(*) filter (where active) from public.integration_credentials
   where org_id = (select id from public.organisations where slug = 'meridian-strata')
     and category = 'email') = 1
  and (select active from public.integration_credentials where id = (select cred_id from probe)) = false
  and exists (select 1 from public.integration_credentials where id = (select cred_id from probe)),
  'provider switch: exactly ONE active email credential; old one kept inactive');

select pg_temp.assert(
  (select count(*) from public.audit_logs
   where entity = 'integration_credentials'
     and action in ('integration.credential.saved', 'integration.credential.activated',
                    'integration.credential.deactivated')) >= 5,
  'every save / activate / deactivate is audit-logged');

-- ---- isolation: other orgs and non-admins -------------------------------------
select pg_temp.become('priya@foct.demo'); -- manager, NOT org_admin
select pg_temp.assert_fails(
  $q$select public.integration_credential_save(
      p_provider => (select id from public.integration_providers where slug = 'resend'),
      p_org      => (select id from public.organisations where slug = 'foct-cleaning'),
      p_secrets  => '{"apiKey":"re_nope"}')$q$,
  'a manager (non-admin) cannot save credentials');

select pg_temp.become('ben@brightspark.demo'); -- org_admin of ANOTHER org
select pg_temp.assert(
  (select count(*) from public.integration_credentials
   where org_id = (select id from public.organisations where slug = 'meridian-strata')) = 0,
  'another org''s admin sees NONE of Meridian''s credentials');

select pg_temp.assert_fails(
  'select public.integration_credential_activate((select cred_id from probe))',
  'another org''s admin cannot activate Meridian''s credential');

-- ---- notification_log ----------------------------------------------------------
select pg_temp.become('sandra@meridian.demo');
select pg_temp.assert_fails(
  $q$insert into public.notification_log (org_id, channel, provider_brand, recipient, status)
     values ((select id from public.organisations where slug = 'meridian-strata'),
             'email', 'Resend', 's***@m***.demo', 'sent')$q$,
  'clients cannot write the notification log (service_role only)');

set local role service_role;
insert into public.notification_log (org_id, channel, provider_brand, credential_id, recipient, subject, status, is_test)
values ((select id from public.organisations where slug = 'meridian-strata'),
        'email', 'Postmark', (select cred_id from probe2), 's***@m***.demo', 'Test email', 'sent', true);
set local role authenticated;

select pg_temp.become('sandra@meridian.demo');
select pg_temp.assert(
  (select count(*) from public.notification_log where provider_brand = 'Postmark') = 1,
  'org admin reads own org''s send log (provider recorded per send)');

select pg_temp.become('ben@brightspark.demo');
select pg_temp.assert(
  (select count(*) from public.notification_log) = 0,
  'another org sees NONE of Meridian''s send log');

rollback;
