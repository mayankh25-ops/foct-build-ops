-- Timesheets (0010) — the hours a person is paid for.
-- Run in the SQL editor after applying 0010. Expect 20 ok notices.
--
-- These assertions are about money. Each one is a way a week could be paid
-- wrongly: hours lost, hours doubled, a correction with no reason, a change
-- made after approval, or a decision nobody can trace.
do $$
declare
  v_building uuid; v_org uuid; v_tz text; v_week date;
  v_device uuid; v_token uuid; v_res jsonb; v_row jsonb;
  v_alice uuid; v_bob uuid; v_pin text;
  v_in1 uuid; v_in2 uuid; v_open uuid;
  v_count int; v_status text;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, owner_org_id, timezone into v_building, v_org, v_tz
    from public.buildings where slug = 'aurora-on-collins';
  v_week := app.week_start(v_building, now());

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  v_res  := public.staff_create(v_building, 'Timesheet Alice');
  v_alice := (v_res ->> 'staff_id')::uuid;
  v_bob   := (public.staff_create(v_building, 'Timesheet Bob') ->> 'staff_id')::uuid;

  -- two completed sessions today (2h and 3h30) and one still open
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_alice, 'in',  now() - interval '9 hours', 'kiosk') returning id into v_in1;
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_alice, 'out', now() - interval '7 hours', 'kiosk');
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_alice, 'in',  now() - interval '6 hours', 'kiosk') returning id into v_in2;
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_alice, 'out', now() - interval '2 hours 30 minutes', 'kiosk');
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_bob, 'in', now() - interval '1 hour', 'kiosk') returning id into v_open;

  -- a rostered 8h day for Alice, to compare against
  insert into public.roster_shifts (building_id, staff_id, work_date, start_min, end_min, zone)
  values (v_building, v_alice, (now() at time zone v_tz)::date, 6 * 60, 14 * 60, 'Lobby')
  on conflict do nothing;

  -- ---------------------------------------------------------------- read --
  v_res := public.timesheet_week(v_building, v_week);
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_alice;

  -- 1. punches become worked minutes
  if (v_row ->> 'worked_minutes')::int = 330 then      -- 120 + 210
    raise notice 'ok 1: two sessions add up to 5h30 worked';
  else raise exception 'FAIL 1: worked % minutes', v_row ->> 'worked_minutes'; end if;

  -- 2. the roster is reported beside it, so variance is visible
  if (v_row ->> 'rostered_minutes')::int = 480 then
    raise notice 'ok 2: rostered hours come from the roster, not the punches';
  else raise exception 'FAIL 2: rostered %', v_row ->> 'rostered_minutes'; end if;

  -- 3. each session is listed individually for review
  if jsonb_array_length(v_row -> 'sessions') = 2 then
    raise notice 'ok 3: every session is listed for review';
  else raise exception 'FAIL 3: % sessions', jsonb_array_length(v_row -> 'sessions'); end if;

  -- 4. a session with no check-out pays nothing but is FLAGGED, not hidden
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_bob;
  if (v_row ->> 'worked_minutes')::int = 0 and (v_row ->> 'open_sessions')::int = 1 then
    raise notice 'ok 4: an unclosed shift pays nothing and is flagged';
  else raise exception 'FAIL 4: %', v_row; end if;

  -- 5. a new week starts pending, not approved
  if v_row ->> 'status' = 'pending' then
    raise notice 'ok 5: a week starts pending';
  else raise exception 'FAIL 5: status %', v_row ->> 'status'; end if;

  -- ---------------------------------------------------------- corrections --
  -- 6. a correction without a reason is refused
  v_res := public.attendance_adjust(v_in1, 30, '   ');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 6: a correction with no reason is refused';
  else raise exception 'FAIL 6: reasonless correction accepted'; end if;

  -- 7. a correction applies, and the ORIGINAL PUNCH IS UNTOUCHED
  v_res := public.attendance_adjust(v_in1, 30, 'stayed to finish the lobby');
  if (v_res ->> 'ok')::boolean
     and (select at from public.attendance_events where id = v_in1)
         between now() - interval '9 hours 1 minute' and now() - interval '8 hours 59 minutes' then
    raise notice 'ok 7: the correction sits beside the punch; the punch is unchanged';
  else raise exception 'FAIL 7: %', v_res; end if;

  -- 8. it shows up in the week total and against its own session
  v_res := public.timesheet_week(v_building, v_week);
  select r into v_row from jsonb_array_elements(v_res -> 'rows') r
   where (r ->> 'staff_id')::uuid = v_alice;
  if (v_row ->> 'adjustment_minutes')::int = 30
     and exists (select 1 from jsonb_array_elements(v_row -> 'sessions') s
                  where (s ->> 'session_event_id')::uuid = v_in1
                    and (s ->> 'adjustment_minutes')::int = 30
                    and s ->> 'adjustment_note' <> '') then
    raise notice 'ok 8: the correction appears on its session and in the total';
  else raise exception 'FAIL 8: %', v_row; end if;

  -- 9. re-correcting the same session replaces, never stacks
  perform public.attendance_adjust(v_in1, 45, 'recount');
  select count(*) into v_count from public.attendance_adjustments where session_event_id = v_in1;
  if v_count = 1 and (select delta_minutes from public.attendance_adjustments
                       where session_event_id = v_in1) = 45 then
    raise notice 'ok 9: a second correction replaces the first';
  else raise exception 'FAIL 9: % rows', v_count; end if;

  -- 10. a zero correction removes it rather than storing a no-op
  perform public.attendance_adjust(v_in2, 15, 'ran over');
  perform public.attendance_adjust(v_in2, 0, 'my mistake');
  if not exists (select 1 from public.attendance_adjustments where session_event_id = v_in2) then
    raise notice 'ok 10: setting a correction to zero removes it';
  else raise exception 'FAIL 10: zero correction stored'; end if;

  -- 11. corrections attach to a check-IN, not a check-out
  v_res := public.attendance_adjust(
    (select id from public.attendance_events
      where staff_id = v_alice and kind = 'out' order by at limit 1), 10, 'nope');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 11: a correction cannot attach to a check-out';
  else raise exception 'FAIL 11: attached to a check-out'; end if;

  -- ------------------------------------------------------------ decisions --
  -- 12. rejecting requires a reason
  v_res := public.timesheet_decide(v_building, v_alice, v_week, 'rejected', null, '');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 12: a rejection with no reason is refused';
  else raise exception 'FAIL 12: reasonless rejection accepted'; end if;

  -- 13. rejecting records the reason and who decided
  v_res := public.timesheet_decide(v_building, v_alice, v_week, 'rejected', null,
                                   'Thursday looks wrong — check with the site');
  select status into v_status from public.timesheet_weeks
   where building_id = v_building and staff_id = v_alice and week_start = v_week;
  if (v_res ->> 'ok')::boolean and v_status = 'rejected'
     and (select decided_by from public.timesheet_weeks
           where building_id = v_building and staff_id = v_alice and week_start = v_week) = c_manager then
    raise notice 'ok 13: a rejection records the reason and the decider';
  else raise exception 'FAIL 13: status %', v_status; end if;

  -- 14. approving pays worked + corrections by default
  v_res := public.timesheet_decide(v_building, v_alice, v_week, 'approved', null, 'ok for payroll');
  if (v_res ->> 'approved_minutes')::int = 375 then     -- 330 worked + 45 correction
    raise notice 'ok 14: approving pays worked hours plus corrections';
  else raise exception 'FAIL 14: paid %', v_res ->> 'approved_minutes'; end if;

  -- 15. THE LOCK: an approved week refuses further corrections
  v_res := public.attendance_adjust(v_in1, 90, 'sneaky');
  if not (v_res ->> 'ok')::boolean and (v_res ->> 'locked')::boolean then
    raise notice 'ok 15: an approved week is locked against changes';
  else raise exception 'FAIL 15: approved week accepted a change'; end if;

  -- 16. reopening clears the decision, and corrections work again
  perform public.timesheet_decide(v_building, v_alice, v_week, 'pending', null, 'reopened to fix Thursday');
  v_res := public.attendance_adjust(v_in1, 60, 'agreed with the site');
  if (v_res ->> 'ok')::boolean
     and (select decided_at is null from public.timesheet_weeks
           where building_id = v_building and staff_id = v_alice and week_start = v_week) then
    raise notice 'ok 16: reopening clears the decision and unlocks corrections';
  else raise exception 'FAIL 16: %', v_res; end if;

  -- 17. a manager may override the paid figure
  v_res := public.timesheet_decide(v_building, v_alice, v_week, 'approved', 300, 'agreed 5h flat');
  if (v_res ->> 'approved_minutes')::int = 300 then
    raise notice 'ok 17: a manager can override the paid figure';
  else raise exception 'FAIL 17: paid %', v_res ->> 'approved_minutes'; end if;

  -- 18. deciding twice updates the same week rather than creating a second
  perform public.timesheet_decide(v_building, v_alice, v_week, 'pending');
  perform public.timesheet_decide(v_building, v_alice, v_week, 'approved', null, 'final');
  select count(*) into v_count from public.timesheet_weeks
   where building_id = v_building and staff_id = v_alice and week_start = v_week;
  if v_count = 1 then raise notice 'ok 18: one decision row per person per week';
  else raise exception 'FAIL 18: % rows', v_count; end if;

  -- 19. an unknown employee is refused
  v_res := public.timesheet_decide(v_building, gen_random_uuid(), v_week, 'approved');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 19: a stranger cannot be approved onto this site';
  else raise exception 'FAIL 19: unknown employee approved'; end if;

  -- 20. ISOLATION: another company's manager sees none of this
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
      raise notice 'ok 20: (no rival org seeded to test against)';
    else
      perform set_config('request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_rival), true);
      begin
        perform public.timesheet_week(v_building, v_week);
        raise exception 'FAIL 20: a rival org read this building''s timesheet';
      exception when others then
        if sqlerrm like '%not permitted%' then
          raise notice 'ok 20: another company cannot read this timesheet';
        else raise; end if;
      end;
    end if;
  end;
end $$;
