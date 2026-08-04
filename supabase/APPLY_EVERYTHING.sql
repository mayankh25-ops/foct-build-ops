-- =============================================================================
-- APPLY_EVERYTHING.sql — GENERATED. Sets up a COMPLETE, EMPTY Supabase project
-- in one paste: platform foundation, theme engine, demo seed, Service Desk,
-- anon hardening, authz, integrations framework, session profile, attendance +
-- kiosk devices, notices, timesheets, roster, per-org isolation, today's attendance, missed check-in alerts, invitations + first-sign-in bootstrap.
--
-- Use when a project has auth users but no tables (or a brand-new project).
-- Idempotent — safe to re-run. Regenerate with: npm run build:apply-everything
-- Afterwards, verify with supabase/tests/session_profile_check.sql (5 ok).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0000_platform_foundation.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0001_theme_engine.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- seed.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0002_service_desk.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0003_anon_hardening.sql
-- ---------------------------------------------------------------------------
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

-- take back everything the project defaults handed out (also from PUBLIC —
-- anon inherits anything granted to the PUBLIC pseudo-role)
revoke all on all tables    in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;

-- and stop future tables from being auto-granted to anon
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- belt-and-braces: revoke per-table explicitly (grantor-independent when run
-- as the table owner), so a silently no-op'd blanket revoke can't leave gaps
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- anon keeps exactly one capability: lodging a ticket via the intake token
grant usage on schema public to anon;
grant execute on function public.sd_lodge_ticket(text, jsonb) to anon;

-- ---------------------------------------------------------------------------
-- seed_service_desk.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0004_authz_can.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0005_integrations_framework.sql
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 0006_session_profile.sql
-- ---------------------------------------------------------------------------
-- 0006 — Stage 2 phase 1: session profile RPC.
-- One SECURITY DEFINER call the app makes after sign-in to learn who the
-- user is: their profile row, active org memberships (org + role), and the
-- buildings those orgs service. Definer bypasses RLS but exposes ONLY the
-- caller's own rows (auth.uid()); returns null when unauthenticated.
-- Idempotent: safe to re-run.

create or replace function public.current_profile()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'user', (
      select jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
      from public.users u where u.id = auth.uid()
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'org_id',   o.id,
        'org_name', o.name,
        'org_slug', o.slug,
        'org_type', ot.key,
        'role',     r.key,
        'role_name', r.name
      ) order by o.name)
      from public.organisation_memberships m
      join public.organisations o      on o.id = m.org_id
      join public.organisation_types ot on ot.id = o.type_id
      join public.roles r              on r.id = m.role_id
      where m.user_id = auth.uid() and m.active
    ), '[]'::jsonb),
    'buildings', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id', b.id, 'name', b.name, 'slug', b.slug
      ))
      from public.building_organisations bo
      join public.buildings b on b.id = bo.building_id
      where bo.org_id in (
        select m.org_id from public.organisation_memberships m
        where m.user_id = auth.uid() and m.active
      ) and bo.active
    ), '[]'::jsonb)
  ) end
$$;

revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- 0007_attendance_kiosk.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0007 — Stage 2 phase 2: attendance + KIOSK DEVICES.
--
-- The kiosk (wall tablet / Android APK) is NOT a logged-in user. It is a
-- provisioned DEVICE: an admin creates it, gets a 6-digit pair code, the
-- device redeems that code once and stores a long-lived device token. From
-- then on it calls three SECURITY DEFINER RPCs and can do NOTHING else:
--   kiosk_pair(code)                  → token + building identity
--   kiosk_staff_search(token, query)  → matching NAMES only (never PINs)
--   kiosk_punch(token, pin, kind, …)  → records a check-in/out
-- PINs never leave the server: the device sends a PIN, the database compares
-- and answers yes/no. A stolen device token can only punch for its own
-- building and can never read rosters, timesheets or other buildings.
--
-- Everything else (staff, shifts, events) is ordinary RLS-protected data
-- visible to the org members who service that building, per app.can().
-- Idempotent — safe to re-run.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- staff ----
create table if not exists public.staff (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  building_id  uuid not null references public.buildings(id) on delete cascade,
  name         text not null,
  role         text not null default 'Cleaner',
  -- 4-digit kiosk PIN, unique per building. Never selected by client code:
  -- reads go through RLS which excludes anon/kiosk, and the kiosk compares
  -- via a definer function instead of fetching.
  pin          text not null check (pin ~ '^[0-9]{4}$'),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists staff_pin_per_building
  on public.staff (building_id, pin) where active;
create index if not exists staff_building_idx on public.staff (building_id) where active;

-- --------------------------------------------------------- kiosk devices ----
create table if not exists public.kiosk_devices (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  org_id       uuid not null references public.organisations(id) on delete cascade,
  label        text not null,                       -- "Cleaners room iPad"
  pair_code    text,                                -- 6 digits, cleared on pair
  pair_expires timestamptz,
  device_token uuid,                                -- issued at pairing
  paired_at    timestamptz,
  last_seen    timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists kiosk_device_token_idx
  on public.kiosk_devices (device_token) where device_token is not null;
create unique index if not exists kiosk_pair_code_idx
  on public.kiosk_devices (pair_code) where pair_code is not null;

-- ---------------------------------------------------------------- shifts ----
create table if not exists public.roster_shifts (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  work_date    date not null,
  start_min    int  not null check (start_min between 0 and 1440),
  end_min      int  not null check (end_min between 0 and 1440),
  zone         text not null default '',
  created_at   timestamptz not null default now(),
  unique (staff_id, work_date, start_min)
);
create index if not exists roster_shifts_building_date_idx
  on public.roster_shifts (building_id, work_date);

-- ---------------------------------------------------------------- events ----
create table if not exists public.attendance_events (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  kind         text not null check (kind in ('in','out')),
  at           timestamptz not null default now(),
  source       text not null default 'kiosk' check (source in ('kiosk','qr','manual')),
  device_id    uuid references public.kiosk_devices(id) on delete set null,
  selfie_path  text,                                  -- Storage object path
  created_at   timestamptz not null default now()
);
create index if not exists attendance_events_building_at_idx
  on public.attendance_events (building_id, at desc);
create index if not exists attendance_events_staff_at_idx
  on public.attendance_events (staff_id, at desc);


-- Who may manage cleaners/devices/shifts at a building? NOT just the owner
-- org: the CLEANING COMPANY manages its own staff at every building it
-- services (multi-org rule — a provider is responsible for its own people).
-- Owner/strata admins keep their authority via app.manages_building.
create or replace function app.manages_staff_at(check_building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or app.manages_building(check_building) or exists (
    select 1
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.active
      and r.key in ('org_admin','manager')
      and app.org_serves_building(m.org_id, check_building)
  )
$$;

-- Which organisation does a cleaner created by THIS caller belong to? The
-- cleaning company's own org, not the building owner's — a cleaner is FOCT
-- Cleaning's employee even though they work in Meridian's tower. Falls back to
-- the owner org for super admins and owner-side admins creating their own.
create or replace function app.managing_org_for(check_building uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.org_id
       from public.organisation_memberships m
       join public.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.active
        and r.key in ('org_admin','manager')
        and app.org_serves_building(m.org_id, check_building)
      limit 1),
    (select owner_org_id from public.buildings where id = check_building))
$$;

-- ------------------------------------------------------------------- RLS ----
alter table public.staff             enable row level security;
alter table public.kiosk_devices     enable row level security;
alter table public.roster_shifts     enable row level security;
alter table public.attendance_events enable row level security;

do $$ begin
  -- staff: readable/writable by org members who service the building
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='staff_read') then
    create policy staff_read on public.staff for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='staff_write') then
    create policy staff_write on public.staff for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='kiosk_devices' and policyname='kiosk_read') then
    create policy kiosk_read on public.kiosk_devices for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='kiosk_devices' and policyname='kiosk_write') then
    create policy kiosk_write on public.kiosk_devices for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='roster_shifts' and policyname='shifts_read') then
    create policy shifts_read on public.roster_shifts for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='roster_shifts' and policyname='shifts_write') then
    create policy shifts_write on public.roster_shifts for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='attendance_events' and policyname='events_read') then
    create policy events_read on public.attendance_events for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  -- events are written by the kiosk RPC (definer) or a manager correcting
  if not exists (select 1 from pg_policies where tablename='attendance_events' and policyname='events_write') then
    create policy events_write on public.attendance_events for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;
end $$;

-- ------------------------------------------------- admin: device pairing ----
-- Creates (or re-issues) a 6-digit pair code valid for 24 hours.
create or replace function public.kiosk_issue_pair_code(p_device uuid)
returns text
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_code text;
begin
  select building_id into v_building from public.kiosk_devices where id = p_device;
  if v_building is null then raise exception 'device not found'; end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.kiosk_devices where pair_code = v_code);
  end loop;
  update public.kiosk_devices
     set pair_code = v_code, pair_expires = now() + interval '24 hours',
         device_token = null, paired_at = null
   where id = p_device;
  return v_code;
end $$;
revoke all on function public.kiosk_issue_pair_code(uuid) from public;
grant execute on function public.kiosk_issue_pair_code(uuid) to authenticated;

-- ------------------------------------------------------- device: pairing ----
-- Redeems a pair code ONCE and returns the device's long-lived token.
create or replace function public.kiosk_pair(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare d record; v_token uuid;
begin
  select k.*, b.name as building_name into d
    from public.kiosk_devices k
    join public.buildings b on b.id = k.building_id
   where k.pair_code = p_code and k.active
     and (k.pair_expires is null or k.pair_expires > now());
  if d is null then return jsonb_build_object('ok', false, 'error', 'Pair code not recognised or expired'); end if;
  v_token := gen_random_uuid();
  update public.kiosk_devices
     set device_token = v_token, paired_at = now(), pair_code = null,
         pair_expires = null, last_seen = now()
   where id = d.id;
  return jsonb_build_object(
    'ok', true, 'device_token', v_token, 'device_label', d.label,
    'building_id', d.building_id, 'building_name', d.building_name);
end $$;
revoke all on function public.kiosk_pair(text) from public;
grant execute on function public.kiosk_pair(text) to anon, authenticated;

-- resolve a token → device row (internal helper)
create or replace function app.kiosk_device(p_token uuid)
returns public.kiosk_devices
language sql stable security definer set search_path = public as $$
  select * from public.kiosk_devices
   where device_token = p_token and active and device_token is not null
$$;

-- --------------------------------------------------- device: name search ----
-- Names only. Never returns PINs — the device cannot learn a credential.
create or replace function public.kiosk_staff_search(p_token uuid, p_query text)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
    into v
    from public.staff s
   where s.building_id = d.building_id and s.active
     and (coalesce(p_query,'') = '' or s.name ilike '%' || p_query || '%')
   limit 12;
  return jsonb_build_object('ok', true, 'staff', v);
end $$;
revoke all on function public.kiosk_staff_search(uuid, text) from public;
grant execute on function public.kiosk_staff_search(uuid, text) to anon, authenticated;

-- -------------------------------------------------------- device: punch ----
-- The whole check-in/out transaction. Validates the PIN server-side, guards
-- against double check-in / check-out with no open shift, and records the
-- event (optionally with a selfie object path uploaded by the device).
create or replace function public.kiosk_punch(
  p_token uuid, p_pin text, p_kind text, p_selfie_path text default null,
  p_staff_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; s public.staff; last_kind text; v_event uuid;
begin
  if p_kind not in ('in','out') then return jsonb_build_object('ok', false, 'error', 'Bad action'); end if;
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;

  select * into s from public.staff
   where building_id = d.building_id and pin = p_pin and active;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'PIN not recognised — check with your supervisor.');
  end if;
  -- when the user picked their name first, the PIN must be theirs
  if p_staff_id is not null and p_staff_id <> s.id then
    return jsonb_build_object('ok', false, 'error', 'That PIN does not match the selected name.');
  end if;

  -- "today" is the BUILDING's day, not UTC's — a 6am Melbourne start is still
  -- the previous UTC date for most of the year.
  select e.kind into last_kind from public.attendance_events e
   where e.staff_id = s.id
     and (e.at at time zone 'Australia/Melbourne')::date
       = (now() at time zone 'Australia/Melbourne')::date
   order by e.at desc limit 1;

  if p_kind = 'in' and last_kind = 'in' then
    return jsonb_build_object('ok', false, 'already', true, 'staff_name', s.name,
      'error', s.name || ', you are already checked in — use Check out when you leave.');
  end if;
  if p_kind = 'out' and (last_kind is null or last_kind = 'out') then
    return jsonb_build_object('ok', false, 'no_open_shift', true, 'staff_name', s.name,
      'error', s.name || ', there is no open shift to check out of — check in first.');
  end if;

  insert into public.attendance_events (building_id, staff_id, kind, source, device_id, selfie_path)
  values (d.building_id, s.id, p_kind, 'kiosk', d.id, p_selfie_path)
  returning id into v_event;

  return jsonb_build_object('ok', true, 'staff_id', s.id, 'staff_name', s.name,
    'kind', p_kind, 'at', now(), 'event_id', v_event);
end $$;
revoke all on function public.kiosk_punch(uuid, text, text, text, uuid) from public;
grant execute on function public.kiosk_punch(uuid, text, text, text, uuid) to anon, authenticated;

-- ------------------------------------------- device: attach the selfie ----
-- The punch answers the cleaner instantly ("you're checked in"); the photo
-- uploads a beat later and is attached here. Only the device that recorded
-- the event may attach to it, only once, and only within ten minutes.
create or replace function public.kiosk_attach_selfie(
  p_token uuid, p_event uuid, p_path text
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v_rows int;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.attendance_events
     set selfie_path = p_path
   where id = p_event and device_id = d.id and selfie_path is null
     and at > now() - interval '10 minutes';
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', v_rows = 1);
end $$;
revoke all on function public.kiosk_attach_selfie(uuid, uuid, text) from public;
grant execute on function public.kiosk_attach_selfie(uuid, uuid, text) to anon, authenticated;

-- ------------------------------------------------- admin: create a cleaner ----
-- Generates a unique non-trivial 4-digit PIN for the building and returns it
-- ONCE for the admin to pass on privately.
create or replace function public.staff_create(
  p_building uuid, p_name text, p_role text default 'Cleaner'
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_pin text; v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff where building_id = p_building and pin = v_pin and active);
  end loop;
  insert into public.staff (org_id, building_id, name, role, pin)
  values (v_org, p_building, trim(p_name), coalesce(nullif(trim(p_role),''),'Cleaner'), v_pin)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'staff_id', v_id, 'name', trim(p_name), 'pin', v_pin);
end $$;
revoke all on function public.staff_create(uuid, text, text) from public;
grant execute on function public.staff_create(uuid, text, text) to authenticated;

-- ------------------------------------------------------ admin: reset a PIN ----
-- PINs are write-only from the app's point of view: nobody can look one up, so
-- "they forgot it" is answered by issuing a new one and reading it out once.
create or replace function public.staff_reset_pin(p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_pin text;
begin
  select building_id into v_building from public.staff where id = p_staff;
  if v_building is null then raise exception 'staff not found'; end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff
                       where building_id = v_building and pin = v_pin and active and id <> p_staff);
  end loop;
  update public.staff set pin = v_pin where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- --------------------------------------------- admin: provision a kiosk ----
-- One call creates the device and hands back the code to type into the tablet.
create or replace function public.kiosk_device_create(p_building uuid, p_label text)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_code text;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  insert into public.kiosk_devices (building_id, org_id, label)
  values (p_building, app.managing_org_for(p_building),
          coalesce(nullif(trim(p_label),''), 'Kiosk'))
  returning id into v_id;
  v_code := public.kiosk_issue_pair_code(v_id);
  return jsonb_build_object('ok', true, 'device_id', v_id, 'pair_code', v_code);
end $$;
revoke all on function public.kiosk_device_create(uuid, text) from public;
grant execute on function public.kiosk_device_create(uuid, text) to authenticated;

-- ------------------------------------------- reporting: paired attendance ----
-- The raw table is a stream of in/out punches; a timesheet needs SESSIONS.
-- This pairs each 'in' with the next event for that cleaner on that building
-- day and returns worked minutes, so the timesheet screen never has to guess.
-- An unpaired 'in' comes back with out_at null (still on site, or forgot).
create or replace function public.attendance_sessions(
  p_building uuid, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.device_id, e.source,
           (e.at at time zone 'Australia/Melbourne')::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone 'Australia/Melbourne')::date between p_from and p_to
  ), paired as (
    select ev.*,
           lead(ev.kind)        over w as next_kind,
           lead(ev.at)          over w as next_at,
           lead(ev.selfie_path) over w as next_selfie
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id',    p.staff_id,
           'staff_name',  s.name,
           'role',        s.role,
           'work_date',   p.work_date,
           'in_at',       p.at,
           'out_at',      case when p.next_kind = 'out' then p.next_at end,
           'minutes',     case when p.next_kind = 'out'
                            then round(extract(epoch from (p.next_at - p.at)) / 60)::int end,
           'in_selfie',   p.selfie_path,
           'out_selfie',  case when p.next_kind = 'out' then p.next_selfie end,
           'source',      p.source,
           'device_id',   p.device_id)
           order by p.work_date desc, p.at desc), '[]'::jsonb)
    into v
    from paired p
    join public.staff s on s.id = p.staff_id
   where p.kind = 'in';
  return jsonb_build_object('ok', true, 'sessions', v);
end $$;
revoke all on function public.attendance_sessions(uuid, date, date) from public;
grant execute on function public.attendance_sessions(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 0008_kiosk_selfie_storage.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0008 — Storage bucket for kiosk sign-in/out selfies.
--
-- The 3-2-1 selfie is proof of attendance, so it has to survive the tablet. It
-- lands in a PRIVATE bucket at  <building_id>/<staff_id>/<uuid>.jpg  and the
-- path is recorded on the attendance event.
--
-- Trade-off, stated plainly: the kiosk is not a logged-in user, so the bucket
-- must accept an INSERT from the `anon` role. That is the only thing anon may
-- do — it cannot list, read, overwrite or delete anything, the bucket is
-- capped at 2 MB per object and restricted to JPEG/PNG/WebP. Reading a selfie
-- requires a signed URL issued to an authenticated member of that building.
--
-- Guarded so it is a no-op on a plain Postgres mirror (no `storage` schema).
-- Idempotent — safe to re-run.
-- =============================================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice '0008: no storage schema (local mirror) — skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('kiosk-selfies', 'kiosk-selfies', false, 2097152,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg','image/png','image/webp'];

  -- write-only for the kiosk
  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'kiosk_selfie_insert') then
    execute $p$
      create policy kiosk_selfie_insert on storage.objects for insert to anon, authenticated
        with check (bucket_id = 'kiosk-selfies')
    $p$;
  end if;

  -- readable only by someone who may see that building's data
  if not exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'kiosk_selfie_read') then
    execute $p$
      create policy kiosk_selfie_read on storage.objects for select to authenticated
        using (bucket_id = 'kiosk-selfies'
               and app.can_access_building(
                     nullif(substring((storage.foldername(name))[1]
                                      from '^[0-9a-fA-F-]{36}$'), '')::uuid))
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0009_kiosk_notices.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0009 — Kiosk sign-in v1: notices, offline sync, per-site language.
--
-- Three things this adds to the kiosk built in 0007:
--
-- 1. NOTICES. Either general (everyone at a site) or personal (one employee),
--    with a date range, an optional daily time window, a priority, an optional
--    "must acknowledge", and a body stored as a per-language JSON map so one
--    notice carries English, Hindi, Punjabi… The acknowledgement record is
--    also the hook the future induction module hangs on.
--
-- 2. OFFLINE SYNC. A cleaners' room is a basement. The tablet caches what it
--    needs (kiosk_bootstrap), records sign-ins locally, and pushes them later
--    (kiosk_sync). Every event carries a client-generated UUID and the server
--    upserts on it, so replaying a batch after a flaky connection can never
--    double-punch anyone.
--
-- 3. OFFLINE PIN VERIFICATION. The tablet caches a bcrypt hash per employee,
--    never a PIN. Stated plainly: a 4-digit PIN is only 10,000 possibilities,
--    so this raises the cost of extracting one from a stolen tablet from
--    "read the file" to "hours of compute per person" — it does not make it
--    impossible. The real mitigations remain: retire the device (kills its
--    token instantly), reset the PIN, and the fact that a PIN alone only ever
--    permits punching in and out at one building.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- pgcrypto lives in the `extensions` schema on Supabase and in `public` on a
-- plain Postgres. `create extension if not exists` therefore does NOT
-- guarantee it is reachable from a function with a pinned search_path — which
-- is exactly how staff_create failed with
--     function gen_salt(unknown, integer) does not exist
-- The two helpers below are the single place that has to know this, and every
-- caller goes through them.
create extension if not exists pgcrypto;

create or replace function app.hash_pin(p_pin text) returns text
language sql volatile security definer
set search_path = public, extensions, pg_temp as $$
  select crypt(p_pin, gen_salt('bf', 10))
$$;

create or replace function app.pin_matches(p_pin text, p_hash text) returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  select p_hash is not null and p_hash = crypt(p_pin, p_hash)
$$;
revoke all on function app.hash_pin(text) from public;
revoke all on function app.pin_matches(text, text) from public;

-- ------------------------------------------------------- site settings ----
alter table public.buildings
  add column if not exists timezone text not null default 'Australia/Melbourne';
alter table public.buildings
  add column if not exists default_language text not null default 'en';

-- ------------------------------------------------------------- staff ------
alter table public.staff add column if not exists preferred_language text;
-- bcrypt of the PIN, for OFFLINE verification on the tablet. Online, the
-- server still compares the PIN itself (0007's kiosk_punch) and this is unused.
alter table public.staff add column if not exists pin_hash text;

-- --------------------------------------------------- attendance events ----
alter table public.attendance_events
  add column if not exists client_event_id uuid;
alter table public.attendance_events
  add column if not exists recorded_offline boolean not null default false;
-- what the tablet's own clock said, kept alongside `at` so a manager can see
-- when a device's time was wrong
alter table public.attendance_events
  add column if not exists device_time timestamptz;

-- THE idempotency guarantee: the same client event can only ever land once.
create unique index if not exists attendance_client_event_idx
  on public.attendance_events (client_event_id) where client_event_id is not null;


-- ---------------------------------------------------------- notices -------
create table if not exists public.notices (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  -- null = general (everyone at this site); set = personal to one employee
  staff_id      uuid references public.staff(id) on delete cascade,
  title         jsonb not null default '{}'::jsonb,  -- {"en": "...", "hi": "..."}
  body          jsonb not null,                      -- {"en": "...", "hi": "..."}
  priority      text not null default 'info'
                check (priority in ('info','important','urgent')),
  starts_on     date not null default current_date,
  ends_on       date,                                -- null = until switched off
  -- optional daily window, e.g. morning shift only (minutes from midnight)
  start_min     int check (start_min between 0 and 1440),
  end_min       int check (end_min between 0 and 1440),
  requires_ack  boolean not null default false,
  -- bumped when the text materially changes, so a re-issued notice
  -- re-prompts someone who already acknowledged the previous wording
  version       int not null default 1,
  active        boolean not null default true,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (body <> '{}'::jsonb),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists notices_building_idx
  on public.notices (building_id, starts_on desc) where active;
create index if not exists notices_staff_idx
  on public.notices (staff_id) where active and staff_id is not null;

create table if not exists public.notice_acks (
  id            uuid primary key default gen_random_uuid(),
  notice_id     uuid not null references public.notices(id) on delete cascade,
  staff_id      uuid not null references public.staff(id) on delete cascade,
  notice_version int not null default 1,
  acked_at      timestamptz not null default now(),
  device_id     uuid references public.kiosk_devices(id) on delete set null,
  unique (notice_id, staff_id, notice_version)
);

-- ------------------------------------------------------------- RLS --------
alter table public.notices     enable row level security;
alter table public.notice_acks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='notices' and policyname='notices_read') then
    create policy notices_read on public.notices for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='notices' and policyname='notices_write') then
    create policy notices_write on public.notices for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='notice_acks' and policyname='notice_acks_read') then
    create policy notice_acks_read on public.notice_acks for select to authenticated
      using (exists (select 1 from public.notices n
                      where n.id = notice_id and app.can_access_building(n.building_id)));
  end if;
  -- acknowledgements are written by the kiosk RPC (definer); a manager may
  -- correct one at the building they manage
  if not exists (select 1 from pg_policies where tablename='notice_acks' and policyname='notice_acks_write') then
    create policy notice_acks_write on public.notice_acks for all to authenticated
      using (exists (select 1 from public.notices n
                      where n.id = notice_id and app.manages_staff_at(n.building_id)))
      with check (exists (select 1 from public.notices n
                      where n.id = notice_id and app.manages_staff_at(n.building_id)));
  end if;
end $$;

create or replace function public.notices_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  -- a changed body is a changed notice: bump the version so anyone who
  -- acknowledged the old wording is asked again
  if tg_op = 'UPDATE' and new.body is distinct from old.body then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
drop trigger if exists notices_touch on public.notices;
create trigger notices_touch before update on public.notices
  for each row execute function public.notices_touch();


-- ================================================== admin: write a PIN ====
-- 0007's staff_create / staff_reset_pin now also store the bcrypt hash the
-- tablet needs offline. Cost 10 ≈ 100 ms per guess: 10,000 PIN candidates is
-- a ~17-minute job per person, not an instant one.
create or replace function public.staff_create(
  p_building uuid, p_name text, p_role text default 'Cleaner'
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_pin text; v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff where building_id = p_building and pin = v_pin and active);
  end loop;
  insert into public.staff (org_id, building_id, name, role, pin, pin_hash)
  values (v_org, p_building, trim(p_name), coalesce(nullif(trim(p_role),''),'Cleaner'),
          v_pin, app.hash_pin(v_pin))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'staff_id', v_id, 'name', trim(p_name), 'pin', v_pin);
end $$;
revoke all on function public.staff_create(uuid, text, text) from public;
grant execute on function public.staff_create(uuid, text, text) to authenticated;

create or replace function public.staff_reset_pin(p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_pin text;
begin
  select building_id into v_building from public.staff where id = p_staff;
  if v_building is null then raise exception 'staff not found'; end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff
                       where building_id = v_building and pin = v_pin and active and id <> p_staff);
  end loop;
  update public.staff set pin = v_pin, pin_hash = app.hash_pin(v_pin) where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- backfill hashes for anyone created before this migration
update public.staff set pin_hash = app.hash_pin(pin)
 where pin_hash is null;


-- =============================================== which notices apply? =====
-- One definition of "showing now", used by every caller so the tablet and the
-- admin screen can never disagree about what a cleaner is being told.
create or replace function app.notice_is_current(n public.notices, at_time timestamptz, tz text)
returns boolean
language sql stable as $$
  select n.active
     and (at_time at time zone tz)::date >= n.starts_on
     and (n.ends_on is null or (at_time at time zone tz)::date <= n.ends_on)
     and (n.start_min is null
          or extract(hour from (at_time at time zone tz)) * 60
             + extract(minute from (at_time at time zone tz)) >= n.start_min)
     and (n.end_min is null
          or extract(hour from (at_time at time zone tz)) * 60
             + extract(minute from (at_time at time zone tz)) <= n.end_min)
$$;


-- ================================================ device: bootstrap ======
-- Everything the tablet caches, in one call: site, employees (names + PIN
-- HASHES, never PINs), the general notices, and the server's clock so the
-- device can measure its own drift.
create or replace function public.kiosk_bootstrap(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v_staff jsonb; v_notices jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'pin_hash', s.pin_hash,
           'language', coalesce(s.preferred_language, b.default_language)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = d.building_id and s.active;

  -- general notices only; personal ones are fetched after a sign-in so they
  -- are never cached on a device where the wrong person could read them
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'title', n.title, 'body', n.body,
           'priority', n.priority, 'requires_ack', n.requires_ack,
           'version', n.version,
           'starts_on', n.starts_on, 'ends_on', n.ends_on,
           'start_min', n.start_min, 'end_min', n.end_min
         ) order by
           case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
           n.created_at desc), '[]'::jsonb)
    into v_notices
    from public.notices n
   where n.building_id = d.building_id and n.active and n.staff_id is null
     and (n.ends_on is null or n.ends_on >= (now() at time zone b.timezone)::date);

  return jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'device', jsonb_build_object('id', d.id, 'label', d.label),
    'site', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone,
                               'default_language', b.default_language),
    'staff', v_staff,
    'notices', v_notices);
end $$;
revoke all on function public.kiosk_bootstrap(uuid) from public;
grant execute on function public.kiosk_bootstrap(uuid) to anon, authenticated;


-- ============================================ device: notices for one =====
-- Called right after a sign-in: the general notices showing now, plus that
-- person's own, plus whether they still need to acknowledge each.
create or replace function public.notices_for_staff(p_token uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = d.building_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Unknown employee');
  end if;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(x order by x_rank, x_created desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
               'id', n.id, 'title', n.title, 'body', n.body,
               'priority', n.priority, 'personal', n.staff_id is not null,
               'requires_ack', n.requires_ack, 'version', n.version,
               'acked', exists (select 1 from public.notice_acks a
                                 where a.notice_id = n.id and a.staff_id = p_staff
                                   and a.notice_version = n.version)
             ) as x,
             case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end as x_rank,
             n.created_at as x_created
        from public.notices n
       where n.building_id = d.building_id
         and (n.staff_id is null or n.staff_id = p_staff)
         and app.notice_is_current(n, now(), b.timezone)
    ) s;

  return jsonb_build_object('ok', true, 'notices', v);
end $$;
revoke all on function public.notices_for_staff(uuid, uuid) from public;
grant execute on function public.notices_for_staff(uuid, uuid) to anon, authenticated;


-- ================================================ device: acknowledge =====
create or replace function public.notice_ack(p_token uuid, p_notice uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v_version int;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  select n.version into v_version from public.notices n
   where n.id = p_notice and n.building_id = d.building_id
     and (n.staff_id is null or n.staff_id = p_staff);
  if v_version is null then return jsonb_build_object('ok', false, 'error', 'Notice not found here'); end if;

  insert into public.notice_acks (notice_id, staff_id, notice_version, device_id)
  values (p_notice, p_staff, v_version, d.id)
  on conflict (notice_id, staff_id, notice_version) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.notice_ack(uuid, uuid, uuid) from public;
grant execute on function public.notice_ack(uuid, uuid, uuid) to anon, authenticated;


-- ================================================== device: sync ==========
-- Push a batch of events recorded while the tablet had no network.
--
-- The PIN was verified on the device against the cached hash, so this trusts
-- the device token for identity — which is exactly as strong as the tablet
-- itself. Three things bound the damage: events must name a staff member at
-- THIS device's building, they cannot be dated in the future or more than 14
-- days back, and every one is stamped `recorded_offline` so a manager can see
-- which times came from an unsynced device.
--
-- Returns a verdict per event; the tablet deletes only what came back ok.
create or replace function public.kiosk_sync(p_token uuid, p_events jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  d public.kiosk_devices;
  e jsonb;
  v_results jsonb := '[]'::jsonb;
  v_client uuid; v_staff uuid; v_kind text; v_at timestamptz; v_id uuid;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;

  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_client := nullif(e ->> 'client_event_id', '')::uuid;
    v_staff  := nullif(e ->> 'staff_id', '')::uuid;
    v_kind   := e ->> 'kind';
    v_at     := nullif(e ->> 'device_time', '')::timestamptz;

    if v_client is null or v_staff is null or v_kind not in ('in','out') or v_at is null then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Malformed event');
      continue;
    end if;
    if v_at > now() + interval '5 minutes' or v_at < now() - interval '14 days' then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Timestamp out of range');
      continue;
    end if;
    if not exists (select 1 from public.staff
                    where id = v_staff and building_id = d.building_id and active) then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Unknown employee for this site');
      continue;
    end if;

    -- upsert on the client's own id: replaying a batch is a no-op, never a
    -- second punch
    insert into public.attendance_events
      (building_id, staff_id, kind, at, source, device_id, selfie_path,
       client_event_id, recorded_offline, device_time)
    values
      (d.building_id, v_staff, v_kind, v_at, 'kiosk', d.id, nullif(e ->> 'selfie_path', ''),
       v_client, coalesce((e ->> 'recorded_offline')::boolean, true), v_at)
    -- the index is partial, so the predicate has to be repeated here for
    -- Postgres to infer it
    on conflict (client_event_id) where client_event_id is not null do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.attendance_events where client_event_id = v_client;
    end if;
    v_results := v_results || jsonb_build_object(
      'client_event_id', v_client, 'ok', true, 'event_id', v_id);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results, 'server_time', now());
end $$;
revoke all on function public.kiosk_sync(uuid, jsonb) from public;
grant execute on function public.kiosk_sync(uuid, jsonb) to anon, authenticated;


-- =========================== online punch keeps the same idempotency ======
-- Same contract as 0007 plus an optional client id, so a retried request over
-- a bad connection lands once. Superseded signature is dropped to keep the
-- catalogue honest.
drop function if exists public.kiosk_punch(uuid, text, text, text, uuid);
create or replace function public.kiosk_punch(
  p_token uuid, p_pin text, p_kind text, p_selfie_path text default null,
  p_staff_id uuid default null, p_client_event_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; s public.staff; last_kind text; v_event uuid; b public.buildings;
begin
  if p_kind not in ('in','out') then return jsonb_build_object('ok', false, 'error', 'Bad action'); end if;
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  -- an already-recorded client event is answered, not repeated
  if p_client_event_id is not null then
    select id into v_event from public.attendance_events where client_event_id = p_client_event_id;
    if v_event is not null then
      select * into s from public.staff where id =
        (select staff_id from public.attendance_events where id = v_event);
      return jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event,
        'staff_id', s.id, 'staff_name', s.name, 'kind', p_kind);
    end if;
  end if;

  select * into s from public.staff
   where building_id = d.building_id and pin = p_pin and active;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'PIN not recognised — check with your supervisor.');
  end if;
  if p_staff_id is not null and p_staff_id <> s.id then
    return jsonb_build_object('ok', false, 'error', 'That PIN does not match the selected name.');
  end if;

  -- "today" is the BUILDING's day, not UTC's
  select e.kind into last_kind from public.attendance_events e
   where e.staff_id = s.id
     and (e.at at time zone b.timezone)::date = (now() at time zone b.timezone)::date
   order by e.at desc limit 1;

  if p_kind = 'in' and last_kind = 'in' then
    return jsonb_build_object('ok', false, 'already', true, 'staff_name', s.name,
      'error', s.name || ', you are already checked in — use Check out when you leave.');
  end if;
  if p_kind = 'out' and (last_kind is null or last_kind = 'out') then
    return jsonb_build_object('ok', false, 'no_open_shift', true, 'staff_name', s.name,
      'error', s.name || ', there is no open shift to check out of — check in first.');
  end if;

  insert into public.attendance_events
    (building_id, staff_id, kind, source, device_id, selfie_path, client_event_id)
  values (d.building_id, s.id, p_kind, 'kiosk', d.id, p_selfie_path, p_client_event_id)
  returning id into v_event;

  return jsonb_build_object('ok', true, 'staff_id', s.id, 'staff_name', s.name,
    'kind', p_kind, 'at', now(), 'event_id', v_event);
end $$;
revoke all on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) from public;
grant execute on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 0010_timesheets.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0010 — Timesheets: the hours a cleaner is actually paid for.
--
-- The kiosk records punches (0007/0009). This turns them into a week a manager
-- can read, correct, approve or reject, and export — and makes that decision a
-- durable record rather than a screen state.
--
-- Two tables and three rules:
--
--   attendance_adjustments — a manager's +/- correction to ONE worked session,
--     always with a reason. The punches themselves are never edited: what the
--     tablet recorded stays exactly as recorded, and the correction sits beside
--     it. If a payroll query ever arises, both numbers survive.
--
--   timesheet_weeks — the decision: pending → approved / rejected, with who
--     decided, when, the paid figure and a note. Reopening is allowed and
--     recorded; silently changing an approved week is not.
--
--   RULE: an APPROVED week is locked. Corrections are refused until someone
--   reopens it. That is the difference between a record and a spreadsheet.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ------------------------------------------------------ per-session ------
create table if not exists public.attendance_adjustments (
  id             uuid primary key default gen_random_uuid(),
  -- the CHECK-IN event identifies the session; its check-out is whatever
  -- follows it that day (see attendance_sessions)
  session_event_id uuid not null unique
                   references public.attendance_events(id) on delete cascade,
  building_id    uuid not null references public.buildings(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  delta_minutes  int not null check (delta_minutes between -1440 and 1440),
  note           text not null default '',
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists attendance_adjustments_staff_idx
  on public.attendance_adjustments (building_id, staff_id);

-- --------------------------------------------------------- the week -----
create table if not exists public.timesheet_weeks (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  -- Monday of the week, in the BUILDING's timezone
  week_start     date not null,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  /** what payroll pays: derived hours + corrections, or a manager's override */
  approved_minutes int,
  note           text not null default '',
  decided_by     uuid references public.users(id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (building_id, staff_id, week_start)
);
create index if not exists timesheet_weeks_lookup
  on public.timesheet_weeks (building_id, week_start);

-- ------------------------------------------------------------- RLS ------
alter table public.attendance_adjustments enable row level security;
alter table public.timesheet_weeks        enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='attendance_adjustments' and policyname='adjustments_read') then
    create policy adjustments_read on public.attendance_adjustments for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance_adjustments' and policyname='adjustments_write') then
    create policy adjustments_write on public.attendance_adjustments for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='timesheet_weeks' and policyname='timesheet_read') then
    create policy timesheet_read on public.timesheet_weeks for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='timesheet_weeks' and policyname='timesheet_write') then
    create policy timesheet_write on public.timesheet_weeks for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;
end $$;

-- Monday of the week containing a date, in the building's own timezone.
create or replace function app.week_start(p_building uuid, p_when timestamptz default now())
returns date
language sql stable security definer set search_path = public as $$
  select (date_trunc('week', p_when at time zone
           coalesce((select timezone from public.buildings where id = p_building),
                    'Australia/Melbourne')))::date
$$;


-- ============================================ the week, as payroll sees it ===
-- One call returns everything the timesheet screen and the CSV export need, so
-- the two can never disagree: per-person sessions with their corrections, the
-- rostered comparison, and the current decision.
create or replace function public.timesheet_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_rows jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.recorded_offline, e.source,
           (e.at at time zone v_tz)::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone v_tz)::date
             between p_week_start and p_week_start + 6
  ), paired as (
    select ev.*,
           lead(ev.kind) over w as next_kind,
           lead(ev.at)   over w as next_at
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  ), sessions as (
    select p.id as session_event_id, p.staff_id, p.work_date, p.at as in_at,
           case when p.next_kind = 'out' then p.next_at end as out_at,
           case when p.next_kind = 'out'
                then round(extract(epoch from (p.next_at - p.at)) / 60)::int end as minutes,
           p.recorded_offline, p.selfie_path, p.source
      from paired p
     where p.kind = 'in'
  ), rostered as (
    select r.staff_id, sum(r.end_min - r.start_min)::int as minutes
      from public.roster_shifts r
     where r.building_id = p_building
       and r.work_date between p_week_start and p_week_start + 6
     group by r.staff_id
  )
  select coalesce(jsonb_agg(x order by x ->> 'staff_name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'staff_id',   s.id,
      'staff_name', s.name,
      'role',       s.role,
      'active',     s.active,
      'rostered_minutes', coalesce(ro.minutes, 0),
      -- a session still open (no check-out) contributes nothing to pay yet,
      -- but is reported so a manager can see and correct it
      'worked_minutes', coalesce((select sum(se.minutes) from sessions se where se.staff_id = s.id), 0),
      'adjustment_minutes', coalesce((
          select sum(a.delta_minutes) from public.attendance_adjustments a
           join sessions se2 on se2.session_event_id = a.session_event_id
          where a.staff_id = s.id), 0),
      'open_sessions', (select count(*) from sessions se where se.staff_id = s.id and se.out_at is null),
      'status',           coalesce(w.status, 'pending'),
      'approved_minutes', w.approved_minutes,
      'note',             coalesce(w.note, ''),
      'decided_at',       w.decided_at,
      'decided_by',       (select u.name from public.users u where u.id = w.decided_by),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'session_event_id', se.session_event_id,
                 'work_date', se.work_date,
                 'in_at', se.in_at,
                 'out_at', se.out_at,
                 'minutes', se.minutes,
                 'recorded_offline', se.recorded_offline,
                 'selfie_path', se.selfie_path,
                 'adjustment_minutes', coalesce(a.delta_minutes, 0),
                 'adjustment_note', coalesce(a.note, '')
               ) order by se.in_at)
          from sessions se
          left join public.attendance_adjustments a on a.session_event_id = se.session_event_id
         where se.staff_id = s.id), '[]'::jsonb)
    ) as x
    from public.staff s
    left join rostered ro on ro.staff_id = s.id
    left join public.timesheet_weeks w
           on w.staff_id = s.id and w.building_id = p_building and w.week_start = p_week_start
    where s.building_id = p_building
      and (s.active
           or exists (select 1 from sessions se where se.staff_id = s.id)
           or w.id is not null)
  ) rows;

  return jsonb_build_object(
    'ok', true,
    'week_start', p_week_start,
    'timezone', v_tz,
    'rows', v_rows);
end $$;
revoke all on function public.timesheet_week(uuid, date) from public;
grant execute on function public.timesheet_week(uuid, date) to authenticated;


-- ================================================= correct one session =====
-- Never edits the punch. Adds (or replaces) a signed correction beside it,
-- with a reason, and refuses once the week is approved.
create or replace function public.attendance_adjust(
  p_session_event uuid, p_delta_minutes int, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare e public.attendance_events; v_week date; v_status text;
begin
  select * into e from public.attendance_events where id = p_session_event;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'Session not found'); end if;
  if not app.manages_staff_at(e.building_id) then raise exception 'not permitted'; end if;
  if e.kind <> 'in' then
    return jsonb_build_object('ok', false, 'error', 'Corrections attach to a check-in');
  end if;
  if coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A correction needs a reason');
  end if;

  v_week := app.week_start(e.building_id, e.at);
  select status into v_status from public.timesheet_weeks
   where building_id = e.building_id and staff_id = e.staff_id and week_start = v_week;
  if v_status = 'approved' then
    return jsonb_build_object('ok', false, 'locked', true,
      'error', 'That week is approved — reopen it before changing hours.');
  end if;

  if p_delta_minutes = 0 then
    delete from public.attendance_adjustments where session_event_id = p_session_event;
    return jsonb_build_object('ok', true, 'removed', true);
  end if;

  insert into public.attendance_adjustments
    (session_event_id, building_id, staff_id, delta_minutes, note, created_by)
  values (p_session_event, e.building_id, e.staff_id, p_delta_minutes, trim(p_note), auth.uid())
  on conflict (session_event_id) do update
    set delta_minutes = excluded.delta_minutes,
        note = excluded.note,
        created_by = excluded.created_by,
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.attendance_adjust(uuid, int, text) from public;
grant execute on function public.attendance_adjust(uuid, int, text) to authenticated;


-- =================================================== approve / reject =====
-- One entry point for every decision, so the audit trail is uniform:
--   'approved' — pays approved_minutes (defaults to worked + corrections)
--   'rejected' — sent back, always with a reason
--   'pending'  — reopened, which clears the previous decision
create or replace function public.timesheet_decide(
  p_building uuid, p_staff uuid, p_week_start date,
  p_status text, p_minutes int default null, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_minutes int; v_open int;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_status not in ('pending','approved','rejected') then
    return jsonb_build_object('ok', false, 'error', 'Unknown decision');
  end if;
  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building) then
    return jsonb_build_object('ok', false, 'error', 'Unknown employee for this site');
  end if;
  -- a rejection without a reason is not a rejection, it is a mystery
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Say why it is being sent back');
  end if;

  if p_status = 'approved' then
    select ((r ->> 'worked_minutes')::int + (r ->> 'adjustment_minutes')::int),
           (r ->> 'open_sessions')::int
      into v_minutes, v_open
      from jsonb_array_elements(public.timesheet_week(p_building, p_week_start) -> 'rows') r
     where (r ->> 'staff_id')::uuid = p_staff;
    v_minutes := coalesce(p_minutes, v_minutes, 0);
    if v_minutes < 0 then v_minutes := 0; end if;
  else
    v_minutes := null;
  end if;

  insert into public.timesheet_weeks
    (building_id, staff_id, week_start, status, approved_minutes, note, decided_by, decided_at)
  values (p_building, p_staff, p_week_start, p_status, v_minutes,
          coalesce(trim(p_note), ''),
          case when p_status = 'pending' then null else auth.uid() end,
          case when p_status = 'pending' then null else now() end)
  on conflict (building_id, staff_id, week_start) do update
    set status = excluded.status,
        approved_minutes = excluded.approved_minutes,
        note = excluded.note,
        decided_by = excluded.decided_by,
        decided_at = excluded.decided_at,
        updated_at = now();

  return jsonb_build_object('ok', true, 'status', p_status,
    'approved_minutes', v_minutes,
    -- worth saying out loud rather than silently paying zero for it
    'open_sessions', coalesce(v_open, 0));
end $$;
revoke all on function public.timesheet_decide(uuid, uuid, date, text, int, text) from public;
grant execute on function public.timesheet_decide(uuid, uuid, date, text, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0011_roster.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0011 — Roster: who is meant to be here, and when.
--
-- `roster_shifts` already exists (0007) with RLS. What was missing is the part
-- that keeps it honest:
--
--   * a shift must END AFTER it starts, and may not overlap another shift for
--     the same person on the same day — you cannot roster someone twice at
--     once, and a manager who tries deserves to be told, not to have it
--     silently accepted;
--   * one write path (`roster_shift_set`) that validates and returns a reason,
--     so the screen never has to guess what went wrong;
--   * `roster_week()` so the board and the timesheet's "rostered" figure read
--     the same rows;
--   * `roster_copy_week()`, because a cleaning roster is the same most weeks
--     and retyping it is how mistakes get in.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- 0007 allowed 0..1440 on each end but never compared them.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'roster_shifts_end_after_start'
       and conrelid = 'public.roster_shifts'::regclass
  ) then
    -- clean up anything already inverted, so the constraint can be trusted
    delete from public.roster_shifts where end_min <= start_min;
    alter table public.roster_shifts
      add constraint roster_shifts_end_after_start check (end_min > start_min);
  end if;
end $$;

alter table public.roster_shifts add column if not exists note text not null default '';

-- The overlap rule lives in the database, not the form: two managers editing
-- the same week from two laptops cannot both win.
create or replace function public.roster_no_overlap() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.roster_shifts r
     where r.staff_id = new.staff_id
       and r.work_date = new.work_date
       and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
       and new.start_min < r.end_min
       and r.start_min < new.end_min
  ) then
    raise exception 'overlapping shift'
      using errcode = 'check_violation',
            hint = 'This person is already rostered over that time on that day.';
  end if;
  return new;
end $$;

drop trigger if exists roster_no_overlap on public.roster_shifts;
create trigger roster_no_overlap before insert or update on public.roster_shifts
  for each row execute function public.roster_no_overlap();


-- ============================================================ the week =====
-- One call for the board: every shift in the week, every person who could be
-- rostered, and the totals the timesheet compares against.
create or replace function public.roster_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_shifts jsonb; v_staff jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'staff_id', r.staff_id,
           'staff_name', s.name,
           'work_date', r.work_date,
           'start_min', r.start_min,
           'end_min', r.end_min,
           'minutes', r.end_min - r.start_min,
           'zone', r.zone,
           'note', r.note
         ) order by r.work_date, r.start_min), '[]'::jsonb)
    into v_shifts
    from public.roster_shifts r
    join public.staff s on s.id = r.staff_id
   where r.building_id = p_building
     and r.work_date between p_week_start and p_week_start + 6;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'rostered_minutes', coalesce((
             select sum(r.end_min - r.start_min) from public.roster_shifts r
              where r.staff_id = s.id
                and r.work_date between p_week_start and p_week_start + 6), 0)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = p_building and s.active;

  return jsonb_build_object(
    'ok', true, 'week_start', p_week_start, 'timezone', v_tz,
    'staff', v_staff, 'shifts', v_shifts);
end $$;
revoke all on function public.roster_week(uuid, date) from public;
grant execute on function public.roster_week(uuid, date) to authenticated;


-- ==================================================== create / update =====
-- p_id null creates; otherwise updates that shift. Returns a reason rather
-- than a Postgres error string when something is wrong.
create or replace function public.roster_shift_set(
  p_building uuid, p_staff uuid, p_work_date date,
  p_start_min int, p_end_min int, p_zone text default '', p_note text default '',
  p_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_end_min <= p_start_min then
    return jsonb_build_object('ok', false, 'error', 'The finish time must be after the start time.');
  end if;
  if p_start_min < 0 or p_end_min > 1440 then
    return jsonb_build_object('ok', false, 'error', 'Times must be inside one day.');
  end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = p_building and active) then
    return jsonb_build_object('ok', false, 'error', 'That person does not work at this site.');
  end if;

  begin
    if p_id is null then
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, p_staff, p_work_date, p_start_min, p_end_min,
              coalesce(p_zone, ''), coalesce(p_note, ''))
      returning id into v_id;
    else
      update public.roster_shifts
         set staff_id = p_staff, work_date = p_work_date,
             start_min = p_start_min, end_min = p_end_min,
             zone = coalesce(p_zone, ''), note = coalesce(p_note, '')
       where id = p_id and building_id = p_building
      returning id into v_id;
      if v_id is null then
        return jsonb_build_object('ok', false, 'error', 'That shift no longer exists.');
      end if;
    end if;
  exception
    when check_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They are already rostered over that time that day.');
    when unique_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They already have a shift starting at that time.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) from public;
grant execute on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) to authenticated;


create or replace function public.roster_shift_delete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid;
begin
  select building_id into v_building from public.roster_shifts where id = p_id;
  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  delete from public.roster_shifts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.roster_shift_delete(uuid) from public;
grant execute on function public.roster_shift_delete(uuid) to authenticated;


-- ======================================================= copy a week =====
-- A cleaning roster is the same most weeks. Copying is additive and skips
-- anything that would clash, then REPORTS how many it skipped — silently
-- dropping shifts would be worse than refusing outright.
create or replace function public.roster_copy_week(
  p_building uuid, p_from_week date, p_to_week date
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare r record; v_offset int; v_copied int := 0; v_skipped int := 0;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_from_week = p_to_week then
    return jsonb_build_object('ok', false, 'error', 'Pick a different week to copy into.');
  end if;
  v_offset := p_to_week - p_from_week;

  for r in
    select * from public.roster_shifts
     where building_id = p_building
       and work_date between p_from_week and p_from_week + 6
     order by work_date, start_min
  loop
    begin
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, r.staff_id, r.work_date + v_offset,
              r.start_min, r.end_min, r.zone, r.note);
      v_copied := v_copied + 1;
    exception when check_violation or unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'copied', v_copied, 'skipped', v_skipped);
end $$;
revoke all on function public.roster_copy_week(uuid, date, date) from public;
grant execute on function public.roster_copy_week(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 0012_org_isolation.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0012 — THE ISOLATION FIX. Staff records belong to their employer, not to the
-- building.
--
-- WHAT WAS WRONG
-- 0007–0011 gated every staff-related READ on `app.can_access_building()` —
-- "are you attached to this building". At a real tower that is the concierge
-- company, the strata manager, an electrical subcontractor and every other
-- cleaning company on site. With Supabase's default table grants, all of them
-- could read, through the REST API:
--
--     select name, pin from staff;          -- including the plaintext kiosk PIN
--     select * from attendance_events;      -- when each cleaner came and went
--     select * from roster_shifts;          -- the cleaning roster
--     select * from timesheet_weeks;        -- what each person is paid
--
-- Reproduced on the mirror: the concierge, the strata admin AND the electrician
-- each read a cleaner's row and their 4-digit PIN — a PIN is a credential, so
-- that is not only a privacy breach, it is enough to sign somebody else in.
--
-- (It was invisible locally because a plain Postgres grants nothing to
-- `authenticated`, while Supabase grants everything and leaves RLS as the only
-- guard. `_mirror_bootstrap.sql` now copies those grants, so this class of hole
-- fails in CI from here on.)
--
-- WHAT THIS DOES
--   1. `app.in_org()` / `app.employs_staff()` / `app.manages_staff()` — one
--      definition of "this is my company's employee".
--   2. Every staff-related read policy is re-scoped from the BUILDING to the
--      EMPLOYING ORGANISATION. Attachment to a building no longer grants
--      anything about another company's people.
--   3. The secrets lose their column privileges outright: `staff.pin` and
--      `kiosk_devices.device_token` can no longer be selected by any API role,
--      whatever the policies say. Definer functions still read them.
--   4. Write paths gain the same employer test, so one cleaning company cannot
--      edit another's roster, corrections or PINs at a shared site.
--   5. The kiosk is scoped to its own organisation: a tablet no longer caches
--      another company's staff or their PIN hashes.
--
-- What the other orgs keep: the building owner and the concierge still get
-- cleaning PROGRESS through `attendance_day()`'s summary (0013) — counts, not
-- names. That is the CLAUDE.md rule ("completion status only when granted"),
-- expressed where it cannot be bypassed.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------- helpers ----

-- Is the caller a member of THIS organisation? Super admins pass everywhere.
create or replace function app.in_org(check_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1 from public.organisation_memberships m
     where m.user_id = auth.uid() and m.active and m.org_id = check_org
  )
$$;
revoke all on function app.in_org(uuid) from public;
grant execute on function app.in_org(uuid) to authenticated;

-- Does the caller's organisation EMPLOY this person?
create or replace function app.employs_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff and app.in_org(s.org_id)
  )
$$;
revoke all on function app.employs_staff(uuid) from public;
grant execute on function app.employs_staff(uuid) to authenticated;

-- May the caller CHANGE this person's record? Their employer, and a manager.
create or replace function app.manages_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff
       and app.in_org(s.org_id)
       and app.manages_staff_at(s.building_id)
  )
$$;
revoke all on function app.manages_staff(uuid) from public;
grant execute on function app.manages_staff(uuid) to authenticated;


-- ------------------------------------------------------- read policies -------
-- Each of these replaces a building-scoped read with an employer-scoped one.
do $$ begin
  -- staff: your company's people, at any building you service
  drop policy if exists staff_read on public.staff;
  create policy staff_read on public.staff for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists staff_write on public.staff;
  create policy staff_write on public.staff for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- kiosk devices: a pair code is a credential; only the owning org sees it
  drop policy if exists kiosk_read on public.kiosk_devices;
  create policy kiosk_read on public.kiosk_devices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists kiosk_write on public.kiosk_devices;
  create policy kiosk_write on public.kiosk_devices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- the roster is an employer's internal document
  drop policy if exists shifts_read on public.roster_shifts;
  create policy shifts_read on public.roster_shifts for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists shifts_write on public.roster_shifts;
  create policy shifts_write on public.roster_shifts for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- when each person came and went
  drop policy if exists events_read on public.attendance_events;
  create policy events_read on public.attendance_events for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists events_write on public.attendance_events;
  create policy events_write on public.attendance_events for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- corrections and pay decisions
  drop policy if exists adjustments_read on public.attendance_adjustments;
  create policy adjustments_read on public.attendance_adjustments for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists adjustments_write on public.attendance_adjustments;
  create policy adjustments_write on public.attendance_adjustments for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  drop policy if exists timesheet_read on public.timesheet_weeks;
  create policy timesheet_read on public.timesheet_weeks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists timesheet_write on public.timesheet_weeks;
  create policy timesheet_write on public.timesheet_weeks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- notices are written by one company for its own people
  drop policy if exists notices_read on public.notices;
  create policy notices_read on public.notices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists notices_write on public.notices;
  create policy notices_write on public.notices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  drop policy if exists notice_acks_read on public.notice_acks;
  create policy notice_acks_read on public.notice_acks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists notice_acks_write on public.notice_acks;
  create policy notice_acks_write on public.notice_acks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));
end $$;


-- --------------------------------------------------- the secret columns ------
-- Belt and braces, and the guard that survives a future policy mistake: the
-- credentials are not selectable by any API role at all.
--
-- NOTE ON HOW THIS HAS TO BE WRITTEN: `revoke select (pin)` alone does nothing
-- while table-level SELECT is granted — Postgres treats the table grant as
-- covering every column, present and future. So the table grant is withdrawn
-- and SELECT is re-granted column by column. (Proven the wrong way round first:
-- the column revoke passed silently and the PIN was still readable.)
--
-- CONSEQUENCE, worth knowing before adding a column: a new column on `staff` or
-- `kiosk_devices` is NOT readable by the app until it is added to the list
-- below. That is the safe direction to fail in.
revoke select on public.staff         from anon, authenticated;
revoke select on public.kiosk_devices from anon, authenticated;

-- `pin` (the credential itself) and `pin_hash` (offline verification, handed to
-- a paired tablet by kiosk_bootstrap) are deliberately absent.
grant select (id, org_id, building_id, name, role, active, created_at,
              preferred_language)
  on public.staff to authenticated;

-- `device_token` is deliberately absent: it is issued to the tablet by
-- kiosk_pair and never shown again. UPDATE is untouched, so "unpair this
-- tablet" can still clear it from the admin screen.
grant select (id, building_id, org_id, label, pair_code, pair_expires,
              paired_at, last_seen, active, created_at)
  on public.kiosk_devices to authenticated;


-- ============================================== definer reads, re-scoped =====
-- These functions run as the owner, so RLS does not apply inside them and the
-- scoping has to be written out. Each keeps its building check (an unrelated
-- company still gets "not permitted") and now returns, or accepts, only the
-- caller's OWN employees.
--
-- EVERYTHING BELOW THIS LINE IS GENERATED by scripts/build-0012-org-isolation.mjs:
-- each function is lifted verbatim from the migration that shipped it and given
-- one named patch, so a body can never silently drift from what is running.
-- Regenerate with `npm run build:0012`; do not hand-edit past this point.

-- --------------------------------------------------------------------------
-- attendance_sessions (0007) — the admin session list
-- --------------------------------------------------------------------------
create or replace function public.attendance_sessions(
  p_building uuid, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.device_id, e.source,
           (e.at at time zone 'Australia/Melbourne')::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone 'Australia/Melbourne')::date between p_from and p_to
  ), paired as (
    select ev.*,
           lead(ev.kind)        over w as next_kind,
           lead(ev.at)          over w as next_at,
           lead(ev.selfie_path) over w as next_selfie
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id',    p.staff_id,
           'staff_name',  s.name,
           'role',        s.role,
           'work_date',   p.work_date,
           'in_at',       p.at,
           'out_at',      case when p.next_kind = 'out' then p.next_at end,
           'minutes',     case when p.next_kind = 'out'
                            then round(extract(epoch from (p.next_at - p.at)) / 60)::int end,
           'in_selfie',   p.selfie_path,
           'out_selfie',  case when p.next_kind = 'out' then p.next_selfie end,
           'source',      p.source,
           'device_id',   p.device_id)
           order by p.work_date desc, p.at desc), '[]'::jsonb)
    into v
    from paired p
    join public.staff s on s.id = p.staff_id
   where p.kind = 'in'
     -- 0012: my organisation's employees only
     and app.in_org(s.org_id);
  return jsonb_build_object('ok', true, 'sessions', v);
end $$;
revoke all on function public.attendance_sessions(uuid, date, date) from public;
grant execute on function public.attendance_sessions(uuid, date, date) to authenticated;

-- --------------------------------------------------------------------------
-- kiosk_staff_search (0007) — a tablet searches its own company's names
-- --------------------------------------------------------------------------
create or replace function public.kiosk_staff_search(p_token uuid, p_query text)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
    into v
    from public.staff s
   where s.building_id = d.building_id and s.active
     -- 0012: this tablet belongs to ONE company
     and s.org_id = d.org_id
     and (coalesce(p_query,'') = '' or s.name ilike '%' || p_query || '%')
   limit 12;
  return jsonb_build_object('ok', true, 'staff', v);
end $$;
revoke all on function public.kiosk_staff_search(uuid, text) from public;
grant execute on function public.kiosk_staff_search(uuid, text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_bootstrap (0009) — the offline cache must not hold another company's PIN hashes
-- --------------------------------------------------------------------------
create or replace function public.kiosk_bootstrap(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v_staff jsonb; v_notices jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'pin_hash', s.pin_hash,
           'language', coalesce(s.preferred_language, b.default_language)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = d.building_id and s.active
     -- 0012: never cache another company's staff or their PIN hashes
     and s.org_id = d.org_id;

  -- general notices only; personal ones are fetched after a sign-in so they
  -- are never cached on a device where the wrong person could read them
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'title', n.title, 'body', n.body,
           'priority', n.priority, 'requires_ack', n.requires_ack,
           'version', n.version,
           'starts_on', n.starts_on, 'ends_on', n.ends_on,
           'start_min', n.start_min, 'end_min', n.end_min
         ) order by
           case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
           n.created_at desc), '[]'::jsonb)
    into v_notices
    from public.notices n
   where n.building_id = d.building_id and n.active and n.staff_id is null
     and n.org_id = d.org_id   -- 0012
     and (n.ends_on is null or n.ends_on >= (now() at time zone b.timezone)::date);

  return jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'device', jsonb_build_object('id', d.id, 'label', d.label),
    'site', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone,
                               'default_language', b.default_language),
    'staff', v_staff,
    'notices', v_notices);
end $$;
revoke all on function public.kiosk_bootstrap(uuid) from public;
grant execute on function public.kiosk_bootstrap(uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_punch (0009) — a PIN is only valid on its own company's tablet
-- --------------------------------------------------------------------------
create or replace function public.kiosk_punch(
  p_token uuid, p_pin text, p_kind text, p_selfie_path text default null,
  p_staff_id uuid default null, p_client_event_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; s public.staff; last_kind text; v_event uuid; b public.buildings;
begin
  if p_kind not in ('in','out') then return jsonb_build_object('ok', false, 'error', 'Bad action'); end if;
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  -- an already-recorded client event is answered, not repeated
  if p_client_event_id is not null then
    select id into v_event from public.attendance_events where client_event_id = p_client_event_id;
    if v_event is not null then
      select * into s from public.staff where id =
        (select staff_id from public.attendance_events where id = v_event);
      return jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event,
        'staff_id', s.id, 'staff_name', s.name, 'kind', p_kind);
    end if;
  end if;

  select * into s from public.staff
   where building_id = d.building_id and pin = p_pin and active
     and org_id = d.org_id;   -- 0012
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'PIN not recognised — check with your supervisor.');
  end if;
  if p_staff_id is not null and p_staff_id <> s.id then
    return jsonb_build_object('ok', false, 'error', 'That PIN does not match the selected name.');
  end if;

  -- "today" is the BUILDING's day, not UTC's
  select e.kind into last_kind from public.attendance_events e
   where e.staff_id = s.id
     and (e.at at time zone b.timezone)::date = (now() at time zone b.timezone)::date
   order by e.at desc limit 1;

  if p_kind = 'in' and last_kind = 'in' then
    return jsonb_build_object('ok', false, 'already', true, 'staff_name', s.name,
      'error', s.name || ', you are already checked in — use Check out when you leave.');
  end if;
  if p_kind = 'out' and (last_kind is null or last_kind = 'out') then
    return jsonb_build_object('ok', false, 'no_open_shift', true, 'staff_name', s.name,
      'error', s.name || ', there is no open shift to check out of — check in first.');
  end if;

  insert into public.attendance_events
    (building_id, staff_id, kind, source, device_id, selfie_path, client_event_id)
  values (d.building_id, s.id, p_kind, 'kiosk', d.id, p_selfie_path, p_client_event_id)
  returning id into v_event;

  return jsonb_build_object('ok', true, 'staff_id', s.id, 'staff_name', s.name,
    'kind', p_kind, 'at', now(), 'event_id', v_event);
end $$;
revoke all on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) from public;
grant execute on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_sync (0009) — an offline batch cannot punch somebody else's employee
-- --------------------------------------------------------------------------
create or replace function public.kiosk_sync(p_token uuid, p_events jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  d public.kiosk_devices;
  e jsonb;
  v_results jsonb := '[]'::jsonb;
  v_client uuid; v_staff uuid; v_kind text; v_at timestamptz; v_id uuid;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;

  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_client := nullif(e ->> 'client_event_id', '')::uuid;
    v_staff  := nullif(e ->> 'staff_id', '')::uuid;
    v_kind   := e ->> 'kind';
    v_at     := nullif(e ->> 'device_time', '')::timestamptz;

    if v_client is null or v_staff is null or v_kind not in ('in','out') or v_at is null then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Malformed event');
      continue;
    end if;
    if v_at > now() + interval '5 minutes' or v_at < now() - interval '14 days' then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Timestamp out of range');
      continue;
    end if;
    if not exists (select 1 from public.staff
                    where id = v_staff and building_id = d.building_id and active
                      and org_id = d.org_id) then   -- 0012
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Unknown employee for this site');
      continue;
    end if;

    -- upsert on the client's own id: replaying a batch is a no-op, never a
    -- second punch
    insert into public.attendance_events
      (building_id, staff_id, kind, at, source, device_id, selfie_path,
       client_event_id, recorded_offline, device_time)
    values
      (d.building_id, v_staff, v_kind, v_at, 'kiosk', d.id, nullif(e ->> 'selfie_path', ''),
       v_client, coalesce((e ->> 'recorded_offline')::boolean, true), v_at)
    -- the index is partial, so the predicate has to be repeated here for
    -- Postgres to infer it
    on conflict (client_event_id) where client_event_id is not null do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.attendance_events where client_event_id = v_client;
    end if;
    v_results := v_results || jsonb_build_object(
      'client_event_id', v_client, 'ok', true, 'event_id', v_id);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results, 'server_time', now());
end $$;
revoke all on function public.kiosk_sync(uuid, jsonb) from public;
grant execute on function public.kiosk_sync(uuid, jsonb) to anon, authenticated;

-- --------------------------------------------------------------------------
-- notices_for_staff (0009) — notices belong to the company that wrote them
-- --------------------------------------------------------------------------
create or replace function public.notices_for_staff(p_token uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = d.building_id and active
                    and org_id = d.org_id) then   -- 0012
    return jsonb_build_object('ok', false, 'error', 'Unknown employee');
  end if;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(x order by x_rank, x_created desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
               'id', n.id, 'title', n.title, 'body', n.body,
               'priority', n.priority, 'personal', n.staff_id is not null,
               'requires_ack', n.requires_ack, 'version', n.version,
               'acked', exists (select 1 from public.notice_acks a
                                 where a.notice_id = n.id and a.staff_id = p_staff
                                   and a.notice_version = n.version)
             ) as x,
             case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end as x_rank,
             n.created_at as x_created
        from public.notices n
       where n.building_id = d.building_id and n.org_id = d.org_id   -- 0012
         and (n.staff_id is null or n.staff_id = p_staff)
         and app.notice_is_current(n, now(), b.timezone)
    ) s;

  return jsonb_build_object('ok', true, 'notices', v);
end $$;
revoke all on function public.notices_for_staff(uuid, uuid) from public;
grant execute on function public.notices_for_staff(uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- notice_ack (0009) — acknowledging somebody else's notice is not a thing
-- --------------------------------------------------------------------------
create or replace function public.notice_ack(p_token uuid, p_notice uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v_version int;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  select n.version into v_version from public.notices n
   where n.id = p_notice and n.building_id = d.building_id and n.org_id = d.org_id
     and (n.staff_id is null or n.staff_id = p_staff);
  if v_version is null then return jsonb_build_object('ok', false, 'error', 'Notice not found here'); end if;

  insert into public.notice_acks (notice_id, staff_id, notice_version, device_id)
  values (p_notice, p_staff, v_version, d.id)
  on conflict (notice_id, staff_id, notice_version) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.notice_ack(uuid, uuid, uuid) from public;
grant execute on function public.notice_ack(uuid, uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- staff_reset_pin (0009) — issuing a PIN is the employer's business
-- --------------------------------------------------------------------------
create or replace function public.staff_reset_pin(p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_pin text;
begin
  select building_id into v_building from public.staff where id = p_staff;
  if v_building is null then raise exception 'staff not found'; end if;
  -- 0012: the EMPLOYER, not merely a manager at this building
  if not app.manages_staff(p_staff) then raise exception 'not permitted'; end if;
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff
                       where building_id = v_building and pin = v_pin and active and id <> p_staff);
  end loop;
  update public.staff set pin = v_pin, pin_hash = app.hash_pin(v_pin) where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- timesheet_week (0010) — payroll is the most private thing here
-- --------------------------------------------------------------------------
create or replace function public.timesheet_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_rows jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.recorded_offline, e.source,
           (e.at at time zone v_tz)::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone v_tz)::date
             between p_week_start and p_week_start + 6
  ), paired as (
    select ev.*,
           lead(ev.kind) over w as next_kind,
           lead(ev.at)   over w as next_at
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  ), sessions as (
    select p.id as session_event_id, p.staff_id, p.work_date, p.at as in_at,
           case when p.next_kind = 'out' then p.next_at end as out_at,
           case when p.next_kind = 'out'
                then round(extract(epoch from (p.next_at - p.at)) / 60)::int end as minutes,
           p.recorded_offline, p.selfie_path, p.source
      from paired p
     where p.kind = 'in'
  ), rostered as (
    select r.staff_id, sum(r.end_min - r.start_min)::int as minutes
      from public.roster_shifts r
     where r.building_id = p_building
       and r.work_date between p_week_start and p_week_start + 6
     group by r.staff_id
  )
  select coalesce(jsonb_agg(x order by x ->> 'staff_name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'staff_id',   s.id,
      'staff_name', s.name,
      'role',       s.role,
      'active',     s.active,
      'rostered_minutes', coalesce(ro.minutes, 0),
      -- a session still open (no check-out) contributes nothing to pay yet,
      -- but is reported so a manager can see and correct it
      'worked_minutes', coalesce((select sum(se.minutes) from sessions se where se.staff_id = s.id), 0),
      'adjustment_minutes', coalesce((
          select sum(a.delta_minutes) from public.attendance_adjustments a
           join sessions se2 on se2.session_event_id = a.session_event_id
          where a.staff_id = s.id), 0),
      'open_sessions', (select count(*) from sessions se where se.staff_id = s.id and se.out_at is null),
      'status',           coalesce(w.status, 'pending'),
      'approved_minutes', w.approved_minutes,
      'note',             coalesce(w.note, ''),
      'decided_at',       w.decided_at,
      'decided_by',       (select u.name from public.users u where u.id = w.decided_by),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'session_event_id', se.session_event_id,
                 'work_date', se.work_date,
                 'in_at', se.in_at,
                 'out_at', se.out_at,
                 'minutes', se.minutes,
                 'recorded_offline', se.recorded_offline,
                 'selfie_path', se.selfie_path,
                 'adjustment_minutes', coalesce(a.delta_minutes, 0),
                 'adjustment_note', coalesce(a.note, '')
               ) order by se.in_at)
          from sessions se
          left join public.attendance_adjustments a on a.session_event_id = se.session_event_id
         where se.staff_id = s.id), '[]'::jsonb)
    ) as x
    from public.staff s
    left join rostered ro on ro.staff_id = s.id
    left join public.timesheet_weeks w
           on w.staff_id = s.id and w.building_id = p_building and w.week_start = p_week_start
    where s.building_id = p_building
      and app.in_org(s.org_id)   -- 0012: my organisation's employees only
      and (s.active
           or exists (select 1 from sessions se where se.staff_id = s.id)
           or w.id is not null)
  ) rows;

  return jsonb_build_object(
    'ok', true,
    'week_start', p_week_start,
    'timezone', v_tz,
    'rows', v_rows);
end $$;
revoke all on function public.timesheet_week(uuid, date) from public;
grant execute on function public.timesheet_week(uuid, date) to authenticated;

-- --------------------------------------------------------------------------
-- attendance_adjust (0010) — only the employer corrects hours
-- --------------------------------------------------------------------------
create or replace function public.attendance_adjust(
  p_session_event uuid, p_delta_minutes int, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare e public.attendance_events; v_week date; v_status text;
begin
  select * into e from public.attendance_events where id = p_session_event;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'Session not found'); end if;
  -- 0012: the employer of THIS person, not any manager at the building
  if not app.manages_staff(e.staff_id) then raise exception 'not permitted'; end if;
  if e.kind <> 'in' then
    return jsonb_build_object('ok', false, 'error', 'Corrections attach to a check-in');
  end if;
  if coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A correction needs a reason');
  end if;

  v_week := app.week_start(e.building_id, e.at);
  select status into v_status from public.timesheet_weeks
   where building_id = e.building_id and staff_id = e.staff_id and week_start = v_week;
  if v_status = 'approved' then
    return jsonb_build_object('ok', false, 'locked', true,
      'error', 'That week is approved — reopen it before changing hours.');
  end if;

  if p_delta_minutes = 0 then
    delete from public.attendance_adjustments where session_event_id = p_session_event;
    return jsonb_build_object('ok', true, 'removed', true);
  end if;

  insert into public.attendance_adjustments
    (session_event_id, building_id, staff_id, delta_minutes, note, created_by)
  values (p_session_event, e.building_id, e.staff_id, p_delta_minutes, trim(p_note), auth.uid())
  on conflict (session_event_id) do update
    set delta_minutes = excluded.delta_minutes,
        note = excluded.note,
        created_by = excluded.created_by,
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.attendance_adjust(uuid, int, text) from public;
grant execute on function public.attendance_adjust(uuid, int, text) to authenticated;

-- --------------------------------------------------------------------------
-- timesheet_decide (0010) — one company cannot approve another's week
-- --------------------------------------------------------------------------
create or replace function public.timesheet_decide(
  p_building uuid, p_staff uuid, p_week_start date,
  p_status text, p_minutes int default null, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_minutes int; v_open int;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_status not in ('pending','approved','rejected') then
    return jsonb_build_object('ok', false, 'error', 'Unknown decision');
  end if;
  -- 0012: `and app.in_org(org_id)` makes another company's employee read as
  -- unknown rather than approvable
  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building
                  and app.in_org(org_id)) then
    return jsonb_build_object('ok', false, 'error', 'Unknown employee for this site');
  end if;
  -- a rejection without a reason is not a rejection, it is a mystery
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Say why it is being sent back');
  end if;

  if p_status = 'approved' then
    select ((r ->> 'worked_minutes')::int + (r ->> 'adjustment_minutes')::int),
           (r ->> 'open_sessions')::int
      into v_minutes, v_open
      from jsonb_array_elements(public.timesheet_week(p_building, p_week_start) -> 'rows') r
     where (r ->> 'staff_id')::uuid = p_staff;
    v_minutes := coalesce(p_minutes, v_minutes, 0);
    if v_minutes < 0 then v_minutes := 0; end if;
  else
    v_minutes := null;
  end if;

  insert into public.timesheet_weeks
    (building_id, staff_id, week_start, status, approved_minutes, note, decided_by, decided_at)
  values (p_building, p_staff, p_week_start, p_status, v_minutes,
          coalesce(trim(p_note), ''),
          case when p_status = 'pending' then null else auth.uid() end,
          case when p_status = 'pending' then null else now() end)
  on conflict (building_id, staff_id, week_start) do update
    set status = excluded.status,
        approved_minutes = excluded.approved_minutes,
        note = excluded.note,
        decided_by = excluded.decided_by,
        decided_at = excluded.decided_at,
        updated_at = now();

  return jsonb_build_object('ok', true, 'status', p_status,
    'approved_minutes', v_minutes,
    -- worth saying out loud rather than silently paying zero for it
    'open_sessions', coalesce(v_open, 0));
end $$;
revoke all on function public.timesheet_decide(uuid, uuid, date, text, int, text) from public;
grant execute on function public.timesheet_decide(uuid, uuid, date, text, int, text) to authenticated;

-- --------------------------------------------------------------------------
-- roster_week (0011) — each company sees its own board at a shared site
-- --------------------------------------------------------------------------
create or replace function public.roster_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_shifts jsonb; v_staff jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'staff_id', r.staff_id,
           'staff_name', s.name,
           'work_date', r.work_date,
           'start_min', r.start_min,
           'end_min', r.end_min,
           'minutes', r.end_min - r.start_min,
           'zone', r.zone,
           'note', r.note
         ) order by r.work_date, r.start_min), '[]'::jsonb)
    into v_shifts
    from public.roster_shifts r
    join public.staff s on s.id = r.staff_id
   where r.building_id = p_building
     and app.in_org(s.org_id)   -- 0012
     and r.work_date between p_week_start and p_week_start + 6;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'rostered_minutes', coalesce((
             select sum(r.end_min - r.start_min) from public.roster_shifts r
              where r.staff_id = s.id
                and r.work_date between p_week_start and p_week_start + 6), 0)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = p_building and s.active and app.in_org(s.org_id);   -- 0012

  return jsonb_build_object(
    'ok', true, 'week_start', p_week_start, 'timezone', v_tz,
    'staff', v_staff, 'shifts', v_shifts);
end $$;
revoke all on function public.roster_week(uuid, date) from public;
grant execute on function public.roster_week(uuid, date) to authenticated;

-- --------------------------------------------------------------------------
-- roster_shift_set (0011) — you can only roster your own people, and only edit your own shifts
-- --------------------------------------------------------------------------
create or replace function public.roster_shift_set(
  p_building uuid, p_staff uuid, p_work_date date,
  p_start_min int, p_end_min int, p_zone text default '', p_note text default '',
  p_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_end_min <= p_start_min then
    return jsonb_build_object('ok', false, 'error', 'The finish time must be after the start time.');
  end if;
  if p_start_min < 0 or p_end_min > 1440 then
    return jsonb_build_object('ok', false, 'error', 'Times must be inside one day.');
  end if;
  -- 0012: "does not work at this site" now also covers "works here, for
  -- somebody else"
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = p_building and active
                    and app.in_org(org_id)) then
    return jsonb_build_object('ok', false, 'error', 'That person does not work at this site.');
  end if;

  begin
    if p_id is null then
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, p_staff, p_work_date, p_start_min, p_end_min,
              coalesce(p_zone, ''), coalesce(p_note, ''))
      returning id into v_id;
    else
      update public.roster_shifts
         set staff_id = p_staff, work_date = p_work_date,
             start_min = p_start_min, end_min = p_end_min,
             zone = coalesce(p_zone, ''), note = coalesce(p_note, '')
       where id = p_id and building_id = p_building
         and app.employs_staff(staff_id)   -- 0012: not somebody else's shift
      returning id into v_id;
      if v_id is null then
        return jsonb_build_object('ok', false, 'error', 'That shift no longer exists.');
      end if;
    end if;
  exception
    when check_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They are already rostered over that time that day.');
    when unique_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They already have a shift starting at that time.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) from public;
grant execute on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) to authenticated;

-- --------------------------------------------------------------------------
-- roster_shift_delete (0011) — deleting another company's shift was possible at a shared site
-- --------------------------------------------------------------------------
create or replace function public.roster_shift_delete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_staff uuid;
begin
  select building_id, staff_id into v_building, v_staff
    from public.roster_shifts where id = p_id;
  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  -- 0012: the employer of the person on the shift
  if not app.manages_staff(v_staff) then raise exception 'not permitted'; end if;
  delete from public.roster_shifts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.roster_shift_delete(uuid) from public;
grant execute on function public.roster_shift_delete(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- roster_copy_week (0011) — copying a week must not copy another company's shifts
-- --------------------------------------------------------------------------
create or replace function public.roster_copy_week(
  p_building uuid, p_from_week date, p_to_week date
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare r record; v_offset int; v_copied int := 0; v_skipped int := 0;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_from_week = p_to_week then
    return jsonb_build_object('ok', false, 'error', 'Pick a different week to copy into.');
  end if;
  v_offset := p_to_week - p_from_week;

  for r in
    select rs.* from public.roster_shifts rs
     join public.staff st on st.id = rs.staff_id
     where rs.building_id = p_building
       and app.in_org(st.org_id)   -- 0012
       and rs.work_date between p_from_week and p_from_week + 6
     order by rs.work_date, rs.start_min
  loop
    begin
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, r.staff_id, r.work_date + v_offset,
              r.start_min, r.end_min, r.zone, r.note);
      v_copied := v_copied + 1;
    exception when check_violation or unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'copied', v_copied, 'skipped', v_skipped);
end $$;
revoke all on function public.roster_copy_week(uuid, date, date) from public;
grant execute on function public.roster_copy_week(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 0013_attendance_day.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0013 — Today: who is actually here, against who was meant to be.
--
-- The kiosk records punches (0007/0009), the roster records intent (0011) and
-- the timesheet settles the week (0010). What was missing is the question a
-- supervisor asks twenty times a day: *right now, who is on site, who is late,
-- and who never turned up.*
--
-- One read, `attendance_day()`, answers it for any date and is the only place
-- those states are decided — a screen that computed "missed" for itself would
-- eventually disagree with the alert that emails somebody.
--
-- Two deliberate rules:
--
--   * NAMES ARE FOR THE EMPLOYER (0012's rule, applied here). Per-person rows
--     go only to an org that actually EMPLOYS people at this building, and only
--     its own people. Anyone else with building access — the strata manager, the
--     concierge — gets the COUNTS: cleaning progress without cleaning staff
--     records. Two cleaning companies at one tower each see their own crew and
--     the same site-wide summary they are entitled to.
--   * MISSED IS A FACT, NOT A GUESS. A shift is missed only once its start plus
--     the grace period has passed with no check-in. Before then it is upcoming,
--     and someone who signed in late is late — still here, still paid.
--
-- Idempotent — safe to re-run. No new tables: this is a read over existing rows.
-- =============================================================================

create or replace function public.attendance_day(
  p_building uuid,
  p_date date,
  p_grace_min int default 15
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_tz      text;
  v_now     timestamptz := now();
  v_now_min int;
  v_grace   int := greatest(0, least(coalesce(p_grace_min, 15), 240));
  v_detail  boolean;
  v_rows    jsonb;
  v_sum     jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  -- Whether names may be returned at all is decided here, once: do you employ
  -- anybody here? (0012's `app.in_org`, so a super admin passes too.)
  v_detail := exists (
    select 1 from public.staff s
     where s.building_id = p_building and app.in_org(s.org_id));

  -- "How far into the day is it" in the BUILDING's timezone. A past date is
  -- over (1440); a future date has not started (-1), so nothing is ever
  -- reported missed before it could possibly have happened.
  v_now_min := case
    when (v_now at time zone v_tz)::date = p_date
      then floor(extract(epoch from (v_now at time zone v_tz)::time) / 60)::int
    when (v_now at time zone v_tz)::date > p_date then 1440
    else -1
  end;

  with mine as (
    -- an employer sees its own crew; everyone else sees the site's counts, so
    -- the summary is computed over the whole site in that case
    select s.* from public.staff s
     where s.building_id = p_building
       and (not v_detail or app.in_org(s.org_id))
  ), ev as (
    select e.id, e.staff_id, e.kind, e.at, e.recorded_offline, e.selfie_path
      from public.attendance_events e
      join mine m on m.id = e.staff_id
     where e.building_id = p_building
       and (e.at at time zone v_tz)::date = p_date
  ), paired as (
    select ev.*,
           lead(ev.kind) over w as next_kind,
           lead(ev.at)   over w as next_at
      from ev
    window w as (partition by ev.staff_id order by ev.at)
  ), sessions as (
    -- a session is a check-in and whatever check-out follows it that day
    select p.staff_id, p.at as in_at, p.recorded_offline, p.selfie_path,
           case when p.next_kind = 'out' then p.next_at end as out_at,
           case when p.next_kind = 'out'
                then round(extract(epoch from (p.next_at - p.at)) / 60)::int end as minutes
      from paired p
     where p.kind = 'in'
  ), attendance as (
    select s.staff_id,
           min(s.in_at)                            as first_in,
           max(s.out_at)                           as last_out,
           coalesce(sum(s.minutes), 0)::int        as worked_minutes,
           count(*)::int                           as sessions,
           count(*) filter (where s.out_at is null)::int as open_sessions,
           max(s.in_at) filter (where s.out_at is null)  as open_since,
           bool_or(s.recorded_offline)             as any_offline
      from sessions s
     group by s.staff_id
  ), rostered as (
    select r.staff_id,
           min(r.start_min)::int                     as expected_start_min,
           max(r.end_min)::int                       as expected_end_min,
           sum(r.end_min - r.start_min)::int         as rostered_minutes,
           jsonb_agg(jsonb_build_object(
             'id', r.id, 'start_min', r.start_min, 'end_min', r.end_min,
             'zone', r.zone, 'note', r.note) order by r.start_min) as shifts
      from public.roster_shifts r
      join mine m on m.id = r.staff_id
     where r.building_id = p_building and r.work_date = p_date
     group by r.staff_id
  ), people as (
    -- everyone the day concerns: rostered, or here anyway
    select staff_id from rostered
    union
    select staff_id from attendance
  ), built as (
    select s.id                                        as staff_id,
           s.name                                      as staff_name,
           s.role                                      as role,
           s.active                                    as active,
           coalesce(r.shifts, '[]'::jsonb)             as shifts,
           coalesce(r.rostered_minutes, 0)             as rostered_minutes,
           r.expected_start_min,
           r.expected_end_min,
           a.first_in, a.last_out, a.open_since,
           coalesce(a.worked_minutes, 0)               as worked_minutes,
           coalesce(a.sessions, 0)                     as sessions,
           coalesce(a.open_sessions, 0)                as open_sessions,
           coalesce(a.any_offline, false)              as recorded_offline,
           (a.open_sessions > 0)                       as on_site,
           (r.staff_id is null)                        as unrostered,
           -- late: signed in after the start plus grace, and still counted
           case when a.first_in is not null and r.expected_start_min is not null
                then greatest(0,
                       floor(extract(epoch from (a.first_in at time zone v_tz)::time) / 60)::int
                       - r.expected_start_min - v_grace)
                else 0 end                            as late_minutes,
           -- still signed in long after the shift should have ended
           case when coalesce(a.open_sessions, 0) > 0 and r.expected_end_min is not null
                     and v_now_min > r.expected_end_min + v_grace
                then v_now_min - r.expected_end_min
                else 0 end                            as overdue_minutes,
           case
             when coalesce(a.open_sessions, 0) > 0 then 'on_site'
             when a.sessions > 0                   then 'finished'
             when r.expected_start_min is null     then 'finished'
             when v_now_min >= r.expected_start_min + v_grace then 'missed'
             else 'upcoming'
           end                                        as state
      from people pp
      join mine s on s.id = pp.staff_id
      left join rostered r on r.staff_id = pp.staff_id
      left join attendance a on a.staff_id = pp.staff_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'staff_id', b.staff_id, 'staff_name', b.staff_name, 'role', b.role,
      'active', b.active, 'shifts', b.shifts,
      'rostered_minutes', b.rostered_minutes,
      'expected_start_min', b.expected_start_min,
      'expected_end_min', b.expected_end_min,
      'first_in', b.first_in, 'last_out', b.last_out, 'open_since', b.open_since,
      'worked_minutes', b.worked_minutes, 'sessions', b.sessions,
      'open_sessions', b.open_sessions, 'recorded_offline', b.recorded_offline,
      'on_site', b.on_site, 'unrostered', b.unrostered,
      'late_minutes', b.late_minutes, 'overdue_minutes', b.overdue_minutes,
      'state', b.state
    ) order by
        -- the order a supervisor wants: problems first, then who is here
        case b.state when 'missed' then 0 when 'on_site' then 1
                     when 'upcoming' then 2 else 3 end,
        b.expected_start_min nulls last, b.staff_name),
      '[]'::jsonb),
    jsonb_build_object(
      'people', count(*),
      'rostered', count(*) filter (where not b.unrostered),
      'on_site', count(*) filter (where b.state = 'on_site'),
      'finished', count(*) filter (where b.state = 'finished'),
      'upcoming', count(*) filter (where b.state = 'upcoming'),
      'missed', count(*) filter (where b.state = 'missed'),
      'late', count(*) filter (where b.late_minutes > 0),
      'overdue', count(*) filter (where b.overdue_minutes > 0),
      'unrostered_here', count(*) filter (where b.unrostered and b.sessions > 0),
      'rostered_minutes', coalesce(sum(b.rostered_minutes), 0),
      'worked_minutes', coalesce(sum(b.worked_minutes), 0))
    into v_rows, v_sum
    from built b;

  return jsonb_build_object(
    'ok', true,
    'date', p_date,
    'timezone', v_tz,
    'server_time', v_now,
    'now_min', v_now_min,
    'grace_min', v_grace,
    -- false means: you may see the counts, not the people
    'detail', v_detail,
    'summary', v_sum,
    'rows', case when v_detail then v_rows else '[]'::jsonb end);
end $$;
revoke all on function public.attendance_day(uuid, date, int) from public;
grant execute on function public.attendance_day(uuid, date, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 0014_attendance_alerts.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0014 — Missed check-in alerts: the system tells somebody, instead of waiting
-- to be asked.
--
-- 0013 knows who never turned up. Until now that fact sat on a screen nobody
-- was necessarily looking at. This raises a DURABLE alert and lets a job email
-- it — which is the last item on the original CleaningOps list.
--
-- The rules that stop an alert system from being ignored:
--
--   * NEVER TWICE. One alert per person, per day, per shift, per kind. The
--     scan runs every few minutes and must be able to run a hundred times an
--     hour without sending a hundred emails — a unique index enforces that,
--     not the caller's care.
--   * IT CLOSES ITSELF. Somebody who turns up late resolves their own alert
--     ('arrived'), and somebody who finally signs out resolves theirs
--     ('signed_out'). An alert list that only grows stops being read.
--   * NOTHING IS RAISED BEFORE IT COULD HAVE HAPPENED. Start plus grace, in the
--     building's own timezone — the same rule 0013 shows on screen, so the
--     board and the email can never disagree.
--   * THE SEND IS RECORDED SEPARATELY from the alert. `notified_at` is stamped
--     only when a provider accepted it, so a mail outage means an unsent alert
--     you can see, not a silent one.
--
-- Two kinds:
--   missed  — rostered, start + grace has passed, no check-in
--   overdue — signed in and still signed in long after the shift should have
--             ended (the forgotten sign-out that pays nothing)
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- --------------------------------------------------------------- settings ---
create table if not exists public.attendance_alert_settings (
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  enabled       boolean not null default true,
  -- how long after a start time counts as "not here"
  grace_min     int not null default 15 check (grace_min between 0 and 240),
  -- how long past a finish time a still-open shift is worth chasing
  overdue_after_min int not null default 60 check (overdue_after_min between 0 and 1440),
  raise_overdue boolean not null default true,
  -- who hears about it. Empty = alerts are raised on screen but not emailed.
  notify_emails text[] not null default '{}',
  updated_by    uuid references public.users(id),
  updated_at    timestamptz not null default now(),
  primary key (building_id, org_id)
);

-- ----------------------------------------------------------------- alerts ---
create table if not exists public.attendance_alerts (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  staff_id      uuid not null references public.staff(id) on delete cascade,
  shift_id      uuid references public.roster_shifts(id) on delete set null,
  kind          text not null check (kind in ('missed','overdue')),
  work_date     date not null,
  /** the minute of the day the alert is about: a start time, or a finish */
  due_min       int,
  raised_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  resolution    text check (resolution in ('arrived','signed_out','acknowledged')),
  note          text not null default '',
  acknowledged_by uuid references public.users(id),
  -- stamped only when a provider ACCEPTED the message
  notified_at   timestamptz,
  notify_error  text
);

-- The promise that a scan every five minutes cannot spam anyone. `shift_id` is
-- nullable (an overdue session need not be rostered), so it is coalesced —
-- a plain unique constraint would treat every null as distinct and let
-- duplicates through.
create unique index if not exists attendance_alerts_once
  on public.attendance_alerts (
    staff_id, work_date, kind,
    coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists attendance_alerts_open_idx
  on public.attendance_alerts (building_id, work_date) where resolved_at is null;

alter table public.attendance_alert_settings enable row level security;
alter table public.attendance_alerts         enable row level security;

do $$ begin
  -- 0012's rule: staff facts belong to the organisation that employs them
  drop policy if exists alert_settings_read on public.attendance_alert_settings;
  create policy alert_settings_read on public.attendance_alert_settings
    for select to authenticated using (app.in_org(org_id));
  drop policy if exists alert_settings_write on public.attendance_alert_settings;
  create policy alert_settings_write on public.attendance_alert_settings
    for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  drop policy if exists alerts_read on public.attendance_alerts;
  create policy alerts_read on public.attendance_alerts
    for select to authenticated using (app.employs_staff(staff_id));
  drop policy if exists alerts_write on public.attendance_alerts;
  create policy alerts_write on public.attendance_alerts
    for all to authenticated
    using (app.manages_staff(staff_id)) with check (app.manages_staff(staff_id));
end $$;


-- The scheduled job runs as the service role, which has no `auth.uid()`. It
-- still must not be able to do anything a manager couldn't — it only ever
-- scans and stamps.
create or replace function app.is_service_role() returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    or current_user = 'service_role'
$$;


-- ==================================================== settings: read/write ===
create or replace function public.alert_settings_get(p_building uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_org uuid; r public.attendance_alert_settings;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  select * into r from public.attendance_alert_settings
   where building_id = p_building and org_id = v_org;

  -- defaults are returned rather than stored, so a site that has never opened
  -- this screen still behaves sensibly
  return jsonb_build_object('ok', true,
    'building_id', p_building, 'org_id', v_org,
    'enabled',           coalesce(r.enabled, true),
    'grace_min',         coalesce(r.grace_min, 15),
    'overdue_after_min', coalesce(r.overdue_after_min, 60),
    'raise_overdue',     coalesce(r.raise_overdue, true),
    'notify_emails',     to_jsonb(coalesce(r.notify_emails, '{}')),
    'configured',        r.building_id is not null);
end $$;
revoke all on function public.alert_settings_get(uuid) from public;
grant execute on function public.alert_settings_get(uuid) to authenticated;


create or replace function public.alert_settings_set(
  p_building uuid, p_enabled boolean, p_grace_min int,
  p_overdue_after_min int, p_raise_overdue boolean, p_emails text[]
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_clean text[];
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  if p_grace_min < 0 or p_grace_min > 240 then
    return jsonb_build_object('ok', false, 'error', 'Grace must be between 0 and 240 minutes.');
  end if;

  -- a malformed address is refused here rather than failing silently at send
  select coalesce(array_agg(distinct lower(trim(e))), '{}')
    into v_clean
    from unnest(coalesce(p_emails, '{}')) e
   where trim(e) <> '';
  if exists (select 1 from unnest(v_clean) e where e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'One of those email addresses is not valid.');
  end if;

  insert into public.attendance_alert_settings
    (building_id, org_id, enabled, grace_min, overdue_after_min, raise_overdue,
     notify_emails, updated_by, updated_at)
  values (p_building, v_org, coalesce(p_enabled, true), coalesce(p_grace_min, 15),
          coalesce(p_overdue_after_min, 60), coalesce(p_raise_overdue, true),
          v_clean, auth.uid(), now())
  on conflict (building_id, org_id) do update
    set enabled = excluded.enabled,
        grace_min = excluded.grace_min,
        overdue_after_min = excluded.overdue_after_min,
        raise_overdue = excluded.raise_overdue,
        notify_emails = excluded.notify_emails,
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object('ok', true, 'notify_emails', to_jsonb(v_clean));
end $$;
revoke all on function public.alert_settings_set(uuid, boolean, int, int, boolean, text[]) from public;
grant execute on function public.alert_settings_set(uuid, boolean, int, int, boolean, text[]) to authenticated;


-- ============================================================== the scan =====
-- Raises what is now true, resolves what is no longer true, and returns the
-- alerts that still need sending. Safe to call every few minutes: the unique
-- index means a second run raises nothing new.
create or replace function public.attendance_alerts_scan(p_building uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_org uuid; v_tz text; v_today date; v_now_min int;
  s public.attendance_alert_settings;
  v_raised int := 0; v_resolved int := 0; v_n int; v_pending jsonb;
begin
  if not (app.is_service_role() or app.manages_staff_at(p_building)) then
    raise exception 'not permitted';
  end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  v_today   := (now() at time zone v_tz)::date;
  v_now_min := floor(extract(epoch from (now() at time zone v_tz)::time) / 60)::int;

  -- every cleaning company at this site is scanned in its own right
  for v_org in
    select distinct st.org_id from public.staff st
     where st.building_id = p_building and st.active
  loop
    select * into s from public.attendance_alert_settings
     where building_id = p_building and org_id = v_org;
    if s.building_id is not null and not s.enabled then continue; end if;

    -- ---- raise: rostered, past start + grace, never checked in ----------
    insert into public.attendance_alerts
      (building_id, org_id, staff_id, shift_id, kind, work_date, due_min)
    select p_building, v_org, r.staff_id, r.id, 'missed', v_today, r.start_min
      from public.roster_shifts r
      join public.staff st on st.id = r.staff_id and st.active and st.org_id = v_org
     where r.building_id = p_building
       and r.work_date = v_today
       and v_now_min >= r.start_min + coalesce(s.grace_min, 15)
       and not exists (
         select 1 from public.attendance_events e
          where e.staff_id = r.staff_id and e.kind = 'in'
            and (e.at at time zone v_tz)::date = v_today)
    on conflict do nothing;
    -- counts ACCUMULATE across the organisations at this site; assigning
    -- would report only the last one
    get diagnostics v_n = row_count;  v_raised := v_raised + v_n;

    -- ---- raise: signed in, long past the finish, still signed in --------
    if coalesce(s.raise_overdue, true) then
      insert into public.attendance_alerts
        (building_id, org_id, staff_id, shift_id, kind, work_date, due_min)
      select p_building, v_org, o.staff_id, o.shift_id, 'overdue', v_today, o.end_min
        from (
          select e.staff_id,
                 (select r.id from public.roster_shifts r
                   where r.staff_id = e.staff_id and r.work_date = v_today
                     and r.building_id = p_building
                   order by r.end_min desc limit 1) as shift_id,
                 (select max(r.end_min) from public.roster_shifts r
                   where r.staff_id = e.staff_id and r.work_date = v_today
                     and r.building_id = p_building) as end_min
            from public.attendance_events e
            join public.staff st on st.id = e.staff_id and st.org_id = v_org and st.active
           where e.building_id = p_building
             and (e.at at time zone v_tz)::date = v_today
           group by e.staff_id
          having (array_agg(e.kind order by e.at desc))[1] = 'in'
        ) o
       where o.end_min is not null
         and v_now_min > o.end_min + coalesce(s.overdue_after_min, 60)
      on conflict do nothing;
      get diagnostics v_n = row_count;  v_raised := v_raised + v_n;
    end if;

    -- ---- resolve: they turned up after all --------------------------------
    update public.attendance_alerts a
       set resolved_at = now(), resolution = 'arrived'
     where a.building_id = p_building and a.org_id = v_org
       and a.kind = 'missed' and a.resolved_at is null
       and exists (
         select 1 from public.attendance_events e
          where e.staff_id = a.staff_id and e.kind = 'in'
            and (e.at at time zone v_tz)::date = a.work_date);
    get diagnostics v_n = row_count;  v_resolved := v_resolved + v_n;

    -- ---- resolve: they finally signed out ---------------------------------
    update public.attendance_alerts a
       set resolved_at = now(), resolution = 'signed_out'
     where a.building_id = p_building and a.org_id = v_org
       and a.kind = 'overdue' and a.resolved_at is null
       and (select (array_agg(e.kind order by e.at desc))[1]
              from public.attendance_events e
             where e.staff_id = a.staff_id
               and (e.at at time zone v_tz)::date = a.work_date) = 'out';
    get diagnostics v_n = row_count;  v_resolved := v_resolved + v_n;
  end loop;

  -- what still needs an email: open, never sent, and somebody to send it to
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'org_id', a.org_id, 'kind', a.kind,
           'staff_name', st.name, 'work_date', a.work_date, 'due_min', a.due_min,
           'emails', to_jsonb(coalesce(cfg.notify_emails, '{}'))
         ) order by a.raised_at), '[]'::jsonb)
    into v_pending
    from public.attendance_alerts a
    join public.staff st on st.id = a.staff_id
    left join public.attendance_alert_settings cfg
           on cfg.building_id = a.building_id and cfg.org_id = a.org_id
   where a.building_id = p_building
     and a.resolved_at is null
     and a.notified_at is null
     and coalesce(array_length(cfg.notify_emails, 1), 0) > 0;

  return jsonb_build_object('ok', true, 'building_id', p_building,
    'timezone', v_tz, 'date', v_today,
    'raised', v_raised, 'resolved', v_resolved, 'to_send', v_pending);
end $$;
revoke all on function public.attendance_alerts_scan(uuid) from public;
grant execute on function public.attendance_alerts_scan(uuid) to authenticated, service_role;


-- Every building at once — what the scheduled job calls.
create or replace function public.attendance_alerts_scan_all()
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare b record; v_all jsonb := '[]'::jsonb;
begin
  if not app.is_service_role() then raise exception 'not permitted'; end if;
  for b in select distinct s.building_id as id from public.staff s where s.active loop
    v_all := v_all || jsonb_build_array(public.attendance_alerts_scan(b.id));
  end loop;
  return jsonb_build_object('ok', true, 'buildings', v_all);
end $$;
revoke all on function public.attendance_alerts_scan_all() from public;
grant execute on function public.attendance_alerts_scan_all() to service_role;


-- Stamped only when a provider ACCEPTED the message, so an outage leaves an
-- unsent alert that is visibly unsent.
create or replace function public.attendance_alerts_mark_sent(p_ids uuid[], p_error text default null)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_n int;
begin
  if not app.is_service_role() then raise exception 'not permitted'; end if;
  update public.attendance_alerts
     set notified_at = case when p_error is null then now() end,
         notify_error = p_error
   where id = any(coalesce(p_ids, '{}'));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'updated', v_n);
end $$;
revoke all on function public.attendance_alerts_mark_sent(uuid[], text) from public;
grant execute on function public.attendance_alerts_mark_sent(uuid[], text) to service_role;


-- ============================================================ read + ack =====
create or replace function public.attendance_alerts_open(p_building uuid, p_date date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_date date; v_rows jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  v_date := coalesce(p_date, (now() at time zone v_tz)::date);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'kind', a.kind, 'staff_id', a.staff_id, 'staff_name', st.name,
           'work_date', a.work_date, 'due_min', a.due_min, 'raised_at', a.raised_at,
           'notified_at', a.notified_at, 'notify_error', a.notify_error,
           'resolved_at', a.resolved_at, 'resolution', a.resolution, 'note', a.note
         ) order by a.raised_at desc), '[]'::jsonb)
    into v_rows
    from public.attendance_alerts a
    join public.staff st on st.id = a.staff_id
   where a.building_id = p_building
     and a.work_date = v_date
     and app.in_org(a.org_id)          -- 0012: your own company's alerts
     and a.resolved_at is null;

  return jsonb_build_object('ok', true, 'date', v_date, 'alerts', v_rows);
end $$;
revoke all on function public.attendance_alerts_open(uuid, date) from public;
grant execute on function public.attendance_alerts_open(uuid, date) to authenticated;


-- Acknowledging is a RESOLUTION with a name on it, not a delete: "I know, I
-- called them" is the useful record.
create or replace function public.attendance_alert_ack(p_alert uuid, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare a public.attendance_alerts;
begin
  select * into a from public.attendance_alerts where id = p_alert;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'That alert no longer exists.'); end if;
  if not app.manages_staff(a.staff_id) then raise exception 'not permitted'; end if;
  if a.resolved_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  update public.attendance_alerts
     set resolved_at = now(), resolution = 'acknowledged',
         note = coalesce(trim(p_note), ''), acknowledged_by = auth.uid()
   where id = p_alert;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.attendance_alert_ack(uuid, text) from public;
grant execute on function public.attendance_alert_ack(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0015_auth_onboarding.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- 0015 — Getting IN. Signing in should not require the SQL editor.
--
-- WHAT WAS WRONG
-- Creating a login meant three manual steps in the Supabase dashboard and a
-- hand-written INSERT for the profile row, the organisation membership and the
-- building membership. Miss any one of them and the app signs you in to
-- nothing — which is exactly what happened: an account was created, the
-- password was right, and the product still showed demo mode.
--
-- WHAT THIS DOES
--   1. `handle_new_auth_user` — a new account gets its `public.users` row by
--      itself. (A user row alone grants NOTHING; it is an identity, not access.)
--   2. `org_invites` — an admin invites an email address to a role. When that
--      person signs in, the invitation becomes their membership. No SQL.
--   3. `claim_access()` — called once after every sign-in. Ensures the profile
--      row exists, stamps last_seen_at, and converts any invitation waiting for
--      that address.
--   4. THE FIRST SIGN-IN CLAIMS THE PROJECT. On a project where nobody has ever
--      signed in, the first person to arrive becomes an admin of the
--      organisation that actually runs the site. After that the door is shut:
--      once anybody has signed in, an uninvited arrival gets nothing at all.
--
-- The rules that keep this from being a way in:
--   * an invitation is single-use, expires, and is revocable;
--   * you cannot invite somebody to an organisation you are not in;
--   * you cannot invite somebody to a role above your own — a manager cannot
--     mint a super admin;
--   * bootstrap fires exactly once, and only while the project has no history.
--
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.users add column if not exists last_seen_at timestamptz;

-- --------------------------------------------------------------- invites ----
create table if not exists public.org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  -- optional: also put them on this building when they arrive
  building_id uuid references public.buildings(id) on delete cascade,
  role_id     uuid not null references public.roles(id),
  email       text not null,
  invited_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users(id),
  revoked_at  timestamptz
);
-- one live invitation per address per organisation; re-inviting replaces
create unique index if not exists org_invites_pending
  on public.org_invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.org_invites enable row level security;
do $$ begin
  drop policy if exists invites_read on public.org_invites;
  create policy invites_read on public.org_invites for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists invites_write on public.org_invites;
  create policy invites_write on public.org_invites for all to authenticated
    using (app.in_org(org_id)) with check (app.in_org(org_id));
end $$;


-- ------------------------------------------------- a new account gets a row --
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
             nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(coalesce(new.email, ''), '@', 1)),
    new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- On a locked-down project the trigger may not be creatable; `claim_access()`
-- creates the same row on first sign-in, so this is a convenience, not a
-- dependency. Failing to install it must not fail the migration.
do $$ begin
  if to_regclass('auth.users') is not null then
    begin
      drop trigger if exists on_auth_user_created on auth.users;
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_auth_user();
    exception when insufficient_privilege or others then
      raise notice '0015: could not attach the auth.users trigger (%) — claim_access() covers it', sqlerrm;
    end;
  end if;
end $$;


-- ------------------------------------------------------- invite: create ------
-- Rank roles so nobody can invite somebody above themselves.
create or replace function app.role_rank(p_key text) returns int
language sql immutable as $$
  select case p_key
           when 'super_admin' then 4
           when 'org_admin'   then 3
           when 'manager'     then 2
           else 1                       -- staff, and anything unknown
         end
$$;

create or replace function public.invite_create(
  p_org uuid, p_email text, p_role_key text, p_building uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_role uuid; v_caller_rank int; v_id uuid; v_email text;
begin
  if not app.in_org(p_org) then raise exception 'not permitted'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'That is not a valid email address.');
  end if;

  select id into v_role from public.roles where key = p_role_key;
  if v_role is null then
    return jsonb_build_object('ok', false, 'error', 'Unknown role.');
  end if;

  -- your own rank in THIS organisation, so a manager elsewhere gains nothing
  select coalesce(max(app.role_rank(r.key)), 0) into v_caller_rank
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
   where m.user_id = auth.uid() and m.active and m.org_id = p_org;
  if app.is_super_admin() then v_caller_rank := 4; end if;

  if v_caller_rank < 2 then
    return jsonb_build_object('ok', false,
      'error', 'Only a manager or an admin can invite people.');
  end if;
  if app.role_rank(p_role_key) > v_caller_rank then
    return jsonb_build_object('ok', false,
      'error', 'You cannot invite somebody to a role above your own.');
  end if;

  -- re-inviting the same address replaces the pending invitation rather than
  -- leaving two of them to race
  update public.org_invites
     set revoked_at = now()
   where org_id = p_org and lower(email) = v_email
     and accepted_at is null and revoked_at is null;

  insert into public.org_invites (org_id, building_id, role_id, email, invited_by)
  values (p_org, p_building, v_role, v_email, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'invite_id', v_id, 'email', v_email);
end $$;
revoke all on function public.invite_create(uuid, text, text, uuid) from public;
grant execute on function public.invite_create(uuid, text, text, uuid) to authenticated;


create or replace function public.invite_revoke(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid;
begin
  select org_id into v_org from public.org_invites where id = p_id;
  if v_org is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  if not app.in_org(v_org) then raise exception 'not permitted'; end if;
  update public.org_invites set revoked_at = now() where id = p_id and accepted_at is null;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.invite_revoke(uuid) from public;
grant execute on function public.invite_revoke(uuid) to authenticated;


-- Who is in this organisation, and who has been invited but not arrived.
create or replace function public.org_people(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_members jsonb; v_invites jsonb;
begin
  if not app.in_org(p_org) then raise exception 'not permitted'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.id, 'name', u.name, 'email', u.email,
           'role', r.key, 'role_name', r.name,
           'last_seen_at', u.last_seen_at,
           'never_signed_in', u.last_seen_at is null
         ) order by u.name), '[]'::jsonb)
    into v_members
    from public.organisation_memberships m
    join public.users u on u.id = m.user_id
    join public.roles r on r.id = m.role_id
   where m.org_id = p_org and m.active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'email', i.email, 'role', r.key, 'role_name', r.name,
           'created_at', i.created_at, 'expires_at', i.expires_at,
           'expired', i.expires_at < now()
         ) order by i.created_at desc), '[]'::jsonb)
    into v_invites
    from public.org_invites i
    join public.roles r on r.id = i.role_id
   where i.org_id = p_org and i.accepted_at is null and i.revoked_at is null;

  return jsonb_build_object('ok', true, 'members', v_members, 'invites', v_invites);
end $$;
revoke all on function public.org_people(uuid) from public;
grant execute on function public.org_people(uuid) to authenticated;


-- ========================================================== claim_access =====
-- Called once after every sign-in. Everything it does is for the CALLER: it
-- cannot be used to grant access to anybody else.
create or replace function public.claim_access()
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text;
  v_claimed int := 0; v_bootstrapped boolean := false;
  v_org uuid; v_role uuid; i record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not signed in');
  end if;

  select lower(u.email), u.raw_user_meta_data ->> 'name'
    into v_email, v_name
    from auth.users u where u.id = v_uid;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'account has no email');
  end if;

  -- 1. the profile row, in case the trigger is not installed
  insert into public.users (id, name, email)
  values (v_uid, coalesce(nullif(trim(v_name), ''), split_part(v_email, '@', 1)), v_email)
  on conflict (id) do nothing;

  -- 2. accept every invitation waiting for this address
  for i in
    select * from public.org_invites
     where lower(email) = v_email
       and accepted_at is null and revoked_at is null and expires_at > now()
  loop
    insert into public.organisation_memberships (org_id, user_id, role_id)
    values (i.org_id, v_uid, i.role_id)
    on conflict (org_id, user_id) do nothing;

    if i.building_id is not null then
      insert into public.building_memberships (building_id, org_id, user_id)
      values (i.building_id, i.org_id, v_uid)
      on conflict do nothing;
    else
      -- otherwise every building that organisation already services
      insert into public.building_memberships (building_id, org_id, user_id)
      select bo.building_id, i.org_id, v_uid
        from public.building_organisations bo
       where bo.org_id = i.org_id and bo.active
      on conflict do nothing;
    end if;

    update public.org_invites
       set accepted_at = now(), accepted_by = v_uid where id = i.id;
    v_claimed := v_claimed + 1;
  end loop;

  -- 3. THE FIRST SIGN-IN CLAIMS THE PROJECT — and only the first.
  if v_claimed = 0
     and not exists (select 1 from public.organisation_memberships
                      where user_id = v_uid and active)
     and not exists (select 1 from public.users
                      where last_seen_at is not null and id <> v_uid)
  then
    -- the organisation that actually runs a site here, else the oldest one
    select org_id into v_org from (
      select s.org_id, count(*) as n
        from public.staff s where s.active group by s.org_id
       order by n desc limit 1) t;
    if v_org is null then
      select id into v_org from public.organisations order by created_at limit 1;
    end if;

    if v_org is not null then
      select id into v_role from public.roles where key = 'org_admin';
      insert into public.organisation_memberships (org_id, user_id, role_id)
      values (v_org, v_uid, v_role)
      on conflict (org_id, user_id) do nothing;
      insert into public.building_memberships (building_id, org_id, user_id)
      select bo.building_id, v_org, v_uid
        from public.building_organisations bo where bo.org_id = v_org and bo.active
      on conflict do nothing;
      v_bootstrapped := true;
    end if;
  end if;

  -- 4. stamped LAST: the bootstrap test above reads this column, so writing it
  --    earlier would lock the very first person out of their own project.
  update public.users set last_seen_at = now() where id = v_uid;

  return jsonb_build_object('ok', true,
    'claimed', v_claimed, 'bootstrapped', v_bootstrapped,
    'has_access', exists (select 1 from public.organisation_memberships
                           where user_id = v_uid and active));
end $$;
revoke all on function public.claim_access() from public;
grant execute on function public.claim_access() to authenticated;

