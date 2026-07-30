-- Today (0012) — who is actually here, against who was meant to be.
-- Run in the SQL editor after applying 0012. Expect 16 ok notices.
--
-- Each assertion is a way this screen could mislead a supervisor: someone
-- reported missing before their shift could have started, a late arrival
-- counted as absent, a person who never signed out looking finished, or a
-- strata manager reading cleaning staff names they are not entitled to.
do $$
declare
  v_building uuid; v_tz text; v_today date; v_res jsonb; v_row jsonb;
  v_alice uuid; v_bob uuid; v_cara uuid; v_dan uuid; v_now_min int;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, timezone into v_building, v_tz from public.buildings where slug = 'aurora-on-collins';
  v_today := (now() at time zone v_tz)::date;
  v_now_min := floor(extract(epoch from (now() at time zone v_tz)::time) / 60)::int;

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  v_alice := (public.staff_create(v_building, 'Today Alice') ->> 'staff_id')::uuid;
  v_bob   := (public.staff_create(v_building, 'Today Bob')   ->> 'staff_id')::uuid;
  v_cara  := (public.staff_create(v_building, 'Today Cara')  ->> 'staff_id')::uuid;
  v_dan   := (public.staff_create(v_building, 'Today Dan')   ->> 'staff_id')::uuid;

  -- a clean slate for these four
  delete from public.attendance_events
   where building_id = v_building and staff_id in (v_alice, v_bob, v_cara, v_dan);
  delete from public.roster_shifts
   where building_id = v_building and staff_id in (v_alice, v_bob, v_cara, v_dan);

  -- Alice: rostered from two hours ago, signed in an hour ago, STILL HERE
  perform public.roster_shift_set(v_building, v_alice, v_today,
    greatest(0, v_now_min - 120), least(1440, v_now_min + 120), 'Lobby');
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_alice, 'in', now() - interval '1 hour', 'kiosk');

  -- Bob: rostered from three hours ago, worked two hours and LEFT
  perform public.roster_shift_set(v_building, v_bob, v_today,
    greatest(0, v_now_min - 180), greatest(1, v_now_min - 30), 'Car park');
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_bob, 'in',  now() - interval '3 hours', 'kiosk'),
         (v_building, v_bob, 'out', now() - interval '1 hour',  'kiosk');

  -- Cara: rostered from two hours ago and NEVER CHECKED IN
  perform public.roster_shift_set(v_building, v_cara, v_today,
    greatest(0, v_now_min - 120), least(1440, v_now_min + 120), 'L9–L24');

  -- Dan: not rostered at all, but signed in — the unexpected extra
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_dan, 'in', now() - interval '30 minutes', 'kiosk');

  v_res := public.attendance_day(v_building, v_today);

  -- 1. the read answers, with the building's own timezone
  if (v_res ->> 'ok')::boolean and v_res ->> 'timezone' = v_tz then
    raise notice 'ok 1: the day reads back in the building''s timezone';
  else raise exception 'FAIL 1: %', v_res; end if;

  -- 2. STILL ON SITE
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_alice;
  if v_row ->> 'state' = 'on_site' and (v_row ->> 'on_site')::boolean
     and v_row ->> 'open_since' is not null then
    raise notice 'ok 2: someone signed in and not out is ON SITE';
  else raise exception 'FAIL 2: %', v_row; end if;

  -- 3. an open session pays nothing yet — worked minutes count closed sessions only
  if (v_row ->> 'worked_minutes')::int = 0 and (v_row ->> 'open_sessions')::int = 1 then
    raise notice 'ok 3: an unfinished session contributes no worked minutes';
  else raise exception 'FAIL 3: %', v_row; end if;

  -- 4. FINISHED, with the hours that were actually worked
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_bob;
  if v_row ->> 'state' = 'finished' and (v_row ->> 'worked_minutes')::int = 120
     and v_row ->> 'last_out' is not null then
    raise notice 'ok 4: a completed shift is finished, with real worked minutes';
  else raise exception 'FAIL 4: %', v_row; end if;

  -- 5. MISSED: rostered, start plus grace passed, no check-in
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_cara;
  if v_row ->> 'state' = 'missed' and (v_row ->> 'sessions')::int = 0 then
    raise notice 'ok 5: a rostered no-show is MISSED';
  else raise exception 'FAIL 5: %', v_row; end if;

  -- 6. the missing person is listed FIRST — a supervisor reads problems first
  if (v_res -> 'rows' -> 0 ->> 'staff_id')::uuid = v_cara then
    raise notice 'ok 6: problems sort to the top of the day';
  else raise exception 'FAIL 6: first row %', v_res -> 'rows' -> 0 ->> 'staff_name'; end if;

  -- 7. someone here who was not rostered is flagged, not hidden
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_dan;
  if (v_row ->> 'unrostered')::boolean and v_row ->> 'state' = 'on_site'
     and (v_row ->> 'rostered_minutes')::int = 0 then
    raise notice 'ok 7: someone here who was never rostered is flagged';
  else raise exception 'FAIL 7: %', v_row; end if;

  -- 8. the summary counts what the rows say
  if (v_res -> 'summary' ->> 'on_site')::int >= 2
     and (v_res -> 'summary' ->> 'missed')::int >= 1
     and (v_res -> 'summary' ->> 'unrostered_here')::int >= 1 then
    raise notice 'ok 8: the summary agrees with the rows';
  else raise exception 'FAIL 8: %', v_res -> 'summary'; end if;

  -- ------------------------------------------------------- late vs missed --
  -- 9. LATE is not missed: Cara signs in now, an hour after her start
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_cara, 'in', now(), 'kiosk');
  v_res := public.attendance_day(v_building, v_today);
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_cara;
  if v_row ->> 'state' = 'on_site' and (v_row ->> 'late_minutes')::int > 0 then
    raise notice 'ok 9: a late arrival is here and late, not absent';
  else raise exception 'FAIL 9: %', v_row; end if;

  -- 10. arriving INSIDE the grace period is not late at all
  declare v_eve uuid;
  begin
    v_eve := (public.staff_create(v_building, 'Today Eve') ->> 'staff_id')::uuid;
    perform public.roster_shift_set(v_building, v_eve, v_today,
      greatest(0, v_now_min - 5), least(1440, v_now_min + 300), 'Lobby');
    insert into public.attendance_events (building_id, staff_id, kind, at, source)
    values (v_building, v_eve, 'in', now(), 'kiosk');
    select r into v_row from jsonb_array_elements(
      public.attendance_day(v_building, v_today) -> 'rows') r
     where (r ->> 'staff_id')::uuid = v_eve;
    if (v_row ->> 'late_minutes')::int = 0 then
      raise notice 'ok 10: arriving within the grace period is not late';
    else raise exception 'FAIL 10: late by %', v_row ->> 'late_minutes'; end if;

    -- 11. the grace period is honoured: with zero grace, the same arrival IS late
    select r into v_row from jsonb_array_elements(
      public.attendance_day(v_building, v_today, 0) -> 'rows') r
     where (r ->> 'staff_id')::uuid = v_eve;
    if (v_row ->> 'late_minutes')::int > 0 then
      raise notice 'ok 11: the grace period is a parameter, and it is applied';
    else raise exception 'FAIL 11: zero grace did not make it late'; end if;
  end;

  -- 12. NOTHING IS MISSED BEFORE IT COULD HAPPEN: tomorrow reports upcoming
  declare v_fay uuid;
  begin
    v_fay := (public.staff_create(v_building, 'Today Fay') ->> 'staff_id')::uuid;
    perform public.roster_shift_set(v_building, v_fay, v_today + 1, 6 * 60, 14 * 60, 'Lobby');
    select r into v_row from jsonb_array_elements(
      public.attendance_day(v_building, v_today + 1) -> 'rows') r
     where (r ->> 'staff_id')::uuid = v_fay;
    if v_row ->> 'state' = 'upcoming' then
      raise notice 'ok 12: a future shift is upcoming, never missed';
    else raise exception 'FAIL 12: tomorrow reported %', v_row ->> 'state'; end if;
  end;

  -- 13. a shift later TODAY is upcoming too, until its start plus grace
  declare v_gus uuid;
  begin
    if v_now_min < 1200 then
      v_gus := (public.staff_create(v_building, 'Today Gus') ->> 'staff_id')::uuid;
      perform public.roster_shift_set(v_building, v_gus, v_today,
        least(1439, v_now_min + 120), 1440, 'Lobby');
      select r into v_row from jsonb_array_elements(
        public.attendance_day(v_building, v_today) -> 'rows') r
       where (r ->> 'staff_id')::uuid = v_gus;
      if v_row ->> 'state' = 'upcoming' then
        raise notice 'ok 13: a shift still to start today is upcoming';
      else raise exception 'FAIL 13: reported %', v_row ->> 'state'; end if;
    else
      raise notice 'ok 13: (too late in the day to test an upcoming shift)';
    end if;
  end;

  -- 14. NEVER SIGNED OUT on a past day is reported as overdue, not finished
  declare v_hal uuid;
  begin
    v_hal := (public.staff_create(v_building, 'Today Hal') ->> 'staff_id')::uuid;
    perform public.roster_shift_set(v_building, v_hal, v_today - 1, 6 * 60, 14 * 60, 'Lobby');
    insert into public.attendance_events (building_id, staff_id, kind, at, source)
    values (v_building, v_hal, 'in',
            ((v_today - 1)::timestamp + interval '6 hours') at time zone v_tz, 'kiosk');
    select r into v_row from jsonb_array_elements(
      public.attendance_day(v_building, v_today - 1) -> 'rows') r
     where (r ->> 'staff_id')::uuid = v_hal;
    if v_row ->> 'state' = 'on_site' and (v_row ->> 'overdue_minutes')::int > 0 then
      raise notice 'ok 14: a shift never signed out is overdue, not quietly closed';
    else raise exception 'FAIL 14: %', v_row; end if;
  end;

  -- ---------------------------------------------------------- isolation --
  -- 15. THE OWNER SIDE SEES COUNTS, NOT NAMES.
  declare v_strata uuid; v_seen jsonb;
  begin
    select u.id into v_strata from public.users u
     join public.organisation_memberships m on m.user_id = u.id
     join public.organisations o on o.id = m.org_id
    where o.slug = 'meridian-strata' limit 1;
    if v_strata is null then
      raise notice 'ok 15: (no strata user seeded to test against)';
    else
      perform set_config('request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_strata), true);
      v_seen := public.attendance_day(v_building, v_today);
      if not (v_seen ->> 'detail')::boolean
         and jsonb_array_length(v_seen -> 'rows') = 0
         and (v_seen -> 'summary' ->> 'people')::int > 0 then
        raise notice 'ok 15: the building owner sees progress, not cleaning staff names';
      else raise exception 'FAIL 15: strata saw % rows', jsonb_array_length(v_seen -> 'rows'); end if;
    end if;
  end;

  -- 16. ANOTHER COMPANY SEES NOTHING AT ALL.
  declare v_rival uuid;
  begin
    select u.id into v_rival from public.users u
     join public.organisation_memberships m on m.user_id = u.id
     join public.organisations o on o.id = m.org_id
    where o.slug not in (select o2.slug from public.organisations o2
                          join public.building_organisations bo on bo.org_id = o2.id
                         where bo.building_id = v_building)
    limit 1;
    if v_rival is null then
      raise notice 'ok 16: (no rival org seeded to test against)';
    else
      perform set_config('request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_rival), true);
      begin
        perform public.attendance_day(v_building, v_today);
        raise exception 'FAIL 16: a rival org read this building''s day';
      exception when others then
        if sqlerrm like '%not permitted%' then
          raise notice 'ok 16: another company cannot read this day at all';
        else raise; end if;
      end;
    end if;
  end;
end $$;
