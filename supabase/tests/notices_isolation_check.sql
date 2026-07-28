-- Kiosk sign-in v1 — notices, offline sync and language checks (0009).
-- Run in the SQL editor after applying 0009. Expect 18 ok notices.
--
-- As in the kiosk suite, every device-side step runs as the real `anon` ROLE.
-- Running them as a superuser would bypass RLS and prove nothing.
do $$
declare
  v_building uuid; v_org uuid; v_tz text;
  v_device uuid; v_token uuid; v_res jsonb;
  v_alice uuid; v_bob uuid; v_pin text; v_hash text;
  v_general uuid; v_personal uuid; v_expired uuid; v_ack uuid;
  v_client1 uuid := gen_random_uuid();
  v_client2 uuid := gen_random_uuid();
  v_count int; v_version int;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, owner_org_id, timezone into v_building, v_org, v_tz
    from public.buildings where slug = 'aurora-on-collins';

  -- ================= admin side: acting as the cleaning manager =============
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  v_res := public.staff_create(v_building, 'Notice Test Alice');
  v_alice := (v_res ->> 'staff_id')::uuid;
  v_pin := v_res ->> 'pin';
  v_bob := (public.staff_create(v_building, 'Notice Test Bob') ->> 'staff_id')::uuid;

  -- 1. a PIN hash is stored for offline verification, and it is NOT the PIN
  select pin_hash into v_hash from public.staff where id = v_alice;
  if v_hash is not null and v_hash <> v_pin and v_hash like '$2%'
     and app.pin_matches(v_pin, v_hash) then
    raise notice 'ok 1: PIN stored as a bcrypt hash that verifies';
  else raise exception 'FAIL 1: bad pin_hash %', v_hash; end if;

  -- 2. resetting a PIN also replaces the hash
  declare v_new text; v_hash2 text;
  begin
    v_new := public.staff_reset_pin(v_alice) ->> 'pin';
    select pin_hash into v_hash2 from public.staff where id = v_alice;
    if v_hash2 <> v_hash and app.pin_matches(v_new, v_hash2)
       and not app.pin_matches(v_pin, v_hash2) then
      v_pin := v_new;
      raise notice 'ok 2: PIN reset replaced the hash and the old PIN no longer verifies';
    else raise exception 'FAIL 2: stale hash after reset'; end if;
  end;

  -- 3. notices are created: one general, one personal, one already expired
  insert into public.notices (building_id, org_id, title, body, priority, created_by)
  values (v_building, v_org,
          '{"en":"Loading dock","hi":"लोडिंग डॉक"}',
          '{"en":"Loading dock closed until 06:30","hi":"लोडिंग डॉक 06:30 तक बंद है"}',
          'important', c_manager)
  returning id into v_general;

  insert into public.notices (building_id, org_id, staff_id, body, requires_ack, created_by)
  values (v_building, v_org, v_alice,
          '{"en":"See Priya about your roster"}', true, c_manager)
  returning id into v_personal;

  insert into public.notices (building_id, org_id, body, starts_on, ends_on, created_by)
  values (v_building, v_org, '{"en":"Old news"}',
          current_date - 10, current_date - 3, c_manager)
  returning id into v_expired;

  if (select count(*) from public.notices where building_id = v_building) >= 3 then
    raise notice 'ok 3: general, personal and expired notices created';
  else raise exception 'FAIL 3: notices missing'; end if;

  -- 4. a notice must carry at least one language
  begin
    insert into public.notices (building_id, org_id, body) values (v_building, v_org, '{}'::jsonb);
    raise exception 'FAIL 4: empty notice body accepted';
  exception when check_violation then
    raise notice 'ok 4: a notice with no text in any language is refused';
  end;

  -- 5. a device is provisioned
  v_res := public.kiosk_device_create(v_building, 'Notices test tablet');
  v_device := (v_res ->> 'device_id')::uuid;

  -- ================= device side: anonymous, token only =====================
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  v_token := (public.kiosk_pair(v_res ->> 'pair_code') ->> 'device_token')::uuid;
  if v_token is not null then raise notice 'ok 5: tablet paired';
  else raise exception 'FAIL 5: pairing failed'; end if;

  -- 6. bootstrap returns the site, its people and the general notices
  v_res := public.kiosk_bootstrap(v_token);
  if (v_res ->> 'ok')::boolean
     and v_res -> 'site' ->> 'timezone' is not null
     and jsonb_array_length(v_res -> 'staff') >= 2
     and (v_res ->> 'server_time') is not null then
    raise notice 'ok 6: bootstrap returns site, staff and server time';
  else raise exception 'FAIL 6: %', v_res; end if;

  -- 7. bootstrap ships PIN HASHES, never PINs
  if exists (select 1 from jsonb_array_elements(v_res -> 'staff') s
              where s ->> 'pin_hash' is not null)
     and not exists (select 1 from jsonb_array_elements(v_res -> 'staff') s
                      where s ? 'pin')
     and v_res::text not like '%' || v_pin || '%' then
    raise notice 'ok 7: the tablet caches hashes, never a PIN';
  else raise exception 'FAIL 7: a PIN reached the device'; end if;

  -- 8. only GENERAL notices are cached — a personal note is never sitting on
  --    a shared tablet where the wrong person could read it
  if not exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_personal)
     and exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_general) then
    raise notice 'ok 8: personal notices are never cached on the device';
  else raise exception 'FAIL 8: a personal notice was cached'; end if;

  -- 9. an expired notice is not cached either
  if not exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_expired) then
    raise notice 'ok 9: expired notices are dropped from the cache';
  else raise exception 'FAIL 9: expired notice cached'; end if;

  -- 10. after sign-in, this person sees general + their own, with both languages
  v_res := public.notices_for_staff(v_token, v_alice);
  if (v_res ->> 'ok')::boolean
     and exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_general
                    and n -> 'body' ->> 'hi' is not null
                    and n -> 'body' ->> 'en' is not null)
     and exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_personal and (n ->> 'personal')::boolean) then
    raise notice 'ok 10: sign-in shows general + personal notices in every language';
  else raise exception 'FAIL 10: %', v_res; end if;

  -- 11. someone else never sees that personal notice
  v_res := public.notices_for_staff(v_token, v_bob);
  if not exists (select 1 from jsonb_array_elements(v_res -> 'notices') n
                  where (n ->> 'id')::uuid = v_personal) then
    raise notice 'ok 11: a personal notice reaches only its own employee';
  else raise exception 'FAIL 11: personal notice leaked to another employee'; end if;

  -- 12. acknowledgement records once, and the notice then reads as acked.
  --     The count is verified back as the MANAGER: anon has no privilege on
  --     the table, which is the point of the design.
  v_res := public.notice_ack(v_token, v_personal, v_alice);
  perform public.notice_ack(v_token, v_personal, v_alice);  -- twice, deliberately
  if (v_res ->> 'ok')::boolean
     and (select (n ->> 'acked')::boolean
            from jsonb_array_elements(public.notices_for_staff(v_token, v_alice) -> 'notices') n
           where (n ->> 'id')::uuid = v_personal) then
    execute 'reset role';
    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', c_manager), true);
    select count(*) into v_count from public.notice_acks
     where notice_id = v_personal and staff_id = v_alice;
    perform set_config('request.jwt.claims', '{}', true);
    execute 'set local role anon';
    if v_count = 1 then raise notice 'ok 12: acknowledgement is recorded exactly once';
    else raise exception 'FAIL 12: ack count %', v_count; end if;
  else raise exception 'FAIL 12: %', v_res; end if;

  -- 13. OFFLINE SYNC: a batch of two events lands
  v_res := public.kiosk_sync(v_token, jsonb_build_array(
    jsonb_build_object('client_event_id', v_client1, 'staff_id', v_alice, 'kind', 'in',
                       'device_time', (now() - interval '3 hours')::text,
                       'recorded_offline', true),
    jsonb_build_object('client_event_id', v_client2, 'staff_id', v_alice, 'kind', 'out',
                       'device_time', (now() - interval '1 hour')::text,
                       'recorded_offline', true)));
  if (v_res ->> 'ok')::boolean
     and (select bool_and((r ->> 'ok')::boolean)
            from jsonb_array_elements(v_res -> 'results') r) then
    raise notice 'ok 13: an offline batch syncs';
  else raise exception 'FAIL 13: %', v_res; end if;

  -- 14. THE POINT OF THE IDEMPOTENCY KEY: replaying the batch changes nothing
  perform public.kiosk_sync(v_token, jsonb_build_array(
    jsonb_build_object('client_event_id', v_client1, 'staff_id', v_alice, 'kind', 'in',
                       'device_time', (now() - interval '3 hours')::text),
    jsonb_build_object('client_event_id', v_client2, 'staff_id', v_alice, 'kind', 'out',
                       'device_time', (now() - interval '1 hour')::text)));
  perform public.kiosk_sync(v_token, jsonb_build_array(
    jsonb_build_object('client_event_id', v_client1, 'staff_id', v_alice, 'kind', 'in',
                       'device_time', (now() - interval '3 hours')::text)));
  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);
  select count(*) into v_count from public.attendance_events
   where client_event_id in (v_client1, v_client2);
  if v_count = 2 then raise notice 'ok 14: replaying a batch three times still records 2 events';
  else raise exception 'FAIL 14: % events after replay', v_count; end if;

  -- 15. offline events are flagged and keep the device's own clock
  if (select bool_and(recorded_offline) from public.attendance_events
       where client_event_id in (v_client1, v_client2))
     and (select bool_and(device_time is not null) from public.attendance_events
           where client_event_id in (v_client1, v_client2)) then
    raise notice 'ok 15: offline events are flagged with their device time';
  else raise exception 'FAIL 15: offline flag or device time missing'; end if;

  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';

  -- 16. junk in a sync batch is rejected per-event, not silently accepted
  v_res := public.kiosk_sync(v_token, jsonb_build_array(
    jsonb_build_object('client_event_id', gen_random_uuid(), 'staff_id', v_alice,
                       'kind', 'in', 'device_time', (now() + interval '3 days')::text),
    jsonb_build_object('client_event_id', gen_random_uuid(), 'staff_id', gen_random_uuid(),
                       'kind', 'in', 'device_time', now()::text),
    jsonb_build_object('client_event_id', gen_random_uuid(), 'staff_id', v_alice,
                       'kind', 'sideways', 'device_time', now()::text)));
  if (select count(*) from jsonb_array_elements(v_res -> 'results') r
       where not (r ->> 'ok')::boolean) = 3 then
    raise notice 'ok 16: future-dated, unknown-employee and malformed events are refused';
  else raise exception 'FAIL 16: %', v_res; end if;

  -- 17. a device token still buys NO table access, notices included
  begin
    select count(*) into v_count from public.notices;
    if v_count = 0 then raise notice 'ok 17: kiosk reads no notice rows directly';
    else raise exception 'FAIL 17: kiosk read % notices', v_count; end if;
  exception when insufficient_privilege then
    raise notice 'ok 17: kiosk has no privilege on notices at all';
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);

  -- 18. editing the text bumps the version, so an acknowledged notice is
  --     put back in front of the person who already read the old wording
  update public.notices set body = '{"en":"See Priya TODAY about your roster"}'
   where id = v_personal;
  select version into v_version from public.notices where id = v_personal;
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  if v_version = 2
     and not (select (n ->> 'acked')::boolean
                from jsonb_array_elements(public.notices_for_staff(v_token, v_alice) -> 'notices') n
               where (n ->> 'id')::uuid = v_personal) then
    raise notice 'ok 18: a reworded notice must be acknowledged again';
  else raise exception 'FAIL 18: version % still acknowledged', v_version; end if;
  execute 'reset role';
end $$;
