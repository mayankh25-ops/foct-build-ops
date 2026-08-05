-- Creating a site from inside the app (0017). Expect 17 ok notices.
--
-- The thing being proved here is not "a row was inserted". It is that after
-- site_create() returns, the person who called it can actually SEE the site —
-- because the failure this migration exists to fix was a building that existed
-- and was invisible to its own creator, which presents as four screens stuck on
-- a loading spinner and no error anywhere.
--
-- Priya is a MANAGER, deliberately. She is the persona who onboards a new
-- building, and if the test used an org_admin it would not prove that the
-- everyday case works.
do $$
declare
  v_res jsonb; v_b uuid; v_dup uuid; v_n int;
  c_super  constant uuid := '22222222-0000-0000-0000-000000000001'; -- super admin
  c_sandra constant uuid := '22222222-0000-0000-0000-000000000002'; -- Meridian Strata, org_admin
  c_priya  constant uuid := '22222222-0000-0000-0000-000000000003'; -- FOCT Cleaning, MANAGER
  c_marcus constant uuid := '22222222-0000-0000-0000-000000000004'; -- FOCT Cleaning, staff
begin
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);

  -- 1. a site is created in one call
  v_res := public.site_create('Regent Place', '120 Queen Street, Melbourne VIC 3000',
                              'Australia/Melbourne', 'en');
  v_b := (v_res ->> 'building_id')::uuid;
  if (v_res ->> 'ok')::boolean and v_b is not null then
    raise notice 'ok 1: a manager creates a site without touching the SQL editor';
  else raise exception 'FAIL 1: %', v_res; end if;

  -- 2. THE CREATOR CAN SEE IT. This is the whole point.
  if exists (select 1 from public.building_memberships
              where building_id = v_b and user_id = c_priya) then
    raise notice 'ok 2: whoever created it is a member of it';
  else raise exception 'FAIL 2: the creator has no membership — the site is invisible to them'; end if;

  -- 3. and current_profile() actually returns it, which is what the app reads
  --    to decide whether the Cleaners screen has a building to load
  if exists (select 1 from jsonb_array_elements(
               (public.current_profile() -> 'buildings')) b
              where (b ->> 'id')::uuid = v_b) then
    raise notice 'ok 3: the new site appears in the signed-in profile';
  else raise exception 'FAIL 3: site missing from current_profile — screens will hang'; end if;

  -- 4. the slug is derived, not demanded of the user
  if (v_res ->> 'slug') = 'regent-place' then
    raise notice 'ok 4: the slug is worked out from the name';
  else raise exception 'FAIL 4: %', v_res ->> 'slug'; end if;

  -- 5. a SECOND site of the same name gets its own slug rather than an error
  v_res := public.site_create('Regent Place');
  v_dup := (v_res ->> 'building_id')::uuid;
  if (v_res ->> 'ok')::boolean and (v_res ->> 'slug') = 'regent-place-2' then
    raise notice 'ok 5: a duplicate name is suffixed, not rejected';
  else raise exception 'FAIL 5: %', v_res; end if;

  -- 6. the timezone is stored, because every "today" in attendance reads it
  if (select timezone from public.buildings where id = v_b) = 'Australia/Melbourne' then
    raise notice 'ok 6: the site keeps its own clock';
  else raise exception 'FAIL 6: wrong timezone'; end if;

  -- 7. a nonsense timezone is refused BEFORE a building is made
  select count(*) into v_n from public.buildings;
  v_res := public.site_create('Bad Clock Tower', '', 'Mars/Olympus');
  if not (v_res ->> 'ok')::boolean
     and (select count(*) from public.buildings) = v_n then
    raise notice 'ok 7: an invalid timezone is refused and nothing is created';
  else raise exception 'FAIL 7: %', v_res; end if;

  -- 8. an unnamed site is refused
  v_res := public.site_create('   ');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 8: a site must have a name';
  else raise exception 'FAIL 8: unnamed site accepted'; end if;

  -- 9. the cross-org grant exists — the isolation rules read this row, and
  --    without it the site is serviced by nobody
  if exists (select 1 from public.building_organisations where building_id = v_b) then
    raise notice 'ok 9: the servicing organisation is recorded explicitly';
  else raise exception 'FAIL 9: no building_organisations row'; end if;

  -- 10. modules are switched on, so the site is not a shell
  if (select count(*) from public.building_modules
       where building_id = v_b and status = 'enabled') >= 2 then
    raise notice 'ok 10: cleaning + service desk are enabled at a new site';
  else raise exception 'FAIL 10: no modules enabled'; end if;

  -- 11. it is audited
  if exists (select 1 from public.audit_logs
              where action = 'site.create' and entity_id = v_b::text) then
    raise notice 'ok 11: creating a site is written to the audit log';
  else raise exception 'FAIL 11: not audited'; end if;

  -- ------------------------------------------------- who may -----------------
  -- 12. A CLEANER CANNOT INVENT BUILDINGS. Sites already exist, so the
  --     empty-project exception does not apply to them.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_marcus), true);
  v_res := public.site_create('Marcus Tower');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 12: staff cannot create sites';
  else raise exception 'FAIL 12: a cleaner created a building'; end if;

  -- 13. and cannot delete one either
  v_res := public.site_delete(v_b);
  if not (v_res ->> 'ok')::boolean
     and exists (select 1 from public.buildings where id = v_b) then
    raise notice 'ok 13: staff cannot delete sites';
  else raise exception 'FAIL 13: %', v_res; end if;

  -- 14. THE TWO BARS ARE DIFFERENT. Priya just created two sites; she still
  --     cannot delete one. Onboarding is daily work, removal is not.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);
  v_res := public.site_delete(v_dup);
  if not (v_res ->> 'ok')::boolean
     and exists (select 1 from public.buildings where id = v_dup) then
    raise notice 'ok 14: a manager may add a site but not delete one';
  else raise exception 'FAIL 14: manager deleted a site — %', v_res; end if;

  -- 15. ANOTHER COMPANY'S ADMIN CANNOT DELETE YOUR SITE. Sandra is a genuine
  --     org_admin, so this tests the cross-org guard and not the rank guard.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_sandra), true);
  v_res := public.site_delete(v_b);
  if not (v_res ->> 'ok')::boolean
     and exists (select 1 from public.buildings where id = v_b) then
    raise notice 'ok 15: another organisation''s admin cannot delete your site';
  else raise exception 'FAIL 15: cross-org delete succeeded — %', v_res; end if;

  -- ------------------------------------------------- undo, but not erasure ---
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_super), true);

  -- 16. a site with attendance against it STAYS — it is a payroll record
  declare v_staff uuid;
  begin
    insert into public.staff (org_id, building_id, name, role, pin, active)
    select org_id, v_b, 'Test Cleaner', 'cleaner', '4821', true
      from public.building_organisations where building_id = v_b limit 1
    returning id into v_staff;
    insert into public.attendance_events (building_id, staff_id, kind, at, source)
    values (v_b, v_staff, 'in', now(), 'kiosk');

    v_res := public.site_delete(v_b);
    if not (v_res ->> 'ok')::boolean
       and exists (select 1 from public.buildings where id = v_b) then
      raise notice 'ok 16: a site with attendance against it cannot be deleted';
    else raise exception 'FAIL 16: deleted a site holding payroll evidence — %', v_res; end if;

    delete from public.attendance_events where building_id = v_b;
    delete from public.staff where id = v_staff;
  end;

  -- 17. an untouched one can be removed — the misspelt-name undo
  v_res := public.site_delete(v_b);
  if (v_res ->> 'ok')::boolean
     and not exists (select 1 from public.buildings where id = v_b) then
    raise notice 'ok 17: a brand-new site can be undone';
  else raise exception 'FAIL 17: %', v_res; end if;

  perform public.site_delete(v_dup);   -- leave the seed as we found it
end $$;
