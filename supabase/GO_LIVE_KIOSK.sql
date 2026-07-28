-- =============================================================================
-- GO_LIVE_KIOSK.sql — one paste that makes the kiosk usable.
--
-- Creates a cleaner (with a PIN), a tablet (with a pair code) and today's
-- notice, then PRINTS THE PIN AND THE PAIR CODE in the results grid. Nothing
-- else is needed before someone can sign in.
--
-- Everything here can also be done by clicking, in Settings → Cleaners &
-- kiosks. This file exists so the first one doesn't have to be.
--
-- HOW TO USE
--   1. Edit the six values in the `params` block.
--   2. Run. Read the PIN and the 6-digit pair code off the results grid.
--   3. On the tablet, open  https://<your-site>/kiosk  and type the pair code.
--   4. The cleaner types their PIN → selfie → signed in.
--
-- Safe to re-run: it reuses the same person and tablet rather than making
-- duplicates, and re-issues a fresh pair code each time (the old one dies).
-- =============================================================================

do $$
declare
  -- ------------------------------------------------------------- params ----
  -- the account you sign in to the web app with; the cleaner is created as
  -- though you had clicked "Add cleaner", so your permissions are what apply
  p_admin_email  text := 'you@example.com';

  -- which site. Leave null to use the only building you have.
  p_site_slug    text := null;

  p_cleaner_name text := 'Test Cleaner';
  p_cleaner_role text := 'Cleaner';
  p_tablet_label text := 'Cleaners room tablet';

  -- today's notice, in as many languages as you like
  p_notice_en    text := 'Loading dock closed until 06:30 — use the Little Collins St entry.';
  p_notice_hi    text := 'लोडिंग डॉक 06:30 तक बंद है — लिटिल कॉलिन्स स्ट्रीट से आएं।';
  -- --------------------------------------------------------------------------

  v_user uuid; v_building uuid; v_org uuid; v_site text;
  v_staff uuid; v_pin text; v_device uuid; v_code text; v_res jsonb;
begin
  -- who am I acting as? staff_create checks permissions, so this must be a
  -- real account that manages the building
  select id into v_user from auth.users where lower(email) = lower(p_admin_email);
  if v_user is null then
    raise exception
      'No login for %. Create it first: Authentication → Users → Add user (tick Auto Confirm User), then run supabase/NEW_BUILDING.sql.',
      p_admin_email;
  end if;
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_user), true);

  -- which building?
  if p_site_slug is null then
    select id, name, owner_org_id into v_building, v_site, v_org
      from public.buildings order by created_at limit 1;
  else
    select id, name, owner_org_id into v_building, v_site, v_org
      from public.buildings where slug = p_site_slug;
  end if;
  if v_building is null then
    raise exception 'No building found. Run supabase/NEW_BUILDING.sql first.';
  end if;

  -- ---------------------------------------------------------- the cleaner --
  select id into v_staff from public.staff
   where building_id = v_building and name = p_cleaner_name and active;
  if v_staff is null then
    v_res := public.staff_create(v_building, p_cleaner_name, p_cleaner_role);
    v_staff := (v_res ->> 'staff_id')::uuid;
    v_pin   := v_res ->> 'pin';
  else
    -- already there from a previous run: issue a fresh PIN so this file always
    -- hands you a working one
    v_pin := public.staff_reset_pin(v_staff) ->> 'pin';
  end if;

  -- ----------------------------------------------------------- the tablet --
  select id into v_device from public.kiosk_devices
   where building_id = v_building and label = p_tablet_label and active;
  if v_device is null then
    v_res := public.kiosk_device_create(v_building, p_tablet_label);
    v_device := (v_res ->> 'device_id')::uuid;
    v_code   := v_res ->> 'pair_code';
  else
    -- a re-run un-pairs and re-pairs: the tablet gets a new code, the old one
    -- stops working immediately
    v_code := public.kiosk_issue_pair_code(v_device);
  end if;

  -- ----------------------------------------------------------- the notice --
  if not exists (select 1 from public.notices
                  where building_id = v_building and staff_id is null
                    and body ->> 'en' = p_notice_en) then
    insert into public.notices (building_id, org_id, title, body, priority, created_by)
    values (v_building, v_org,
            jsonb_build_object('en', 'Today', 'hi', 'आज'),
            jsonb_strip_nulls(jsonb_build_object('en', nullif(p_notice_en, ''),
                                                 'hi', nullif(p_notice_hi, ''))),
            'important', v_user);
  end if;

  -- hand the credentials back through a temp table so they land in the
  -- results grid rather than only in the notices pane
  drop table if exists kiosk_setup;
  create temp table kiosk_setup (step text, value text);
  insert into kiosk_setup values
    ('1. Site',              v_site),
    ('2. Cleaner',           p_cleaner_name),
    ('3. THEIR PIN',         v_pin),
    ('4. Tablet',            p_tablet_label),
    ('5. PAIR CODE (24h)',   v_code),
    ('6. On the tablet open','https://<your-site>/kiosk  → type the pair code'),
    ('7. Then',              p_cleaner_name || ' types ' || v_pin || ' → selfie → signed in');

  raise notice 'PIN % · pair code % · site %', v_pin, v_code, v_site;
end $$;

select * from kiosk_setup order by step;
