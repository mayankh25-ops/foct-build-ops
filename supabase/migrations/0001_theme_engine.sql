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
create policy themes_read on public.themes
  for select using (
    is_builtin
    or (org_id is not null and app.is_org_member(org_id))
  );

-- write: only members of the owning org, never on built-ins.
create policy themes_insert on public.themes
  for insert with check (
    not is_builtin
    and org_id = app.current_org_id()
  );

create policy themes_update on public.themes
  for update using (
    not is_builtin and app.is_org_member(org_id)
  ) with check (
    not is_builtin and org_id = app.current_org_id()
  );

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
create policy bta_read on public.building_theme_assignments
  for select using (app.is_org_member((select b.owner_org_id from public.buildings b where b.id = building_id))
                    or exists (select 1 from public.building_organisations bo
                               where bo.building_id = building_theme_assignments.building_id
                                 and app.is_org_member(bo.organisation_id)));

-- write: building managers/owner org only.
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

create trigger themes_touch before update on public.themes
  for each row execute function public.touch_updated_at();
