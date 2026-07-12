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
