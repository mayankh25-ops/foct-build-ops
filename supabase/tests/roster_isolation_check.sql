-- Roster (0011) — who is meant to be here, and when.
-- Run in the SQL editor after applying 0011. Expect 14 ok notices.
--
-- The rules being proven are the ones that stop a roster lying: a shift that
-- ends before it starts, the same person rostered twice at once, a copy that
-- silently drops shifts, and another company reading the board.
do $$
declare
  v_building uuid; v_tz text; v_week date; v_next date;
  v_alice uuid; v_bob uuid; v_res jsonb; v_shift uuid; v_count int;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, timezone into v_building, v_tz from public.buildings where slug = 'aurora-on-collins';
  v_week := app.week_start(v_building, now());
  v_next := v_week + 7;

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  v_alice := (public.staff_create(v_building, 'Roster Alice') ->> 'staff_id')::uuid;
  v_bob   := (public.staff_create(v_building, 'Roster Bob')   ->> 'staff_id')::uuid;

  -- start clean, in case an earlier run left shifts behind
  delete from public.roster_shifts
   where building_id = v_building and staff_id in (v_alice, v_bob);

  -- 1. a shift is created
  v_res := public.roster_shift_set(v_building, v_alice, v_week, 6 * 60, 14 * 60, 'Lobby', 'marble');
  v_shift := (v_res ->> 'id')::uuid;
  if (v_res ->> 'ok')::boolean and v_shift is not null then
    raise notice 'ok 1: a shift is created';
  else raise exception 'FAIL 1: %', v_res; end if;

  -- 2. a shift that ends before it starts is refused
  v_res := public.roster_shift_set(v_building, v_alice, v_week + 1, 14 * 60, 6 * 60);
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 2: a finish before the start is refused';
  else raise exception 'FAIL 2: inverted shift accepted'; end if;

  -- 3. THE OVERLAP RULE: the same person, the same day, overlapping times
  v_res := public.roster_shift_set(v_building, v_alice, v_week, 13 * 60, 18 * 60);
  if not (v_res ->> 'ok')::boolean and (v_res ->> 'overlap')::boolean then
    raise notice 'ok 3: an overlapping shift for the same person is refused';
  else raise exception 'FAIL 3: overlap accepted'; end if;

  -- 4. back-to-back is fine — 14:00 finish, 14:00 start
  v_res := public.roster_shift_set(v_building, v_alice, v_week, 14 * 60, 18 * 60, 'L9–L24');
  if (v_res ->> 'ok')::boolean then
    raise notice 'ok 4: back-to-back shifts are allowed';
  else raise exception 'FAIL 4: %', v_res; end if;

  -- 5. two DIFFERENT people at the same time is normal, not a clash
  v_res := public.roster_shift_set(v_building, v_bob, v_week, 6 * 60, 14 * 60, 'Car park');
  if (v_res ->> 'ok')::boolean then
    raise notice 'ok 5: two people may work the same hours';
  else raise exception 'FAIL 5: %', v_res; end if;

  -- 6. the same times on a DIFFERENT day is not a clash either
  v_res := public.roster_shift_set(v_building, v_alice, v_week + 1, 6 * 60, 14 * 60, 'Lobby');
  if (v_res ->> 'ok')::boolean then
    raise notice 'ok 6: the same hours on another day are fine';
  else raise exception 'FAIL 6: %', v_res; end if;

  -- 7. somebody else's employee cannot be rostered here
  v_res := public.roster_shift_set(v_building, gen_random_uuid(), v_week, 6 * 60, 10 * 60);
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 7: a stranger cannot be rostered onto this site';
  else raise exception 'FAIL 7: stranger rostered'; end if;

  -- ---------------------------------------------------------------- read --
  v_res := public.roster_week(v_building, v_week);

  -- 8. the board returns the week's shifts with names attached
  if (v_res ->> 'ok')::boolean
     and (select count(*) from jsonb_array_elements(v_res -> 'shifts') s
           where (s ->> 'staff_id')::uuid in (v_alice, v_bob)) = 4
     and exists (select 1 from jsonb_array_elements(v_res -> 'shifts') s
                  where s ->> 'staff_name' = 'Roster Alice') then
    raise notice 'ok 8: the week returns its shifts, with names';
  else raise exception 'FAIL 8: %', v_res; end if;

  -- 9. per-person weekly totals are computed for the timesheet comparison
  if (select (st ->> 'rostered_minutes')::int
       from jsonb_array_elements(v_res -> 'staff') st
      where (st ->> 'id')::uuid = v_alice) = 1200 then   -- 8h + 4h + 8h = 20h
    raise notice 'ok 9: weekly rostered minutes are totalled per person';
  else raise exception 'FAIL 9: alice total %',
    (select st ->> 'rostered_minutes' from jsonb_array_elements(v_res -> 'staff') st
      where (st ->> 'id')::uuid = v_alice); end if;

  -- 10. the TIMESHEET reads the same rows — the two screens cannot disagree
  if (select (r ->> 'rostered_minutes')::int
       from jsonb_array_elements(public.timesheet_week(v_building, v_week) -> 'rows') r
      where (r ->> 'staff_id')::uuid = v_alice) = 1200 then
    raise notice 'ok 10: the timesheet reads the same rostered hours';
  else raise exception 'FAIL 10: timesheet disagrees with the roster'; end if;

  -- ---------------------------------------------------------- edit/delete --
  -- 11. an edit that would overlap is refused, leaving the original intact
  v_res := public.roster_shift_set(v_building, v_alice, v_week, 13 * 60, 20 * 60,
                                   'Lobby', '', v_shift);
  if not (v_res ->> 'ok')::boolean
     and (select end_min from public.roster_shifts where id = v_shift) = 14 * 60 then
    raise notice 'ok 11: an overlapping EDIT is refused and changes nothing';
  else raise exception 'FAIL 11: %', v_res; end if;

  -- 12. a legitimate edit applies
  v_res := public.roster_shift_set(v_building, v_alice, v_week, 5 * 60, 13 * 60,
                                   'Lobby', 'early start', v_shift);
  if (v_res ->> 'ok')::boolean
     and (select start_min from public.roster_shifts where id = v_shift) = 5 * 60 then
    raise notice 'ok 12: a shift can be moved';
  else raise exception 'FAIL 12: %', v_res; end if;

  -- ------------------------------------------------------------ copy week --
  -- 13. copying reports what it copied AND what it skipped
  delete from public.roster_shifts
   where building_id = v_building and work_date between v_next and v_next + 6;
  perform public.roster_shift_set(v_building, v_alice, v_next, 5 * 60, 13 * 60, 'Lobby');
  v_res := public.roster_copy_week(v_building, v_week, v_next);
  if (v_res ->> 'ok')::boolean
     and (v_res ->> 'copied')::int >= 3
     and (v_res ->> 'skipped')::int = 1 then
    raise notice 'ok 13: copying a week reports copied and skipped counts';
  else raise exception 'FAIL 13: %', v_res; end if;

  -- 14. ISOLATION: another company cannot read this board
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
      raise notice 'ok 14: (no rival org seeded to test against)';
    else
      perform set_config('request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_rival), true);
      begin
        perform public.roster_week(v_building, v_week);
        raise exception 'FAIL 14: a rival org read this roster';
      exception when others then
        if sqlerrm like '%not permitted%' then
          raise notice 'ok 14: another company cannot read this roster';
        else raise; end if;
      end;
    end if;
  end;
end $$;
