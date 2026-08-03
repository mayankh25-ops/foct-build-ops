-- =============================================================================
-- Multi-org isolation at a SHARED building (0012). Expect 22 ok notices.
--
-- This is the suite that proves the promise the product is sold on. Every other
-- test asks "does the feature work"; this one asks "can the wrong company read
-- it". The setup is the real situation: one tower, five organisations, TWO
-- competing cleaning companies, and a concierge firm and an electrician who are
-- legitimately on site and must still see nothing about anybody's staff.
--
-- IMPORTANT: every probe runs `set local role authenticated`. A superuser
-- bypasses RLS, so a suite that forgets this passes no matter what the policies
-- say. And these reads only mean anything because `_mirror_bootstrap.sql` grants
-- tables to `authenticated` the way a Supabase project does.
--
-- Every assertion names the ROWS that must not be visible, rather than counting
-- to zero. A real project has its own history — an owner-side org may have
-- provisioned a tablet or a cleaner of its own, and seeing YOUR OWN row is the
-- system working. (The zero-count version of this suite failed on the owner's
-- project for exactly that reason: a tablet left behind by an earlier run
-- belonged to the strata org, so the strata admin could rightly see it.)
-- =============================================================================
do $$
declare
  v_building uuid; v_tz text; v_today date; v_week date;
  v_foct uuid; v_rival uuid;
  v_foct_staff uuid; v_foct_pin text; v_rival_staff uuid;
  v_foct_shift uuid; v_foct_event uuid;
  v_device uuid; v_pair text; v_token uuid;
  v_res jsonb; v_n int; v_ok boolean;
  c_priya    constant uuid := '22222222-0000-0000-0000-000000000003'; -- manager, FOCT Cleaning
  c_rita     constant uuid := '22222222-0000-0000-0000-00000000000a'; -- manager, Rival Cleaning
  c_amelia   constant uuid := '22222222-0000-0000-0000-000000000007'; -- concierge staff
  c_sandra   constant uuid := '22222222-0000-0000-0000-000000000002'; -- strata org admin
  c_ben      constant uuid := '22222222-0000-0000-0000-000000000009'; -- electrical subcontractor
begin
  select id, timezone into v_building, v_tz from public.buildings where slug = 'aurora-on-collins';
  v_today := (now() at time zone v_tz)::date;
  v_week  := app.week_start(v_building, now());
  select id into v_foct  from public.organisations where slug = 'foct-cleaning';
  select id into v_rival from public.organisations where slug = 'rival-cleaning';

  -- ---------------------------------------------------------------- setup --
  -- Put the SECOND cleaning company on the same building, the way a strata
  -- manager would when splitting a contract. This is the case the isolation
  -- rule exists for, and it is not in the shipped seed.
  insert into public.building_organisations (building_id, org_id, relationship)
  values (v_building, v_rival, 'cleaning')
  on conflict (building_id, org_id) do nothing;
  insert into public.building_memberships (building_id, org_id, user_id)
  values (v_building, v_rival, c_rita)
  on conflict (building_id, org_id, user_id) do nothing;

  -- FOCT's cleaner, with a shift, a punch, a correction and a decided week
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);
  v_res := public.staff_create(v_building, 'Isolation Fiona');
  v_foct_staff := (v_res ->> 'staff_id')::uuid;
  v_foct_pin   := v_res ->> 'pin';
  v_foct_shift := (public.roster_shift_set(v_building, v_foct_staff, v_today,
                     6 * 60, 14 * 60, 'Lobby') ->> 'id')::uuid;
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_foct_staff, 'in', now() - interval '2 hours', 'kiosk')
  returning id into v_foct_event;
  perform public.attendance_adjust(v_foct_event, 15, 'ran over');
  perform public.timesheet_decide(v_building, v_foct_staff, v_week, 'approved', null, 'ok');

  -- Rival's cleaner, with a shift of their own and their own tablet
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_rita), true);
  v_rival_staff := (public.staff_create(v_building, 'Isolation Raj') ->> 'staff_id')::uuid;
  perform public.roster_shift_set(v_building, v_rival_staff, v_today, 6 * 60, 14 * 60, 'Car park');
  v_device := (public.kiosk_device_create(v_building, 'Rival tablet') ->> 'device_id')::uuid;
  v_pair   := public.kiosk_issue_pair_code(v_device);   -- returns the code itself
  v_token  := (public.kiosk_pair(v_pair) ->> 'device_token')::uuid;

  -- ============================ the concierge company ======================
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_amelia), true);
  execute 'set local role authenticated';

  -- 1. no cleaning staff records
  if not exists (select 1 from public.staff where id in (v_foct_staff, v_rival_staff)) then
    raise notice 'ok 1: the concierge sees NO cleaning staff records';
  else raise exception 'FAIL 1: the concierge read a cleaner''s record'; end if;

  -- 2. the PIN column is not even addressable — a PIN is a credential
  begin
    execute 'select pin from public.staff limit 1';
    raise exception 'FAIL 2: the PIN column is readable through the API';
  exception
    when insufficient_privilege then
      raise notice 'ok 2: the kiosk PIN column cannot be selected by any API role';
  end;

  -- 3. not the roster either
  if not exists (select 1 from public.roster_shifts
                  where staff_id in (v_foct_staff, v_rival_staff)) then
    raise notice 'ok 3: the concierge sees no cleaning roster';
  else raise exception 'FAIL 3: the concierge read a cleaning shift'; end if;

  -- 4. nor when anybody came and went
  if not exists (select 1 from public.attendance_events where staff_id = v_foct_staff) then
    raise notice 'ok 4: the concierge sees no check-in history';
  else raise exception 'FAIL 4: the concierge read a cleaner''s check-in'; end if;

  -- 5. nor what anybody is paid
  if not exists (select 1 from public.timesheet_weeks where staff_id = v_foct_staff) then
    raise notice 'ok 5: the concierge sees no timesheets';
  else raise exception 'FAIL 5: the concierge read a timesheet week'; end if;

  -- 6. nor the corrections behind them
  if not exists (select 1 from public.attendance_adjustments
                  where session_event_id = v_foct_event) then
    raise notice 'ok 6: the concierge sees no payroll corrections';
  else raise exception 'FAIL 6: the concierge read a payroll correction'; end if;

  -- 7. BUT the day's PROGRESS is still available — counts, never names
  v_res := public.attendance_day(v_building, v_today);
  if not (v_res ->> 'detail')::boolean
     and jsonb_array_length(v_res -> 'rows') = 0
     and (v_res -> 'summary' ->> 'people')::int > 0 then
    raise notice 'ok 7: the concierge sees cleaning PROGRESS without any names';
  else raise exception 'FAIL 7: %', v_res; end if;
  execute 'reset role';

  -- ============================ the building owner =========================
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_sandra), true);
  execute 'set local role authenticated';

  -- 8. owning the building does not mean owning its contractors' records
  if not exists (select 1 from public.staff where id in (v_foct_staff, v_rival_staff)) then
    raise notice 'ok 8: the strata manager sees no cleaning staff records';
  else raise exception 'FAIL 8: the strata manager read a cleaner''s record'; end if;

  -- 9. nor a cleaning company's tablet, whose pair code provisions a kiosk.
  --    (A tablet the OWNER org provisioned for itself stays visible to it —
  --     that is ownership working, not a leak, so this names the rival's row.)
  if not exists (select 1 from public.kiosk_devices where id = v_device) then
    raise notice 'ok 9: the strata manager sees no cleaning company''s tablet';
  else raise exception 'FAIL 9: the strata manager read another org''s kiosk'; end if;

  -- 10. and the device token is unreadable even where a row is visible
  begin
    execute 'select device_token from public.kiosk_devices limit 1';
    raise exception 'FAIL 10: the device token is readable through the API';
  exception
    when insufficient_privilege then
      raise notice 'ok 10: the kiosk device token cannot be selected by any API role';
  end;
  execute 'reset role';

  -- ============================ the electrician ============================
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_ben), true);
  execute 'set local role authenticated';

  -- 11. a subcontractor on site sees nothing of the cleaners
  if not exists (select 1 from public.staff where id in (v_foct_staff, v_rival_staff))
     and not exists (select 1 from public.attendance_events where staff_id = v_foct_staff) then
    raise notice 'ok 11: the electrical subcontractor sees nothing of the cleaners';
  else raise exception 'FAIL 11: the subcontractor read a cleaner''s record or check-in'; end if;
  execute 'reset role';

  -- ================== the OTHER cleaning company, same tower ===============
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_rita), true);
  execute 'set local role authenticated';

  -- 12. its own crew, and only its own
  if exists (select 1 from public.staff where id = v_rival_staff)
     and not exists (select 1 from public.staff where id = v_foct_staff) then
    raise notice 'ok 12: a competing cleaning company sees only ITS OWN staff';
  else raise exception 'FAIL 12: rival saw own crew: %, saw FOCT: %',
    exists (select 1 from public.staff where id = v_rival_staff),
    exists (select 1 from public.staff where id = v_foct_staff); end if;

  -- 13. not the other company's roster
  if not exists (select 1 from public.roster_shifts where staff_id = v_foct_staff) then
    raise notice 'ok 13: a competing company cannot read the other roster';
  else raise exception 'FAIL 13: rival read a FOCT shift'; end if;

  -- 14. not their punches
  if not exists (select 1 from public.attendance_events where staff_id = v_foct_staff) then
    raise notice 'ok 14: a competing company cannot read the other punches';
  else raise exception 'FAIL 14: rival read FOCT attendance'; end if;

  -- 15. not their pay
  if not exists (select 1 from public.timesheet_weeks where staff_id = v_foct_staff) then
    raise notice 'ok 15: a competing company cannot read the other timesheets';
  else raise exception 'FAIL 15: rival read a FOCT timesheet week'; end if;
  execute 'reset role';

  -- 16. and cannot ROSTER somebody else's employee
  v_res := public.roster_shift_set(v_building, v_foct_staff, v_today + 1, 6 * 60, 10 * 60);
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 16: a competing company cannot roster the other''s cleaner';
  else raise exception 'FAIL 16: rival rostered a FOCT cleaner'; end if;

  -- 17. nor DELETE their shift
  begin
    v_res := public.roster_shift_delete(v_foct_shift);
    v_ok := (v_res ->> 'ok')::boolean;
  exception when others then v_ok := false;
  end;
  if exists (select 1 from public.roster_shifts where id = v_foct_shift) then
    raise notice 'ok 17: a competing company cannot delete the other''s shift';
  else raise exception 'FAIL 17: a FOCT shift was deleted by the rival'; end if;

  -- 18. nor APPROVE their week
  v_res := public.timesheet_decide(v_building, v_foct_staff, v_week, 'approved', 600, 'mine now');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 18: a competing company cannot approve the other''s week';
  else raise exception 'FAIL 18: rival approved a FOCT week'; end if;

  -- 19. nor CORRECT their hours
  begin
    v_res := public.attendance_adjust(v_foct_event, 120, 'padding');
    v_ok := coalesce((v_res ->> 'ok')::boolean, false);
  exception when others then v_ok := false;
  end;
  if not v_ok and (select delta_minutes from public.attendance_adjustments
                    where session_event_id = v_foct_event) = 15 then
    raise notice 'ok 19: a competing company cannot correct the other''s hours';
  else raise exception 'FAIL 19: a FOCT correction was changed by the rival'; end if;

  -- 20. its board shows its own week only
  v_res := public.roster_week(v_building, v_week);
  if not exists (select 1 from jsonb_array_elements(v_res -> 'shifts') s
                  where (s ->> 'staff_id')::uuid = v_foct_staff)
     and not exists (select 1 from jsonb_array_elements(v_res -> 'staff') s
                      where (s ->> 'id')::uuid = v_foct_staff) then
    raise notice 'ok 20: the roster board shows one company its own crew only';
  else raise exception 'FAIL 20: the rival board included a FOCT cleaner'; end if;

  -- ============================ the tablet =================================
  execute 'set local role anon';

  -- 21. the rival's tablet caches only the rival's people — no FOCT PIN hashes
  v_res := public.kiosk_bootstrap(v_token);
  if (v_res ->> 'ok')::boolean
     and not exists (select 1 from jsonb_array_elements(v_res -> 'staff') s
                      where (s ->> 'id')::uuid = v_foct_staff)
     and exists (select 1 from jsonb_array_elements(v_res -> 'staff') s
                  where (s ->> 'id')::uuid = v_rival_staff) then
    raise notice 'ok 21: a tablet caches its own company''s staff only';
  else raise exception 'FAIL 21: %', v_res -> 'staff'; end if;

  -- 22. and a FOCT PIN typed on the RIVAL tablet is refused
  v_res := public.kiosk_punch(v_token, v_foct_pin, 'in');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 22: another company''s PIN is not accepted on this tablet';
  else raise exception 'FAIL 22: a FOCT cleaner signed in on the rival tablet'; end if;
  execute 'reset role';
end $$;
