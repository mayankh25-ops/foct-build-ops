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
