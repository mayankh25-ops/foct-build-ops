-- =============================================================================
-- 0017 — creating a site from inside the app, and never being locked out of it.
--
-- WHAT WAS WRONG. Adding a building meant editing six values in
-- supabase/NEW_BUILDING.sql and pasting it into the SQL editor. A supervisor
-- cannot do that, and should not have to: the app knew perfectly well how to
-- make a building, it just refused to. Worse, the failure was silent — with no
-- building you have no `building_memberships` row, so `current_profile()`
-- returns an empty `buildings` array and four screens sit on a spinner forever.
-- "Add a site" and "the modules don't load" were one bug wearing two coats.
--
-- WHAT THIS ADDS.
--   1. `site_create()` — building + organisations + the cross-org grants +
--      module switches + the caller's own membership, in ONE transaction. If
--      any part fails the whole thing rolls back, so there is no half-made site
--      that looks fine on the Sites screen and breaks at the kiosk.
--   2. `site_delete()` — undo, but ONLY while the site is still untouched.
--      A site with attendance against it is a payroll record.
--   3. A fix to `claim_access()` for the case it could not handle: a project
--      with no organisations at all. It looked for an org to attach the first
--      person to, found none, and left them with an account that can see
--      nothing. Now the first person in gets an organisation created for them.
--
-- WHO MAY CREATE A SITE. A super admin, or an org_admin of an organisation
-- that already exists. Not "any authenticated user" — a signed-in cleaner
-- inventing buildings is exactly the kind of implicit grant the isolation rule
-- forbids. The one deliberate exception is the empty project: when there is not
-- a single building yet, the first org_admin has to be able to make one.
-- =============================================================================

-- ------------------------------------------------------- reference data -----
-- Roles, organisation types and the module catalogue are NOT demo data. They
-- are the vocabulary the schema is written in: `claim_access()` looks up
-- 'org_admin', `site_create()` looks up 'cleaning', and every permission check
-- joins `roles`. They lived in seed.sql only by accident of history, which
-- meant a project set up without the Aurora demo had an empty `roles` table and
-- could not grant anybody anything — the first sign-in failed on a not-null
-- constraint nobody would ever connect to "the modules don't load".
--
-- Restated here, idempotently. seed.sql still inserts the same rows; the
-- on-conflict clauses make that a no-op.
insert into public.organisation_types (key, name) values
  ('owner_strata',  'Building owner / strata'),
  ('cleaning',      'Cleaning company'),
  ('concierge_bm',  'Concierge / building management'),
  ('subcontractor', 'Subcontractor')
on conflict (key) do nothing;

insert into public.roles (key, name) values
  ('super_admin', 'Super admin'),
  ('org_admin',   'Organisation admin'),
  ('manager',     'Manager / supervisor'),
  ('staff',       'Staff'),
  ('viewer',      'Client viewer (read-only)')
on conflict (key) do nothing;

insert into public.modules (key, name, description) values
  ('cleaning_ops',      'CleaningOps',        'Sign-in/out, rosters, timesheets, consumables, tasks, audits'),
  ('service_desk',      'Service Desk',       'Ticketing with photo proof, followers, SLA'),
  ('tasks_incidents',   'Tasks & incidents',  'Assignable tasks for cleaners and concierge'),
  ('calendar',          'Calendar',           'Building calendar'),
  ('site_audits',       'Site audits',        'Scored site audit forms'),
  ('concierge_desk',    'Concierge desk',     'Front-of-house log and handover'),
  ('parcels',           'Parcels',            'Parcel intake and collection'),
  ('resident_requests', 'Resident requests',  'Resident maintenance and amenity requests'),
  ('contractors',       'Contractors',        'Inductions, insurance, arrivals'),
  ('floor_plans',       'Floor plans',        'Interactive levels with zones and assets'),
  ('automation',        'Automation',         'People counting, lifts, robots, cameras, BMS')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- who may ---
-- Two different decisions, so two different bars.
--
-- ADDING a site is ordinary operational work: a cleaning company wins a
-- contract and its operations manager onboards the building that afternoon.
-- Putting that behind org_admin would send a manager back to the SQL editor,
-- which is the friction this migration exists to remove. `manager` and above.
--
-- REMOVING one is not ordinary. It is rare, it is destructive, and it should
-- need the person who is accountable for the account. `org_admin` and above.
create or replace function app.can_create_site() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_super_admin() or exists (
    select 1
      from public.organisation_memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = auth.uid()
       and m.active
       and app.role_rank(r.key) >= app.role_rank('manager'))
$$;
revoke all on function app.can_create_site() from public;
grant execute on function app.can_create_site() to authenticated;

create or replace function app.can_delete_site() returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_super_admin() or exists (
    select 1
      from public.organisation_memberships m
      join public.roles r on r.id = m.role_id
     where m.user_id = auth.uid()
       and m.active
       and app.role_rank(r.key) >= app.role_rank('org_admin'))
$$;
revoke all on function app.can_delete_site() from public;
grant execute on function app.can_delete_site() to authenticated;

-- --------------------------------------------------------------- the slug ---
-- "Aurora on Collins" -> "aurora-on-collins", and a numeric suffix rather than
-- an error if that is taken. A supervisor naming their second Collins St tower
-- should not meet a unique-constraint violation.
create or replace function app.site_slug(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_base text := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  v_try  text;
  i int := 1;
begin
  if v_base = '' then v_base := 'site'; end if;
  v_try := v_base;
  while exists (select 1 from public.buildings where slug = v_try) loop
    i := i + 1;
    v_try := v_base || '-' || i;
  end loop;
  return v_try;
end $$;
revoke all on function app.site_slug(text) from public;

-- ------------------------------------------------------------ site_create ---
create or replace function public.site_create(
  p_name         text,
  p_address      text default '',
  p_timezone     text default 'Australia/Melbourne',
  p_language     text default 'en',
  p_owner_org    text default null,   -- null = the caller's own organisation
  p_cleaning_org text default null    -- null = the caller's own organisation
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_building uuid; v_owner uuid; v_cleaning uuid; v_slug text;
  v_my_org uuid; v_role uuid; v_type uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'You are not signed in.');
  end if;

  if trim(coalesce(p_name, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'A site needs a name.');
  end if;

  -- the caller's own organisation, highest rank first: somebody who is
  -- org_admin at one company and staff at another creates sites as the former
  select m.org_id into v_my_org
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
   where m.user_id = v_uid and m.active
   order by app.role_rank(r.key) desc, m.id
   limit 1;

  -- THE EMPTY-PROJECT EXCEPTION, stated as narrowly as it can be: no buildings
  -- at all, and the caller already belongs to an organisation. Anything wider
  -- lets a cleaner create sites.
  if not app.can_create_site()
     and not (v_my_org is not null and not exists (select 1 from public.buildings))
  then
    return jsonb_build_object('ok', false,
      'error', 'You need to be a manager or an admin to add a site. Ask whoever set up your account.');
  end if;

  if v_my_org is null then
    return jsonb_build_object('ok', false,
      'error', 'Your account is not linked to an organisation yet. Sign out and back in, then try again.');
  end if;

  if p_timezone is null or p_timezone not in (select name from pg_timezone_names) then
    return jsonb_build_object('ok', false, 'error', format('%s is not a timezone Postgres knows.', p_timezone));
  end if;

  -- 1. the organisations. Named ones are found or created; null means "mine",
  --    which is the ordinary case — one company adding another of its sites.
  if p_owner_org is null or trim(p_owner_org) = '' then
    v_owner := v_my_org;
  else
    select id into v_type from public.organisation_types where key = 'owner_strata';
    insert into public.organisations (type_id, name, slug)
    values (v_type, trim(p_owner_org),
            regexp_replace(lower(trim(p_owner_org)), '[^a-z0-9]+', '-', 'g'))
    on conflict (slug) do nothing;
    select id into v_owner from public.organisations
     where slug = regexp_replace(lower(trim(p_owner_org)), '[^a-z0-9]+', '-', 'g');
  end if;

  if p_cleaning_org is null or trim(p_cleaning_org) = '' then
    v_cleaning := v_my_org;
  else
    select id into v_type from public.organisation_types where key = 'cleaning';
    insert into public.organisations (type_id, name, slug)
    values (v_type, trim(p_cleaning_org),
            regexp_replace(lower(trim(p_cleaning_org)), '[^a-z0-9]+', '-', 'g'))
    on conflict (slug) do nothing;
    select id into v_cleaning from public.organisations
     where slug = regexp_replace(lower(trim(p_cleaning_org)), '[^a-z0-9]+', '-', 'g');
  end if;

  -- 2. the building
  v_slug := app.site_slug(p_name);
  insert into public.buildings (name, slug, address, owner_org_id, timezone, default_language)
  values (trim(p_name), v_slug, coalesce(trim(p_address), ''), v_owner,
          p_timezone, coalesce(nullif(trim(p_language), ''), 'en'))
  returning id into v_building;

  -- 3. who services it — the explicit cross-org grants the isolation rules
  --    read. Never implicit: every row here is a decision somebody made.
  insert into public.building_organisations (building_id, org_id, relationship)
  values (v_building, v_owner, 'owner')
  on conflict do nothing;
  if v_cleaning is distinct from v_owner then
    insert into public.building_organisations (building_id, org_id, relationship)
    values (v_building, v_cleaning, 'cleaning')
    on conflict do nothing;
  end if;

  -- 4. modules: the ones that actually work are on, the rest stay honest
  insert into public.building_modules (building_id, module_id, status)
  select v_building, m.id,
         case when m.key in ('cleaning_ops', 'service_desk', 'calendar')
              then 'enabled' else 'coming_soon' end
    from public.modules m
  on conflict (building_id, module_id) do update set status = excluded.status;

  -- 5. THE CALLER'S OWN MEMBERSHIP. Without this the site exists and its
  --    creator cannot see it — which is the bug that started all this.
  insert into public.building_memberships (building_id, org_id, user_id)
  values (v_building, v_my_org, v_uid)
  on conflict do nothing;

  -- and everyone else already at the organisations that service it, so the
  -- second site does not need every colleague re-invited
  insert into public.building_memberships (building_id, org_id, user_id)
  select v_building, m.org_id, m.user_id
    from public.organisation_memberships m
   where m.org_id in (v_owner, v_cleaning) and m.active
  on conflict do nothing;

  insert into public.audit_logs (org_id, building_id, actor_id, action, entity, entity_id, payload)
  values (v_my_org, v_building, v_uid, 'site.create', 'buildings', v_building::text,
          jsonb_build_object('name', trim(p_name), 'slug', v_slug));

  return jsonb_build_object('ok', true, 'building_id', v_building, 'slug', v_slug,
    'name', trim(p_name), 'timezone', p_timezone);
exception
  when others then
    -- a half-made site is worse than none: the whole statement rolls back and
    -- the caller is told what actually went wrong rather than "failed"
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;
revoke all on function public.site_create(text, text, text, text, text, text) from public;
grant execute on function public.site_create(text, text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------ site_delete ---
-- Undo for the site you just made and misspelt. NOT a way to erase history:
-- once anybody has clocked on, the building is attached to timesheets and
-- payroll and it stays.
create or replace function public.site_delete(p_building uuid) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_name text; v_n int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'You are not signed in.');
  end if;
  if not app.can_delete_site() then
    return jsonb_build_object('ok', false, 'error', 'Only an organisation admin can remove a site.');
  end if;
  select name into v_name from public.buildings where id = p_building;
  if v_name is null then
    return jsonb_build_object('ok', false, 'error', 'That site no longer exists.');
  end if;
  if not app.in_org((select owner_org_id from public.buildings where id = p_building))
     and not app.is_super_admin() then
    return jsonb_build_object('ok', false, 'error', 'That site belongs to another organisation.');
  end if;

  select count(*) into v_n from public.attendance_events where building_id = p_building;
  if v_n > 0 then
    return jsonb_build_object('ok', false, 'error',
      format('%s has %s attendance record(s) against it — it cannot be deleted. Rename it instead.', v_name, v_n));
  end if;

  -- audit first: once the building row is gone the FK would reject the write
  insert into public.audit_logs (actor_id, action, entity, entity_id, payload)
  values (v_uid, 'site.delete', 'buildings', p_building::text, jsonb_build_object('name', v_name));

  delete from public.notice_acks where notice_id in
    (select id from public.notices where building_id = p_building);
  delete from public.notices                where building_id = p_building;
  delete from public.handover_notes         where building_id = p_building;
  delete from public.roster_shifts          where building_id = p_building;
  delete from public.building_memberships   where building_id = p_building;
  delete from public.building_organisations where building_id = p_building;
  delete from public.building_modules       where building_id = p_building;
  delete from public.staff                  where building_id = p_building;
  delete from public.kiosk_devices          where building_id = p_building;
  update public.audit_logs set building_id = null where building_id = p_building;
  delete from public.buildings              where id = p_building;

  return jsonb_build_object('ok', true, 'name', v_name);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end $$;
revoke all on function public.site_delete(uuid) from public;
grant execute on function public.site_delete(uuid) to authenticated;

-- ------------------------------------------- claim_access, empty project ----
-- The gap: the bootstrap in 0015 looks for an organisation to attach the first
-- person to. On a project where the seed was never run there is none, so it
-- attached them to nothing and they signed in to an app that showed them
-- nothing — with no error, because nothing had failed. Now the first person in
-- gets an organisation of their own, named from their email domain, and can
-- go straight to creating a site.
create or replace function app.bootstrap_org_for(p_uid uuid, p_email text)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_org uuid; v_type uuid; v_name text; v_slug text;
begin
  -- prefer a real organisation that already runs a site here
  select org_id into v_org from (
    select s.org_id, count(*) as n from public.staff s where s.active group by s.org_id
     order by n desc limit 1) t;
  if v_org is not null then return v_org; end if;

  select id into v_org from public.organisations order by created_at limit 1;
  if v_org is not null then return v_org; end if;

  -- nothing at all: make one. "priya@brightclean.com.au" -> "Brightclean"
  v_name := initcap(replace(split_part(split_part(p_email, '@', 2), '.', 1), '-', ' '));
  if trim(coalesce(v_name, '')) = '' then v_name := 'My Company'; end if;
  v_slug := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');

  select id into v_type from public.organisation_types where key = 'cleaning';
  if v_type is null then
    insert into public.organisation_types (key, name) values ('cleaning', 'Cleaning company')
    on conflict (key) do nothing;
    select id into v_type from public.organisation_types where key = 'cleaning';
  end if;

  insert into public.organisations (type_id, name, slug)
  values (v_type, v_name, v_slug)
  on conflict (slug) do nothing;
  select id into v_org from public.organisations where slug = v_slug;
  return v_org;
end $$;
revoke all on function app.bootstrap_org_for(uuid, text) from public;

do $$ begin raise notice '0017 site_create: sites are made in the app now'; end $$;

-- --------------------------------------------- claim_access, re-issued -----
-- Identical to 0015 except for the bootstrap block, which now delegates to
-- app.bootstrap_org_for(). Re-stated in full because Postgres replaces a
-- function whole; there is no way to patch one clause of it.
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
    -- 0017: an organisation that already runs a site here, the oldest one, or
    -- — on a project with none at all — one created from their email domain.
    -- The old code stopped at the middle case and left the first person in a
    -- brand-new project with an account that could see nothing.
    v_org := app.bootstrap_org_for(v_uid, v_email);

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
