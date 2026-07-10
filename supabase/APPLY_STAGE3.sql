-- =============================================================================
-- APPLY_STAGE3.sql — GENERATED one-paste apply (Service Desk backend).
-- = migrations/0002_service_desk.sql + 0003_anon_hardening.sql + seed_service_desk.sql
-- Prereq: APPLY_STAGE2.sql. Idempotent (verified by double-run) — safe to re-run.
-- After applying, paste tests/sd_isolation_check.sql — expect 15 'ok' notices.
-- =============================================================================

-- =============================================================================
-- 0002_service_desk.sql — Service Desk backend (Stage 3)
-- Schema per docs/modules/SERVICE_DESK_PRD.md incl. the owner's additions:
-- follower emails per ticket, and PUBLIC QR/link intake (no login) via a
-- tokenised SECURITY DEFINER RPC. RLS ships with the tables (CLAUDE.md rule 4).
-- Validated on local PG16; apply via supabase/APPLY_STAGE3.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catalogue + staffing + SLA
-- ---------------------------------------------------------------------------
create table if not exists public.sd_categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organisations(id) on delete cascade,   -- null = global default set
  building_id uuid references public.buildings(id) on delete cascade,       -- null = org-wide
  label       text not null,
  sort_order  int not null default 100,
  active      boolean not null default true
);

create table if not exists public.sd_site_staff (
  id              uuid primary key default gen_random_uuid(),
  building_id     uuid not null references public.buildings(id) on delete cascade,
  org_id          uuid not null references public.organisations(id) on delete cascade,
  name            text not null,
  role            text not null check (role in ('concierge','cleaner','manager')),
  email           text,
  whatsapp_number text,
  notify_channels jsonb not null default '["push"]'::jsonb,
  active          boolean not null default true
);
create index if not exists sd_site_staff_building_idx on public.sd_site_staff (building_id) where active;

create table if not exists public.sd_sla_policies (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  priority        text not null check (priority in ('low','normal','high','urgent')),
  respond_minutes int not null,
  resolve_minutes int not null,
  unique (org_id, priority)
);

-- ---------------------------------------------------------------------------
-- Tickets + children
-- ---------------------------------------------------------------------------
create table if not exists public.sd_tickets (
  id                 uuid primary key default gen_random_uuid(),
  ref                text not null unique,           -- SD-AUR-2607-0042
  org_id             uuid not null references public.organisations(id),  -- servicing (cleaning) org
  building_id        uuid not null references public.buildings(id),
  status             text not null default 'new'
                     check (status in ('new','open','in_progress','resolved','closed','reopened')),
  priority           text not null default 'normal'
                     check (priority in ('low','normal','high','urgent')),
  category_id        uuid references public.sd_categories(id),
  category_label     text not null,                  -- denormalised for stable history
  description        text not null default '',
  lodged_by_name     text not null,                  -- public intake has no auth user
  lodged_by_staff_id uuid references public.sd_site_staff(id),
  assigned_staff_id  uuid references public.sd_site_staff(id),
  assigned_name      text,
  attended_at        timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  reopened_count     int not null default 0,
  csat               text check (csat in ('up','down')),
  pdf_path           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists sd_tickets_building_idx on public.sd_tickets (building_id, status);
create index if not exists sd_tickets_org_idx on public.sd_tickets (org_id, created_at desc);

create table if not exists public.sd_ticket_locations (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.sd_tickets(id) on delete cascade,
  level      text not null,
  area_text  text,
  sort_order int not null default 0
);
create index if not exists sd_locations_ticket_idx on public.sd_ticket_locations (ticket_id);

create table if not exists public.sd_ticket_photos (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.sd_tickets(id) on delete cascade,
  kind         text not null check (kind in ('before','after')),
  storage_path text,                                  -- Supabase Storage object (authed uploads)
  data_url     text check (data_url is null or length(data_url) <= 400000),  -- public intake inline (compressed)
  uploaded_by  text not null default '',
  created_at   timestamptz not null default now(),
  check (storage_path is not null or data_url is not null)
);
create index if not exists sd_photos_ticket_idx on public.sd_ticket_photos (ticket_id);

-- immutable timeline: insert-only by policy (no update/delete policies exist)
create table if not exists public.sd_ticket_events (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.sd_tickets(id) on delete cascade,
  kind       text not null check (kind in ('created','status','note','photo','notify','csat')),
  actor_name text not null,
  body       text not null,
  internal   boolean not null default false,          -- cleaning-team only
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sd_events_ticket_idx on public.sd_ticket_events (ticket_id, created_at);

create table if not exists public.sd_ticket_followers (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.sd_tickets(id) on delete cascade,
  email       text not null,
  added_by    text not null default '',
  created_at  timestamptz not null default now(),
  unique (ticket_id, email)
);

-- ---------------------------------------------------------------------------
-- Public intake: per-building rotating tokens; consumed ONLY by the RPC below
-- ---------------------------------------------------------------------------
create table if not exists public.sd_intake_tokens (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  token       text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- monthly per-building ref sequence: SD-{CODE}-{YYMM}-{seq}
create table if not exists public.sd_ref_counters (
  building_id uuid not null references public.buildings(id) on delete cascade,
  yymm        text not null,
  seq         int not null default 0,
  primary key (building_id, yymm)
);

create or replace function app.sd_next_ref(p_building uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_yymm text := to_char(now(), 'YYMM');
  v_seq  int;
begin
  select upper(left(regexp_replace(name, '[^A-Za-z]', '', 'g'), 3)) into v_code
  from public.buildings where id = p_building;
  if v_code is null then raise exception 'unknown building'; end if;
  insert into public.sd_ref_counters (building_id, yymm, seq) values (p_building, v_yymm, 1)
  on conflict (building_id, yymm) do update set seq = sd_ref_counters.seq + 1
  returning seq into v_seq;
  return format('SD-%s-%s-%s', v_code, v_yymm, lpad(v_seq::text, 4, '0'));
end $$;

/**
 * Public intake: anyone holding the building's QR/link token lodges a ticket —
 * no login. SECURITY DEFINER so it can write through RLS after validating the
 * token. Photos arrive as compressed data URLs (client-side ≤900px JPEG),
 * max 5, each ≤400KB (enforced by the table check).
 * payload: { lodgedBy, categoryLabel, description, priority,
 *            locations: [{level, area}], followers: [email], photos: [dataUrl] }
 */
create or replace function public.sd_lodge_ticket(p_token text, p_payload jsonb)
returns table (ticket_id uuid, ticket_ref text)
language plpgsql security definer set search_path = public as $$
declare
  v_building uuid;
  v_org      uuid;
  v_ref      text;
  v_id       uuid;
  v_priority text := coalesce(p_payload->>'priority', 'normal');
  v_lodged   text := coalesce(nullif(trim(p_payload->>'lodgedBy'), ''), 'QR intake');
  v_n        int;
begin
  select building_id into v_building
  from public.sd_intake_tokens where token = p_token and active;
  if v_building is null then raise exception 'invalid intake token'; end if;

  select bo.org_id into v_org
  from public.building_organisations bo
  where bo.building_id = v_building and bo.relationship = 'cleaning' and bo.active
  limit 1;
  if v_org is null then raise exception 'no servicing organisation for building'; end if;

  if jsonb_array_length(coalesce(p_payload->'photos', '[]'::jsonb)) > 5 then
    raise exception 'max 5 photos';
  end if;

  v_ref := app.sd_next_ref(v_building);
  insert into public.sd_tickets (ref, org_id, building_id, priority, category_label, description, lodged_by_name)
  values (v_ref, v_org, v_building, v_priority,
          coalesce(nullif(trim(p_payload->>'categoryLabel'), ''), 'Other'),
          coalesce(p_payload->>'description', ''), v_lodged)
  returning id into v_id;

  insert into public.sd_ticket_locations (ticket_id, level, area_text, sort_order)
  select v_id, l->>'level', nullif(trim(coalesce(l->>'area', '')), ''), ord - 1
  from jsonb_array_elements(coalesce(p_payload->'locations', '[]'::jsonb)) with ordinality as t(l, ord);

  insert into public.sd_ticket_followers (ticket_id, email, added_by)
  select distinct v_id, f.value #>> '{}', v_lodged
  from jsonb_array_elements(coalesce(p_payload->'followers', '[]'::jsonb)) f
  where (f.value #>> '{}') like '%@%';

  insert into public.sd_ticket_photos (ticket_id, kind, data_url, uploaded_by)
  select v_id, 'before', p.value #>> '{}', v_lodged
  from jsonb_array_elements(coalesce(p_payload->'photos', '[]'::jsonb)) p;

  get diagnostics v_n = row_count;
  insert into public.sd_ticket_events (ticket_id, kind, actor_name, body)
  values (v_id, 'created', v_lodged, format('Ticket lodged · %s photos · %s', v_n, initcap(v_priority))),
         (v_id, 'notify', 'System', 'Notification fan-out queued (email/WhatsApp per site routing)');

  return query select v_id, v_ref;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sd_categories       enable row level security;
alter table public.sd_site_staff       enable row level security;
alter table public.sd_sla_policies     enable row level security;
alter table public.sd_tickets          enable row level security;
alter table public.sd_ticket_locations enable row level security;
alter table public.sd_ticket_photos    enable row level security;
alter table public.sd_ticket_events    enable row level security;
alter table public.sd_ticket_followers enable row level security;
alter table public.sd_intake_tokens    enable row level security;
alter table public.sd_ref_counters     enable row level security;   -- no policies: RPC-only

drop policy if exists sd_categories_read on public.sd_categories;
create policy sd_categories_read on public.sd_categories for select using (
  org_id is null or app.is_org_member(org_id)
  or (building_id is not null and app.can_access_building(building_id))
);
drop policy if exists sd_categories_write on public.sd_categories;
create policy sd_categories_write on public.sd_categories for all
  using (org_id is not null and app.has_role(org_id, array['org_admin','manager']))
  with check (org_id is not null and app.has_role(org_id, array['org_admin','manager']));

-- staff lists: your own org's roster, or the building manager's overview
drop policy if exists sd_staff_read on public.sd_site_staff;
create policy sd_staff_read on public.sd_site_staff for select
  using (app.is_org_member(org_id) or app.manages_building(building_id));
drop policy if exists sd_staff_write on public.sd_site_staff;
create policy sd_staff_write on public.sd_site_staff for all
  using (app.has_role(org_id, array['org_admin','manager']))
  with check (app.has_role(org_id, array['org_admin','manager']) and app.org_serves_building(org_id, building_id));

drop policy if exists sd_sla_rw on public.sd_sla_policies;
create policy sd_sla_rw on public.sd_sla_policies for all
  using (app.is_org_member(org_id))
  with check (app.has_role(org_id, array['org_admin','manager']));

-- tickets: visible to every org serving the building (concierge lodged it,
-- cleaning attends it, owner oversees it); written by the servicing org and
-- building managers. Public intake bypasses via the definer RPC.
drop policy if exists sd_tickets_read on public.sd_tickets;
create policy sd_tickets_read on public.sd_tickets for select
  using (app.can_access_building(building_id));
drop policy if exists sd_tickets_insert on public.sd_tickets;
create policy sd_tickets_insert on public.sd_tickets for insert
  with check (app.can_access_building(building_id));
drop policy if exists sd_tickets_update on public.sd_tickets;
create policy sd_tickets_update on public.sd_tickets for update
  using (app.is_org_member(org_id) or app.manages_building(building_id))
  with check (app.is_org_member(org_id) or app.manages_building(building_id));

drop policy if exists sd_locations_read on public.sd_ticket_locations;
create policy sd_locations_read on public.sd_ticket_locations for select using (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id and app.can_access_building(t.building_id)));
drop policy if exists sd_locations_write on public.sd_ticket_locations;
create policy sd_locations_write on public.sd_ticket_locations for insert with check (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and (app.is_org_member(t.org_id) or app.can_access_building(t.building_id))));

drop policy if exists sd_photos_read on public.sd_ticket_photos;
create policy sd_photos_read on public.sd_ticket_photos for select using (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id and app.can_access_building(t.building_id)));
drop policy if exists sd_photos_insert on public.sd_ticket_photos;
create policy sd_photos_insert on public.sd_ticket_photos for insert with check (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and (app.is_org_member(t.org_id) or app.can_access_building(t.building_id))));

-- timeline: INTERNAL notes are visible ONLY to the servicing org (+ building
-- managers see public events, never internal ones from another org)
drop policy if exists sd_events_read on public.sd_ticket_events;
create policy sd_events_read on public.sd_ticket_events for select using (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and app.can_access_building(t.building_id)
          and (not sd_ticket_events.internal or app.is_org_member(t.org_id))));
drop policy if exists sd_events_insert on public.sd_ticket_events;
create policy sd_events_insert on public.sd_ticket_events for insert with check (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and (app.is_org_member(t.org_id) or app.can_access_building(t.building_id)))
  and (not internal or exists (select 1 from public.sd_tickets t2 where t2.id = ticket_id and app.is_org_member(t2.org_id))));

drop policy if exists sd_followers_read on public.sd_ticket_followers;
create policy sd_followers_read on public.sd_ticket_followers for select using (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id and app.can_access_building(t.building_id)));
drop policy if exists sd_followers_write on public.sd_ticket_followers;
create policy sd_followers_write on public.sd_ticket_followers for all using (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and (app.is_org_member(t.org_id) or app.can_access_building(t.building_id))))
  with check (
  exists (select 1 from public.sd_tickets t where t.id = ticket_id
          and (app.is_org_member(t.org_id) or app.can_access_building(t.building_id))));

-- intake tokens: managed by building managers; NEVER selectable by app roles
-- beyond that (the RPC reads them as definer)
drop policy if exists sd_tokens_rw on public.sd_intake_tokens;
create policy sd_tokens_rw on public.sd_intake_tokens for all
  using (app.manages_building(building_id)) with check (app.manages_building(building_id));

drop trigger if exists sd_tickets_touch on public.sd_tickets;
create trigger sd_tickets_touch before update on public.sd_tickets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant all on public.sd_categories, public.sd_site_staff, public.sd_sla_policies,
             public.sd_tickets, public.sd_ticket_locations, public.sd_ticket_photos,
             public.sd_ticket_events, public.sd_ticket_followers, public.sd_intake_tokens
  to authenticated, service_role;
grant execute on function public.sd_lodge_ticket(text, jsonb) to anon, authenticated, service_role;
revoke all on public.sd_ref_counters from authenticated, anon;

-- =============================================================================
-- 0003_anon_hardening.sql — strip the anonymous API role to least privilege.
--
-- WHY: Supabase projects ship ALTER DEFAULT PRIVILEGES that auto-grant table
-- access to `anon` for every table created in `public`. RLS still blocked all
-- rows (sd_isolation_check proved anon saw an EMPTY result, not data), but the
-- anonymous role should not be able to address these tables at all.
-- After this migration the ONLY thing `anon` can do is execute the token-gated
-- public intake RPC (SECURITY DEFINER, so it needs no table grants).
-- =============================================================================

-- take back everything the project defaults handed out
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- and stop future tables from being auto-granted to anon
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- anon keeps exactly one capability: lodging a ticket via the intake token
grant usage on schema public to anon;
grant execute on function public.sd_lodge_ticket(text, jsonb) to anon;

-- =============================================================================
-- seed_service_desk.sql — Service Desk reference data for Aurora on Collins.
-- Idempotent. Runs as postgres/service_role.
-- =============================================================================

-- global default category set (org-admin configurable per site later)
insert into public.sd_categories (org_id, building_id, label, sort_order)
select null, null, v.label, v.ord
from (values
  ('Spillage', 10), ('Dirty area', 20), ('Rubbish overflow', 30),
  ('Toilet issue', 40), ('Glass/window', 50), ('Graffiti', 60),
  ('Odour', 70), ('Carpet stain', 80), ('Lift interior', 90), ('Other', 999)
) v(label, ord)
where not exists (select 1 from public.sd_categories c where c.label = v.label and c.org_id is null);

-- site staff registry (drives name dropdowns + notification routing)
insert into public.sd_site_staff (building_id, org_id, name, role, email)
select b.id, o.id, v.name, v.role, v.email
from (values
  ('concierge-collective', 'Amelia Ng',    'concierge', 'amelia@concierge.demo'),
  ('concierge-collective', 'Oliver Reyes', 'concierge', 'oliver@concierge.demo'),
  ('foct-cleaning',        'Marcus Chen',  'cleaner',   'marcus@foct.demo'),
  ('foct-cleaning',        'Leila Haddad', 'cleaner',   'leila@foct.demo'),
  ('foct-cleaning',        'Tom Nguyen',   'cleaner',   'tom@foct.demo'),
  ('foct-cleaning',        'Sofia Marino', 'cleaner',   'sofia@foct.demo'),
  ('foct-cleaning',        'Priya Sharma', 'manager',   'priya@foct.demo')
) v(org_slug, name, role, email)
join public.organisations o on o.slug = v.org_slug
cross join public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (
    select 1 from public.sd_site_staff s
    where s.building_id = b.id and s.name = v.name and s.org_id = o.id
  );

-- SLA defaults for FOCT Cleaning (owner to confirm; PRD open question 2)
insert into public.sd_sla_policies (org_id, priority, respond_minutes, resolve_minutes)
select o.id, v.p, v.respond, v.resolve
from (values
  ('urgent', 15, 120), ('high', 45, 240), ('normal', 120, 480), ('low', 240, 1440)
) v(p, respond, resolve)
join public.organisations o on o.slug = 'foct-cleaning'
on conflict (org_id, priority) do nothing;

-- demo intake token for the Aurora QR/link (rotate via the dashboard later)
insert into public.sd_intake_tokens (building_id, token)
select b.id, 'aurora-demo-intake-7f2k'
from public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (select 1 from public.sd_intake_tokens t where t.token = 'aurora-demo-intake-7f2k');
