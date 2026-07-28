-- =============================================================================
-- NEW_BUILDING.sql — set up a REAL building for testing or a first client.
--
-- Until the onboarding screens exist (Stage 2 phase 8), this script is the
-- "who creates it" answer for the things that sit ABOVE a building's day-to-day
-- work: organisations, the building itself, which modules are switched on, and
-- which people belong to which organisation.
--
-- Everything BELOW that level is already self-service in the app:
--   cleaners + their kiosk PINs .... Settings → Cleaners & kiosks → Cleaners
--   kiosk tablets + pair codes ..... Settings → Cleaners & kiosks → Kiosk tablets
--   themes ......................... Settings → Appearance
--   email/SMS providers ............ Settings → Integrations
--
-- HOW TO USE
--   1. Create the login first: Supabase dashboard → Authentication → Users →
--      Add user (tick "Auto Confirm User"). Do this for every person.
--   2. Edit the six values in the `params` block below.
--   3. Paste the whole file into the SQL editor and Run.
--   4. Sign in as that user — the building, its modules and your role are there.
--
-- Safe to re-run: every insert is idempotent on its natural key.
-- =============================================================================

do $$
declare
  -- ------------------------------------------------------------- params ----
  p_building_name   text := 'Aurora on Collins';        -- the tower
  p_building_slug   text := 'aurora-on-collins';        -- lowercase, hyphens
  p_building_addr   text := '380 Collins Street, Melbourne VIC 3000';

  p_owner_org       text := 'Meridian Strata Group';    -- owns the building
  p_cleaning_org    text := 'FOCT Cleaning';            -- services it

  -- the person who will sign in (must already exist in Authentication → Users)
  p_admin_email     text := 'you@example.com';
  p_admin_name      text := 'Your Name';
  -- which org they work for: 'owner' or 'cleaning'
  p_admin_side      text := 'cleaning';
  -- 'org_admin' (full) or 'manager' (day-to-day)
  p_admin_role      text := 'org_admin';
  -- --------------------------------------------------------------------------

  v_owner uuid; v_cleaning uuid; v_building uuid; v_user uuid; v_role uuid;
  v_admin_org uuid;
begin
  -- 1. the two organisations -------------------------------------------------
  insert into public.organisations (type_id, name, slug)
  select ot.id, p_owner_org, regexp_replace(lower(p_owner_org), '[^a-z0-9]+', '-', 'g')
    from public.organisation_types ot where ot.key = 'owner_strata'
  on conflict (slug) do nothing;
  select id into v_owner from public.organisations
   where slug = regexp_replace(lower(p_owner_org), '[^a-z0-9]+', '-', 'g');

  insert into public.organisations (type_id, name, slug)
  select ot.id, p_cleaning_org, regexp_replace(lower(p_cleaning_org), '[^a-z0-9]+', '-', 'g')
    from public.organisation_types ot where ot.key = 'cleaning'
  on conflict (slug) do nothing;
  select id into v_cleaning from public.organisations
   where slug = regexp_replace(lower(p_cleaning_org), '[^a-z0-9]+', '-', 'g');

  -- 2. the building ----------------------------------------------------------
  insert into public.buildings (name, slug, address, owner_org_id)
  values (p_building_name, p_building_slug, p_building_addr, v_owner)
  on conflict (slug) do update set name = excluded.name, address = excluded.address;
  select id into v_building from public.buildings where slug = p_building_slug;

  -- 3. who services it — the cross-org grants the isolation rules read -------
  insert into public.building_organisations (building_id, org_id, relationship)
  values (v_building, v_owner, 'owner'), (v_building, v_cleaning, 'cleaning')
  on conflict do nothing;

  -- 4. which modules are switched on ----------------------------------------
  --    Core + CleaningOps + Service Desk live; the rest stay "coming soon".
  insert into public.building_modules (building_id, module_id, status)
  select v_building, m.id,
         case when m.key in ('cleaning_ops','service_desk','calendar') then 'enabled'
              else 'coming_soon' end
    from public.modules m
  on conflict (building_id, module_id) do update set status = excluded.status;

  -- 5. the person -----------------------------------------------------------
  select id into v_user from auth.users where lower(email) = lower(p_admin_email);
  if v_user is null then
    raise exception 'No login for %. Create it first: Authentication → Users → Add user (tick Auto Confirm User).', p_admin_email;
  end if;

  insert into public.users (id, name, email)
  values (v_user, p_admin_name, lower(p_admin_email))
  on conflict (id) do update set name = excluded.name, email = excluded.email;

  v_admin_org := case when p_admin_side = 'owner' then v_owner else v_cleaning end;
  select id into v_role from public.roles where key = p_admin_role;

  insert into public.organisation_memberships (org_id, user_id, role_id)
  values (v_admin_org, v_user, v_role)
  on conflict (org_id, user_id) do update set role_id = excluded.role_id, active = true;

  insert into public.building_memberships (building_id, org_id, user_id)
  values (v_building, v_admin_org, v_user)
  on conflict do nothing;

  raise notice 'Ready: % — % signs in as % at %.',
    p_building_name, p_admin_email, p_admin_role,
    (select name from public.organisations where id = v_admin_org);
end $$;

-- Confirm it worked (should list your building and role):
select b.name as building, o.name as organisation, r.key as role, u.email
  from public.building_memberships bm
  join public.buildings b on b.id = bm.building_id
  join public.organisations o on o.id = bm.org_id
  join public.users u on u.id = bm.user_id
  join public.organisation_memberships m on m.user_id = u.id and m.org_id = o.id
  join public.roles r on r.id = m.role_id
 order by b.name, u.email;
