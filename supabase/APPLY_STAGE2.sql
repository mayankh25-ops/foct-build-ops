-- =============================================================================
-- APPLY_STAGE2.sql — GENERATED one-paste apply for the Supabase SQL editor.
-- = migrations/0000_platform_foundation.sql + 0001_theme_engine.sql + seed.sql + 0004_authz_can.sql
-- Idempotent (verified by double-run) — safe to re-run.
-- After applying, paste tests/isolation_check.sql — expect 23 'ok' notices.
-- =============================================================================

-- =============================================================================
-- 0000_platform_foundation.sql — Stage 2 core schema (CLAUDE.md core tables)
--
-- The multi-org isolation rule is NON-NEGOTIABLE and enforced HERE first:
-- access = organisation × building × module × role × permission ×
-- service_contract. Policies ship with tables in this same file.
-- Helpers live in schema `app` (0001_theme_engine.sql builds on them).
-- Validated against Postgres 16 locally; apply via supabase/APPLY_STAGE2.sql.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------------
create table if not exists public.organisation_types (
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique,          -- owner_strata | cleaning | concierge_bm | subcontractor
  name  text not null
);

create table if not exists public.roles (
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique,          -- super_admin | org_admin | manager | staff | viewer
  name  text not null
);

create table if not exists public.permissions (
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique,
  name  text not null
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,    -- cleaning_ops | service_desk | …
  name        text not null,
  description text not null default ''
);

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table if not exists public.organisations (
  id         uuid primary key default gen_random_uuid(),
  type_id    uuid not null references public.organisation_types(id),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.organisation_memberships (
  id       uuid primary key default gen_random_uuid(),
  org_id   uuid not null references public.organisations(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  role_id  uuid not null references public.roles(id),
  active   boolean not null default true,
  unique (org_id, user_id)
);
create index if not exists org_memberships_user_idx on public.organisation_memberships (user_id) where active;

create table if not exists public.buildings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  address      text not null default '',
  levels       jsonb not null default '[]'::jsonb,   -- ["B4","B3",…,"L40"]
  owner_org_id uuid not null references public.organisations(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.building_organisations (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  org_id       uuid not null references public.organisations(id) on delete cascade,
  relationship text not null check (relationship in ('owner','cleaning','concierge_bm','subcontractor')),
  active       boolean not null default true,
  unique (building_id, org_id)
);
create index if not exists building_orgs_org_idx on public.building_organisations (org_id) where active;

create table if not exists public.building_memberships (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  org_id      uuid not null references public.organisations(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  active      boolean not null default true,
  unique (building_id, org_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Module packaging + cross-org grants (every grant is an explicit row)
-- ---------------------------------------------------------------------------
create table if not exists public.building_modules (
  building_id uuid not null references public.buildings(id) on delete cascade,
  module_id   uuid not null references public.modules(id) on delete cascade,
  status      text not null default 'disabled' check (status in ('enabled','disabled','coming_soon','pro')),
  primary key (building_id, module_id)
);

create table if not exists public.organisation_module_access (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  module_id   uuid not null references public.modules(id) on delete cascade,
  granted_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  unique (org_id, building_id, module_id)
);

create table if not exists public.service_contracts (
  id              uuid primary key default gen_random_uuid(),
  building_id     uuid not null references public.buildings(id) on delete cascade,
  provider_org_id uuid not null references public.organisations(id),
  client_org_id   uuid not null references public.organisations(id),
  scope           text not null default '',
  starts_on       date,
  ends_on         date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists service_contracts_building_idx on public.service_contracts (building_id) where active;

-- ---------------------------------------------------------------------------
-- Audit + integrations
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organisations(id),
  building_id uuid references public.buildings(id),
  actor_id    uuid references public.users(id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_org_idx on public.audit_logs (org_id, created_at desc);

create table if not exists public.integration_providers (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,          -- email | sms | storage | accounting | push
  brand         text not null,
  capabilities  jsonb not null default '[]'::jsonb,
  config_schema jsonb not null default '{}'::jsonb,  -- JSON Schema → auto-rendered form
  active        boolean not null default true,
  unique (category, brand)
);

create table if not exists public.integration_credentials (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  provider_id uuid not null references public.integration_providers(id),
  label       text not null,
  secret_ref  text not null,            -- Supabase Vault secret id — NEVER plaintext
  masked      text not null default '',  -- e.g. "•••• 4242" for the admin UI
  active      boolean not null default true,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers (schema app) — the vocabulary every policy speaks
-- ---------------------------------------------------------------------------
create or replace function app.current_user_id() returns uuid
language sql stable as $$ select auth.uid() $$;

create or replace function app.is_org_member(check_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organisation_memberships m
    where m.org_id = check_org and m.user_id = auth.uid() and m.active
  );
$$;

create or replace function app.current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'org_id', '')::uuid,
    (select m.org_id from public.organisation_memberships m
     where m.user_id = auth.uid() and m.active
     order by m.id limit 1)
  );
$$;

create or replace function app.has_role(check_org uuid, role_keys text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
    where m.org_id = check_org and m.user_id = auth.uid() and m.active
      and r.key = any (role_keys)
  );
$$;

create or replace function app.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.active and r.key = 'super_admin'
  );
$$;

create or replace function app.org_serves_building(check_org uuid, check_building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.building_organisations bo
    where bo.org_id = check_org and bo.building_id = check_building and bo.active
  );
$$;

/** Any of MY orgs is linked to this building (the standard visibility test). */
create or replace function app.can_access_building(check_building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1
    from public.building_organisations bo
    join public.organisation_memberships m on m.org_id = bo.org_id
    where bo.building_id = check_building and bo.active
      and m.user_id = auth.uid() and m.active
  );
$$;

create or replace function app.manages_building(check_building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1
    from public.buildings b
    join public.organisation_memberships m on m.org_id = b.owner_org_id
    join public.roles r on r.id = m.role_id
    where b.id = check_building
      and m.user_id = auth.uid() and m.active
      and r.key in ('org_admin','manager')
  );
$$;

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

-- ---------------------------------------------------------------------------
-- RLS — every table, no exceptions
-- ---------------------------------------------------------------------------
alter table public.organisation_types    enable row level security;
alter table public.roles                 enable row level security;
alter table public.permissions           enable row level security;
alter table public.role_permissions      enable row level security;
alter table public.modules               enable row level security;
alter table public.organisations         enable row level security;
alter table public.users                 enable row level security;
alter table public.organisation_memberships enable row level security;
alter table public.buildings             enable row level security;
alter table public.building_organisations enable row level security;
alter table public.building_memberships  enable row level security;
alter table public.building_modules      enable row level security;
alter table public.organisation_module_access enable row level security;
alter table public.service_contracts     enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.integration_providers enable row level security;
alter table public.integration_credentials enable row level security;

-- reference data: readable by any authenticated user, written by nobody (seeds
-- run as postgres/service_role which bypass RLS)
drop policy if exists ref_read_org_types on public.organisation_types;
create policy ref_read_org_types on public.organisation_types for select using (auth.uid() is not null);
drop policy if exists ref_read_roles on public.roles;
create policy ref_read_roles on public.roles for select using (auth.uid() is not null);
drop policy if exists ref_read_permissions on public.permissions;
create policy ref_read_permissions on public.permissions for select using (auth.uid() is not null);
drop policy if exists ref_read_role_permissions on public.role_permissions;
create policy ref_read_role_permissions on public.role_permissions for select using (auth.uid() is not null);
drop policy if exists ref_read_modules on public.modules;
create policy ref_read_modules on public.modules for select using (auth.uid() is not null);

-- organisations: members see their own orgs; anyone linked to one of my
-- buildings sees the org's NAME row too (needed to render "serviced by")
drop policy if exists organisations_read on public.organisations;
create policy organisations_read on public.organisations for select using (
  app.is_org_member(id)
  or app.is_super_admin()
  or exists (
    select 1
    from public.building_organisations bo
    join public.building_organisations mine on mine.building_id = bo.building_id and mine.active
    where bo.org_id = organisations.id and bo.active and app.is_org_member(mine.org_id)
  )
);
drop policy if exists organisations_write on public.organisations;
create policy organisations_write on public.organisations for update
  using (app.has_role(id, array['org_admin'])) with check (app.has_role(id, array['org_admin']));

-- users: yourself + people in your orgs
drop policy if exists users_read on public.users;
create policy users_read on public.users for select using (
  id = auth.uid()
  or app.is_super_admin()
  or exists (
    select 1
    from public.organisation_memberships them
    join public.organisation_memberships me on me.org_id = them.org_id and me.active
    where them.user_id = users.id and them.active and me.user_id = auth.uid()
  )
);
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- memberships: visible inside the org; managed by that org's admins
drop policy if exists memberships_read on public.organisation_memberships;
create policy memberships_read on public.organisation_memberships for select
  using (app.is_org_member(org_id) or app.is_super_admin());
drop policy if exists memberships_write on public.organisation_memberships;
create policy memberships_write on public.organisation_memberships for all
  using (app.has_role(org_id, array['org_admin']) or app.is_super_admin())
  with check (app.has_role(org_id, array['org_admin']) or app.is_super_admin());

-- buildings: visible to every org linked to them; owner org admins write
drop policy if exists buildings_read on public.buildings;
create policy buildings_read on public.buildings for select using (app.can_access_building(id));
drop policy if exists buildings_write on public.buildings;
create policy buildings_write on public.buildings for all
  using (app.manages_building(id)) with check (app.manages_building(id));

drop policy if exists building_orgs_read on public.building_organisations;
create policy building_orgs_read on public.building_organisations for select
  using (app.can_access_building(building_id));
drop policy if exists building_orgs_write on public.building_organisations;
create policy building_orgs_write on public.building_organisations for all
  using (app.manages_building(building_id)) with check (app.manages_building(building_id));

-- building staff lists: only YOUR OWN org's rows at buildings you can access
-- (a cleaning company never sees another contractor's staffing)
drop policy if exists building_memberships_read on public.building_memberships;
create policy building_memberships_read on public.building_memberships for select
  using (app.is_org_member(org_id) or app.manages_building(building_id));
drop policy if exists building_memberships_write on public.building_memberships;
create policy building_memberships_write on public.building_memberships for all
  using (app.has_role(org_id, array['org_admin','manager']))
  with check (app.has_role(org_id, array['org_admin','manager']) and app.org_serves_building(org_id, building_id));

drop policy if exists building_modules_read on public.building_modules;
create policy building_modules_read on public.building_modules for select
  using (app.can_access_building(building_id));
drop policy if exists building_modules_write on public.building_modules;
create policy building_modules_write on public.building_modules for all
  using (app.manages_building(building_id)) with check (app.manages_building(building_id));

drop policy if exists org_module_access_read on public.organisation_module_access;
create policy org_module_access_read on public.organisation_module_access for select
  using (app.is_org_member(org_id) or app.manages_building(building_id));
drop policy if exists org_module_access_write on public.organisation_module_access;
create policy org_module_access_write on public.organisation_module_access for all
  using (app.manages_building(building_id)) with check (app.manages_building(building_id));

-- contracts: parties only
drop policy if exists contracts_read on public.service_contracts;
create policy contracts_read on public.service_contracts for select
  using (app.is_org_member(provider_org_id) or app.is_org_member(client_org_id) or app.is_super_admin());
drop policy if exists contracts_write on public.service_contracts;
create policy contracts_write on public.service_contracts for all
  using (app.has_role(client_org_id, array['org_admin']) or app.is_super_admin())
  with check (app.has_role(client_org_id, array['org_admin']) or app.is_super_admin());

-- audit: append-only from your own org; readable by that org's admins
drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert
  with check (org_id is not null and app.is_org_member(org_id) and actor_id = auth.uid());
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select
  using (app.has_role(org_id, array['org_admin','manager']) or app.is_super_admin());

-- integrations: catalogue public to authed; credentials org-admin only
drop policy if exists providers_read on public.integration_providers;
create policy providers_read on public.integration_providers for select using (auth.uid() is not null);
drop policy if exists credentials_rw on public.integration_credentials;
create policy credentials_rw on public.integration_credentials for all
  using (app.has_role(org_id, array['org_admin']) or app.is_super_admin())
  with check (app.has_role(org_id, array['org_admin']) or app.is_super_admin());

-- ---------------------------------------------------------------------------
-- Grants (Supabase roles; created by the local prelude when validating)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant select on public.integration_providers to anon;
grant usage on schema app to anon, authenticated, service_role;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- =============================================================================
-- 0001_theme_engine.sql — themes + building_theme_assignments (+ RLS)
--
-- AUTHORED at Stage 1.5 (Theme Builder), EXECUTES at Stage 2 when the platform
-- foundation lands. DEPENDS ON Stage 2's core tables and helpers:
--   organisations(id), buildings(id), users(id),
--   app.current_org_id()      -- org of the authenticated user (JWT claim)
--   app.is_org_member(uuid)   -- membership check
--   app.manages_building(uuid)-- building-admin / owner-org check
-- If helper names differ when Stage 2 lands, update the policies here in the
-- SAME commit — policies ship with tables (CLAUDE.md rule 4).
--
-- The Stage 1.5 UI persists through a local store adapter with EXACTLY this
-- row shape (src/lib/theme-store.ts), so cutover is a data move, not a rewrite.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- themes: built-in rows (org_id NULL, is_builtin) + org/building custom rows.
-- tokens jsonb holds the 8 authored tokens + every derived token, keyed by
-- CSS var name without "--" (e.g. {"bg-canvas":"#f9f7f2", ...}).
-- fonts jsonb: {"display":"...","body":"...","mono":"...","uploads":[{name,storage_path}]}
-- ---------------------------------------------------------------------------
create table if not exists public.themes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organisations(id) on delete cascade,
  building_id  uuid references public.buildings(id) on delete cascade,
  name         text not null,
  slug         text not null,
  base_theme   text,                       -- built-in slug this was duplicated from
  tokens       jsonb not null default '{}'::jsonb,
  fonts        jsonb not null default '{}'::jsonb,
  is_builtin   boolean not null default false,
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- built-ins are global (no org); customs must belong to an org
  constraint themes_scope check (is_builtin = (org_id is null)),
  constraint themes_slug_unique unique nulls not distinct (org_id, slug)
);

create index if not exists themes_org_idx on public.themes (org_id);
create index if not exists themes_building_idx on public.themes (building_id);

alter table public.themes enable row level security;

-- read: built-ins are visible to every authenticated user; customs only to
-- members of the owning org.
drop policy if exists themes_read on public.themes;
create policy themes_read on public.themes
  for select using (
    is_builtin
    or (org_id is not null and app.is_org_member(org_id))
  );

-- write: only members of the owning org, never on built-ins.
drop policy if exists themes_insert on public.themes;
create policy themes_insert on public.themes
  for insert with check (
    not is_builtin
    and org_id = app.current_org_id()
  );

drop policy if exists themes_update on public.themes;
create policy themes_update on public.themes
  for update using (
    not is_builtin and app.is_org_member(org_id)
  ) with check (
    not is_builtin and org_id = app.current_org_id()
  );

drop policy if exists themes_delete on public.themes;
create policy themes_delete on public.themes
  for delete using (
    not is_builtin and app.is_org_member(org_id)
  );

-- ---------------------------------------------------------------------------
-- building_theme_assignments: which theme a building renders, plus optional
-- per-building font-slot overrides (fonts jsonb, same shape as themes.fonts).
-- One active assignment per building.
-- ---------------------------------------------------------------------------
create table if not exists public.building_theme_assignments (
  building_id  uuid primary key references public.buildings(id) on delete cascade,
  theme_id     uuid not null references public.themes(id) on delete restrict,
  fonts        jsonb not null default '{}'::jsonb,
  assigned_by  uuid references public.users(id),
  assigned_at  timestamptz not null default now()
);

alter table public.building_theme_assignments enable row level security;

-- read: anyone who can access the building (the app must render its theme).
drop policy if exists bta_read on public.building_theme_assignments;
create policy bta_read on public.building_theme_assignments
  for select using (app.can_access_building(building_id));

-- write: building managers/owner org only.
drop policy if exists bta_write on public.building_theme_assignments;
create policy bta_write on public.building_theme_assignments
  for all using (app.manages_building(building_id))
  with check (app.manages_building(building_id));

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists themes_touch on public.themes;
create trigger themes_touch before update on public.themes
  for each row execute function public.touch_updated_at();

-- grants (0000's grant-all predates these tables)
grant all on public.themes, public.building_theme_assignments to authenticated, service_role;

-- =============================================================================
-- seed.sql — Aurora on Collins demo dataset (CLAUDE.md → Demo dataset)
-- Idempotent: safe to re-run. Runs as postgres/service_role (bypasses RLS).
-- Demo passwords are NOT set here — users sign in via magic link, or set
-- passwords in the dashboard. auth.users rows are created minimally so the
-- public.users profiles + memberships can exist for RLS testing.
-- =============================================================================

-- ---- reference data ---------------------------------------------------------
insert into public.organisation_types (key, name) values
  ('owner_strata', 'Building owner / strata'),
  ('cleaning', 'Cleaning company'),
  ('concierge_bm', 'Concierge / building management'),
  ('subcontractor', 'Subcontractor')
on conflict (key) do nothing;

insert into public.roles (key, name) values
  ('super_admin', 'Super admin'),
  ('org_admin', 'Organisation admin'),
  ('manager', 'Manager / supervisor'),
  ('staff', 'Staff'),
  ('viewer', 'Client viewer (read-only)')
on conflict (key) do nothing;

insert into public.modules (key, name, description) values
  ('cleaning_ops', 'CleaningOps', 'Sign-in/out, rosters, timesheets, consumables, tasks, audits'),
  ('service_desk', 'Service Desk', 'Ticketing with photo proof, followers, SLA'),
  ('tasks_incidents', 'Tasks & incidents', 'Assignable tasks for cleaners and concierge'),
  ('calendar', 'Calendar', 'Building calendar'),
  ('site_audits', 'Site audits', 'Scored site audit forms'),
  ('concierge_desk', 'Concierge desk', 'Front-of-house log and handover'),
  ('parcels', 'Parcels', 'Parcel intake and collection'),
  ('resident_requests', 'Resident requests', 'Resident maintenance and amenity requests'),
  ('contractors', 'Contractors', 'Inductions, insurance, arrivals'),
  ('floor_plans', 'Floor plans', 'Interactive levels with zones and assets'),
  ('automation', 'Automation', 'People counting, lifts, robots, cameras, BMS')
on conflict (key) do nothing;

-- ---- organisations ----------------------------------------------------------
insert into public.organisations (id, type_id, name, slug)
select v.id::uuid, t.id, v.name, v.slug
from (values
  ('11111111-0000-0000-0000-000000000001', 'owner_strata',  'Meridian Strata Group', 'meridian-strata'),
  ('11111111-0000-0000-0000-000000000002', 'cleaning',      'FOCT Cleaning',         'foct-cleaning'),
  ('11111111-0000-0000-0000-000000000003', 'concierge_bm',  'Concierge Collective',  'concierge-collective'),
  ('11111111-0000-0000-0000-000000000004', 'subcontractor', 'BrightSpark Electrical','brightspark-electrical'),
  -- rival org NOT linked to Aurora — exists purely to prove isolation
  ('11111111-0000-0000-0000-000000000005', 'cleaning',      'Rival Cleaning Pty',    'rival-cleaning')
) as v(id, type_key, name, slug)
join public.organisation_types t on t.key = v.type_key
on conflict (slug) do nothing;

-- ---- users (auth stub + profile + membership) --------------------------------
-- CLAUDE.md cast: 1 super admin, 1 strata manager, 1 cleaning manager,
-- 3 cleaners, 1 concierge, 1 subcontractor admin (+1 extra concierge, +1 rival).
create or replace function pg_temp.seed_user(
  uid uuid, uname text, uemail text, org_slug text, role_key text
) returns void language plpgsql as $$
begin
  insert into auth.users (id, email) values (uid, uemail)
  on conflict (id) do nothing;
  insert into public.users (id, name, email) values (uid, uname, uemail)
  on conflict (id) do nothing;
  insert into public.organisation_memberships (org_id, user_id, role_id)
  select o.id, uid, r.id
  from public.organisations o, public.roles r
  where o.slug = org_slug and r.key = role_key
  on conflict (org_id, user_id) do nothing;
end $$;

select pg_temp.seed_user('22222222-0000-0000-0000-000000000001', 'FOCT Super Admin', 'admin@foct.demo',            'foct-cleaning',          'super_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000002', 'Sandra Wells',     'sandra@meridian.demo',       'meridian-strata',        'org_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000003', 'Priya Sharma',     'priya@foct.demo',            'foct-cleaning',          'manager');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000004', 'Marcus Chen',      'marcus@foct.demo',           'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000005', 'Leila Haddad',     'leila@foct.demo',            'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000006', 'Tom Nguyen',       'tom@foct.demo',              'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000007', 'Amelia Ng',        'amelia@concierge.demo',      'concierge-collective',   'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000008', 'Oliver Reyes',     'oliver@concierge.demo',      'concierge-collective',   'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000009', 'Ben Sparks',       'ben@brightspark.demo',       'brightspark-electrical', 'org_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-00000000000a', 'Rita Rival',       'rita@rival.demo',            'rival-cleaning',         'manager');

-- ---- building ----------------------------------------------------------------
insert into public.buildings (id, name, slug, address, levels, owner_org_id)
select
  '33333333-0000-0000-0000-000000000001',
  'Aurora on Collins',
  'aurora-on-collins',
  '525 Collins St, Melbourne VIC 3000',
  (
    select jsonb_agg(l) from (
      select unnest(array['B4','B3','B2','B1','GF']) as l
      union all
      select 'L' || g from generate_series(1, 40) g
    ) levels
  ),
  o.id
from public.organisations o where o.slug = 'meridian-strata'
on conflict (slug) do nothing;

insert into public.building_organisations (building_id, org_id, relationship)
select b.id, o.id, v.rel
from (values
  ('meridian-strata', 'owner'),
  ('foct-cleaning', 'cleaning'),
  ('concierge-collective', 'concierge_bm'),
  ('brightspark-electrical', 'subcontractor')
) v(slug, rel)
join public.organisations o on o.slug = v.slug
cross join public.buildings b
where b.slug = 'aurora-on-collins'
on conflict (building_id, org_id) do nothing;

-- staff working at Aurora
insert into public.building_memberships (building_id, org_id, user_id)
select b.id, m.org_id, m.user_id
from public.buildings b
join public.building_organisations bo on bo.building_id = b.id and bo.active
join public.organisation_memberships m on m.org_id = bo.org_id and m.active
where b.slug = 'aurora-on-collins'
on conflict (building_id, org_id, user_id) do nothing;

-- ---- module packaging (mirrors the app's Module access page) -----------------
insert into public.building_modules (building_id, module_id, status)
select b.id, m.id,
  case m.key
    when 'cleaning_ops' then 'enabled'
    when 'service_desk' then 'enabled'
    when 'concierge_desk' then 'disabled'
    when 'floor_plans' then 'pro'
    when 'automation' then 'pro'
    else 'coming_soon'
  end
from public.buildings b, public.modules m
where b.slug = 'aurora-on-collins'
on conflict (building_id, module_id) do nothing;

-- explicit cross-org grants (never implicit)
insert into public.organisation_module_access (org_id, building_id, module_id)
select o.id, b.id, m.id
from public.organisations o
join public.buildings b on b.slug = 'aurora-on-collins'
join public.modules m on m.key = any (
  case o.slug
    when 'foct-cleaning' then array['cleaning_ops','service_desk']
    when 'concierge-collective' then array['service_desk']
    else array[]::text[]
  end
)
where o.slug in ('foct-cleaning','concierge-collective')
on conflict (org_id, building_id, module_id) do nothing;

insert into public.service_contracts (building_id, provider_org_id, client_org_id, scope, starts_on, active)
select b.id, p.id, c.id, v.scope, current_date, true
from (values
  ('foct-cleaning', 'meridian-strata', 'Daily cleaning + service desk attendance'),
  ('concierge-collective', 'meridian-strata', 'Concierge and building management')
) v(provider, client, scope)
join public.organisations p on p.slug = v.provider
join public.organisations c on c.slug = v.client
cross join public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (
    select 1 from public.service_contracts sc
    where sc.building_id = b.id and sc.provider_org_id = p.id and sc.client_org_id = c.id
  );

-- ---- themes: built-in rows + Aurora's assignment (Nature = default) ----------
insert into public.themes (org_id, building_id, name, slug, is_builtin)
select null, null, v.name, v.slug, true
from (values
  ('Nature', 'option-nature'), ('Graphite', 'graphite'), ('Harbour', 'harbour'),
  ('Eucalypt', 'eucalypt'), ('Sandstone', 'sandstone'), ('Ink', 'ink'),
  ('Analytics', 'option-analytics'), ('Blush', 'option-blush'),
  ('Slate', 'option-slate'), ('Sunset', 'option-sunset')
) v(name, slug)
on conflict on constraint themes_slug_unique do nothing;

insert into public.building_theme_assignments (building_id, theme_id)
select b.id, t.id
from public.buildings b
join public.themes t on t.slug = 'option-nature' and t.is_builtin
where b.slug = 'aurora-on-collins'
on conflict (building_id) do update set theme_id = excluded.theme_id;

-- ---- integration catalogue (adapter pattern; credentials come via the GUI) ---
insert into public.integration_providers (category, brand, capabilities) values
  ('email', 'Resend',       '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'Postmark',     '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'SendGrid',     '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'AWS SES',      '["send","verifyCredentials"]'),
  ('sms',   'Twilio',       '["send","verifyCredentials","deliveryStatus","whatsapp"]'),
  ('sms',   'MessageMedia', '["send","verifyCredentials","deliveryStatus"]'),
  ('sms',   'ClickSend',    '["send","verifyCredentials","deliveryStatus"]')
on conflict (category, brand) do nothing;

-- ============ WHAT CHANGED vs the copy you applied earlier ==================
-- Everything ABOVE this line is byte-identical to the APPLY_STAGE2 you already
-- ran (0000 platform + 0001 theme engine + seed) — re-running it is a no-op.
-- NEW BELOW: 0004_authz_can.sql only —
--   * adds app.can(user, org, building, module, action), the single
--     authorisation function, + a public.can RPC wrapper (self-queries only)
--   * drops + recreates 18 CORE-TABLE policies to route through app.can()
--     with identical semantics (proven by the 23+15 assertion suites)
--   * no table, seed or sd_* changes of any kind
-- ============================================================================

-- =============================================================================
-- 0004_authz_can.sql — unified authorisation entry point.
--
-- app.can(user, org, building, module, action): ONE function every core
-- platform policy routes through. Each clause is skipped when its argument
-- is null, so the same function answers "is this user in this org?",
-- "may they manage this building?", and the full org × building × module
-- question. Semantics reproduce the 0000 policies EXACTLY (verified by
-- double-running the 23+15 isolation assertions before and after).
--
-- Actions:
--   'read'   membership-level visibility (any active role)
--   'manage' org_admin OR manager in the org / of the building's owner org
--   'admin'  org_admin only
--
-- Scope note (owner decision 2026-07-12): core platform tables reroute
-- through can(); the proven sd_* policies stay on the underlying helpers
-- (same model, less churn). users_read / organisations_read keep their
-- bespoke cross-org NAME-visibility expressions (identity rendering, not a
-- permission grant); audit_insert keeps is_org_member with NO super-admin
-- bypass (append-only actor identity is the point).
-- =============================================================================

create or replace function app.can(
  p_user     uuid,
  p_org      uuid default null,
  p_building uuid default null,
  p_module   text default null,
  p_action   text default 'read'
) returns boolean
language sql stable security definer set search_path = public, app as $$
select
  p_user is not null
  and (
    -- super admins pass every check (matches app.is_super_admin)
    exists (
      select 1
      from public.organisation_memberships m
      join public.roles r on r.id = m.role_id
      where m.user_id = p_user and m.active and r.key = 'super_admin'
    )
    or (
      -- ORG clause: active membership; 'manage' needs org_admin|manager,
      -- 'admin' needs org_admin.
      (p_org is null or exists (
        select 1
        from public.organisation_memberships m
        join public.roles r on r.id = m.role_id
        where m.org_id = p_org and m.user_id = p_user and m.active
          and (p_action = 'read'
               or (p_action = 'manage' and r.key in ('org_admin','manager'))
               or (p_action = 'admin'  and r.key = 'org_admin'))
      ))
      -- BUILDING clause: 'read' = any of my orgs actively serves it
      -- (app.can_access_building); 'manage'/'admin' = org_admin|manager of
      -- the building's OWNER org (app.manages_building).
      and (p_building is null or case
        when p_action = 'read' then exists (
          select 1
          from public.building_organisations bo
          join public.organisation_memberships m on m.org_id = bo.org_id
          where bo.building_id = p_building and bo.active
            and m.user_id = p_user and m.active
        )
        else exists (
          select 1
          from public.buildings b
          join public.organisation_memberships m on m.org_id = b.owner_org_id
          join public.roles r on r.id = m.role_id
          where b.id = p_building
            and m.user_id = p_user and m.active
            and r.key in ('org_admin','manager')
        )
      end)
      -- MODULE clause: module enabled at the building AND (one of my orgs
      -- holds an organisation_module_access grant there, or owns the building)
      and (p_module is null or exists (
        select 1
        from public.building_modules bm
        join public.modules mo on mo.id = bm.module_id
        where bm.building_id = p_building
          and bm.status = 'enabled'
          and mo.key = p_module
          and (
            exists (
              select 1
              from public.organisation_module_access oma
              join public.organisation_memberships m
                on m.org_id = oma.org_id and m.user_id = p_user and m.active
              where oma.building_id = p_building and oma.module_id = bm.module_id
            )
            or exists (
              select 1
              from public.buildings b
              join public.organisation_memberships m on m.org_id = b.owner_org_id
              where b.id = p_building and m.user_id = p_user and m.active
            )
          )
      ))
    )
  )
$$;

grant execute on function app.can(uuid, uuid, uuid, text, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reroute the CORE platform policies through app.can().
-- Every rewrite below is a 1:1 translation of the 0000 expression.
-- ---------------------------------------------------------------------------

-- buildings: read = linked org; write = owner-org admin/manager
drop policy if exists buildings_read on public.buildings;
create policy buildings_read on public.buildings for select
  using (app.can(auth.uid(), null, id, null, 'read'));
drop policy if exists buildings_write on public.buildings;
create policy buildings_write on public.buildings for all
  using (app.can(auth.uid(), null, id, null, 'manage'))
  with check (app.can(auth.uid(), null, id, null, 'manage'));

drop policy if exists building_orgs_read on public.building_organisations;
create policy building_orgs_read on public.building_organisations for select
  using (app.can(auth.uid(), null, building_id, null, 'read'));
drop policy if exists building_orgs_write on public.building_organisations;
create policy building_orgs_write on public.building_organisations for all
  using (app.can(auth.uid(), null, building_id, null, 'manage'))
  with check (app.can(auth.uid(), null, building_id, null, 'manage'));

-- org memberships: visible inside the org; org admins manage
drop policy if exists memberships_read on public.organisation_memberships;
create policy memberships_read on public.organisation_memberships for select
  using (app.can(auth.uid(), org_id, null, null, 'read'));
drop policy if exists memberships_write on public.organisation_memberships;
create policy memberships_write on public.organisation_memberships for all
  using (app.can(auth.uid(), org_id, null, null, 'admin'))
  with check (app.can(auth.uid(), org_id, null, null, 'admin'));

-- building staff lists: own org's rows, or the building's owner-org managers
drop policy if exists building_memberships_read on public.building_memberships;
create policy building_memberships_read on public.building_memberships for select
  using (app.can(auth.uid(), org_id, null, null, 'read')
         or app.can(auth.uid(), null, building_id, null, 'manage'));
drop policy if exists building_memberships_write on public.building_memberships;
create policy building_memberships_write on public.building_memberships for all
  using (app.can(auth.uid(), org_id, null, null, 'manage'))
  with check (app.can(auth.uid(), org_id, null, null, 'manage')
              and app.org_serves_building(org_id, building_id));

drop policy if exists building_modules_read on public.building_modules;
create policy building_modules_read on public.building_modules for select
  using (app.can(auth.uid(), null, building_id, null, 'read'));
drop policy if exists building_modules_write on public.building_modules;
create policy building_modules_write on public.building_modules for all
  using (app.can(auth.uid(), null, building_id, null, 'manage'))
  with check (app.can(auth.uid(), null, building_id, null, 'manage'));

drop policy if exists org_module_access_read on public.organisation_module_access;
create policy org_module_access_read on public.organisation_module_access for select
  using (app.can(auth.uid(), org_id, null, null, 'read')
         or app.can(auth.uid(), null, building_id, null, 'manage'));
drop policy if exists org_module_access_write on public.organisation_module_access;
create policy org_module_access_write on public.organisation_module_access for all
  using (app.can(auth.uid(), null, building_id, null, 'manage'))
  with check (app.can(auth.uid(), null, building_id, null, 'manage'));

-- contracts: parties read; client org admins write
drop policy if exists contracts_read on public.service_contracts;
create policy contracts_read on public.service_contracts for select
  using (app.can(auth.uid(), provider_org_id, null, null, 'read')
         or app.can(auth.uid(), client_org_id, null, null, 'read'));
drop policy if exists contracts_write on public.service_contracts;
create policy contracts_write on public.service_contracts for all
  using (app.can(auth.uid(), client_org_id, null, null, 'admin'))
  with check (app.can(auth.uid(), client_org_id, null, null, 'admin'));

-- audit: reads for org admins/managers (insert policy intentionally unchanged)
drop policy if exists audit_read on public.audit_logs;
create policy audit_read on public.audit_logs for select
  using (app.can(auth.uid(), org_id, null, null, 'manage'));

-- integration credentials: org admins only
drop policy if exists credentials_rw on public.integration_credentials;
create policy credentials_rw on public.integration_credentials for all
  using (app.can(auth.uid(), org_id, null, null, 'admin'))
  with check (app.can(auth.uid(), org_id, null, null, 'admin'));

-- PostgREST exposes only the public schema — thin RPC wrapper for the app.
create or replace function public.can(
  p_user uuid, p_org uuid default null, p_building uuid default null,
  p_module text default null, p_action text default 'read'
) returns boolean
language sql stable security definer set search_path = public, app as $$
  -- callers may only ask about THEMSELVES; the db stays the authority
  select case when p_user = auth.uid()
    then app.can(p_user, p_org, p_building, p_module, p_action)
    else false end
$$;
grant execute on function public.can(uuid, uuid, uuid, text, text)
  to authenticated, service_role;
