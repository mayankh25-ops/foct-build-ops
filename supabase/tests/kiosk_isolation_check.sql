-- Stage 2 phase 2 — kiosk + attendance isolation checks.
-- Run in the SQL editor after applying 0007. Expect 19 ok notices.
-- Uses the seeded Aurora building and the demo cleaning-manager account.
--
-- The device-side steps deliberately run as the real `anon` ROLE: running
-- them as a superuser would bypass RLS and prove nothing.
do $$
declare
  v_building uuid; v_org uuid;
  v_device uuid; v_code text; v_token uuid; v_res jsonb;
  v_staff uuid; v_staff2 uuid; v_pin text; v_pin2 text; v_count int;
  v_cleaner_org uuid; v_priya_org uuid; v_event uuid; v_event2 uuid;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, owner_org_id into v_building, v_org from public.buildings where slug = 'aurora-on-collins';

  -- ============ admin side: acting as the cleaning manager ============
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  -- 1. a cleaner is created with a generated PIN
  v_res := public.staff_create(v_building, 'Kiosk Test Cleaner');
  v_staff := (v_res ->> 'staff_id')::uuid;
  v_pin := v_res ->> 'pin';
  if v_pin ~ '^[0-9]{4}$' and v_pin not in ('0000','1234') then
    raise notice 'ok 1: staff_create issued a generated PIN';
  else raise exception 'FAIL 1: bad pin %', v_pin; end if;

  -- 2. PINs stay unique inside the building
  -- (id captured here, while we still have read access — the device side below
  --  runs as `anon`, which has no privileges on the table at all)
  v_staff2 := (public.staff_create(v_building, 'Second Cleaner') ->> 'staff_id')::uuid;
  select count(distinct pin) into v_count from public.staff where building_id = v_building and active;
  if v_count = (select count(*) from public.staff where building_id = v_building and active) then
    raise notice 'ok 2: PINs are unique within the building';
  else raise exception 'FAIL 2: duplicate PINs issued'; end if;

  -- 3. a kiosk device is provisioned and gets a 6-digit pair code
  -- through the real RPC, so the tablet belongs to the company whose staff use
  -- it. 0012: a device provisioned to the wrong organisation sees none of their
  -- people — which is the point, and was how this test first failed.
  v_res := public.kiosk_device_create(v_building, 'Cleaners room tablet');
  v_device := (v_res ->> 'device_id')::uuid;
  v_code := v_res ->> 'pair_code';
  if v_code ~ '^[0-9]{6}$' then raise notice 'ok 3: 6-digit pair code issued';
  else raise exception 'FAIL 3: bad pair code %', v_code; end if;

  -- ============ device side: anonymous, token-only ============
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  -- 4. pairing redeems the code and returns a device token
  v_res := public.kiosk_pair(v_code);
  v_token := (v_res ->> 'device_token')::uuid;
  if (v_res ->> 'ok')::boolean and v_token is not null then
    raise notice 'ok 4: device paired and received a token';
  else raise exception 'FAIL 4: %', v_res; end if;

  -- 5. the code cannot be redeemed twice
  v_res := public.kiosk_pair(v_code);
  if not (v_res ->> 'ok')::boolean then raise notice 'ok 5: pair code is single-use';
  else raise exception 'FAIL 5: code re-used'; end if;

  -- 6. name search returns NAMES ONLY — never a PIN
  v_res := public.kiosk_staff_search(v_token, 'Kiosk');
  if (v_res ->> 'ok')::boolean
     and v_res -> 'staff' -> 0 ->> 'name' = 'Kiosk Test Cleaner'
     and (v_res -> 'staff' -> 0 ->> 'pin') is null then
    raise notice 'ok 6: search returns names only, never PINs';
  else raise exception 'FAIL 6: %', v_res; end if;

  -- 7. an unknown PIN is refused
  v_res := public.kiosk_punch(v_token, '0000', 'in');
  if not (v_res ->> 'ok')::boolean then raise notice 'ok 7: unknown PIN refused';
  else raise exception 'FAIL 7: unknown PIN accepted'; end if;

  -- 8. the correct PIN checks in (with a selfie path)
  v_res := public.kiosk_punch(v_token, v_pin, 'in', 'selfies/test.jpg');
  v_event := (v_res ->> 'event_id')::uuid;
  if (v_res ->> 'ok')::boolean and v_res ->> 'staff_name' = 'Kiosk Test Cleaner'
     and v_event is not null then
    raise notice 'ok 8: check-in recorded';
  else raise exception 'FAIL 8: %', v_res; end if;

  -- 9. a second check-in is blocked
  v_res := public.kiosk_punch(v_token, v_pin, 'in');
  if (v_res ->> 'already')::boolean then raise notice 'ok 9: double check-in blocked';
  else raise exception 'FAIL 9: %', v_res; end if;

  -- 10. check-out succeeds, and its photo attaches after the fact
  v_res := public.kiosk_punch(v_token, v_pin, 'out');
  v_event2 := (v_res ->> 'event_id')::uuid;
  if (v_res ->> 'ok')::boolean
     and (public.kiosk_attach_selfie(v_token, v_event2, 'selfies/out.jpg') ->> 'ok')::boolean
     -- and never twice
     and not (public.kiosk_attach_selfie(v_token, v_event2, 'selfies/hack.jpg') ->> 'ok')::boolean then
    raise notice 'ok 10: check-out recorded, selfie attached once';
  else raise exception 'FAIL 10: %', v_res; end if;

  -- 11. when a name was selected, someone else's PIN is rejected
  v_res := public.kiosk_punch(v_token, v_pin, 'in', null, v_staff2);
  if not (v_res ->> 'ok')::boolean then raise notice 'ok 11: PIN must match the selected name';
  else raise exception 'FAIL 11: mismatched name+PIN accepted'; end if;

  -- 12-13. THE POINT OF THE DESIGN: holding a device token grants NO data
  -- access. Either RLS returns nothing or privileges are revoked outright
  -- (0003 hardening) — both are passes; reading rows is a failure.
  begin
    select count(*) into v_count from public.staff;
    if v_count = 0 then raise notice 'ok 12: kiosk reads no staff rows';
    else raise exception 'FAIL 12: kiosk read % staff rows', v_count; end if;
  exception when insufficient_privilege then
    raise notice 'ok 12: kiosk has no privilege on staff at all';
  end;

  begin
    select count(*) into v_count from public.attendance_events;
    if v_count = 0 then raise notice 'ok 13: kiosk reads no attendance history';
    else raise exception 'FAIL 13: kiosk read % events', v_count; end if;
  exception when insufficient_privilege then
    raise notice 'ok 13: kiosk has no privilege on attendance history at all';
  end;

  execute 'reset role';

  -- 14. back as the manager: the events ARE there, with selfie + device
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);
  select count(*) into v_count from public.attendance_events
   where staff_id = v_staff and device_id = v_device;
  if v_count = 2
     and exists (select 1 from public.attendance_events
                  where staff_id = v_staff and selfie_path = 'selfies/test.jpg') then
    raise notice 'ok 14: manager sees both events with selfie + device recorded';
  else raise exception 'FAIL 14: manager sees % events', v_count; end if;

  -- 15. the cleaner belongs to the CLEANING company, not the building owner
  select org_id into v_cleaner_org from public.staff where id = v_staff;
  select m.org_id into v_priya_org from public.organisation_memberships m
   where m.user_id = c_manager and m.active limit 1;
  if v_cleaner_org = v_priya_org and v_cleaner_org <> v_org then
    raise notice 'ok 15: cleaner belongs to the creating org, not the building owner';
  else raise exception 'FAIL 15: staff org % (owner %, creator %)', v_cleaner_org, v_org, v_priya_org; end if;

  -- 16. the paired session shows real worked minutes with both selfies
  v_res := public.attendance_sessions(v_building, current_date - 1, current_date + 1);
  if (v_res ->> 'ok')::boolean
     and v_res -> 'sessions' -> 0 ->> 'staff_name' = 'Kiosk Test Cleaner'
     and (v_res -> 'sessions' -> 0 ->> 'out_at') is not null
     and (v_res -> 'sessions' -> 0 ->> 'minutes') is not null then
    raise notice 'ok 16: attendance_sessions pairs in/out into a timesheet row';
  else raise exception 'FAIL 16: %', v_res; end if;

  -- 17. resetting a PIN issues a different one
  v_res := public.staff_reset_pin(v_staff);
  v_pin2 := v_res ->> 'pin';
  if v_pin2 ~ '^[0-9]{4}$' and v_pin2 <> v_pin then
    raise notice 'ok 17: PIN reset issued a new PIN';
  else raise exception 'FAIL 17: %', v_res; end if;

  -- 18. one call provisions a device and returns a pair code
  v_res := public.kiosk_device_create(v_building, 'Second tablet');
  if (v_res ->> 'ok')::boolean and (v_res ->> 'pair_code') ~ '^[0-9]{6}$' then
    raise notice 'ok 18: kiosk_device_create returned a pair code';
  else raise exception 'FAIL 18: %', v_res; end if;

  -- 19. the OLD pin no longer works on the kiosk
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  v_res := public.kiosk_punch(v_token, v_pin, 'in');
  execute 'reset role';
  if not (v_res ->> 'ok')::boolean then raise notice 'ok 19: the replaced PIN is dead';
  else raise exception 'FAIL 19: old PIN still works'; end if;
end $$;
