-- Missed check-in alerts (0014). Expect 18 ok notices.
--
-- The failure modes of an alert system are specific: it cries wolf before a
-- shift could have started, it emails the same person forty times because the
-- job runs every five minutes, it keeps shouting after someone turns up, it
-- reports a send that never happened, or it tells the wrong company that one
-- of their competitor's cleaners is missing.
do $$
declare
  v_building uuid; v_tz text; v_today date; v_now_min int;
  v_org uuid; v_res jsonb; v_n int;
  v_late uuid; v_open uuid; v_future uuid; v_alert uuid;
  c_manager constant uuid := '22222222-0000-0000-0000-000000000003'; -- Priya, FOCT Cleaning
begin
  select id, timezone into v_building, v_tz from public.buildings where slug = 'aurora-on-collins';
  v_today   := (now() at time zone v_tz)::date;
  v_now_min := floor(extract(epoch from (now() at time zone v_tz)::time) / 60)::int;

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_manager), true);
  v_org := app.managing_org_for(v_building);

  v_late   := (public.staff_create(v_building, 'Alert Nobody')  ->> 'staff_id')::uuid;
  v_open   := (public.staff_create(v_building, 'Alert Forgot')  ->> 'staff_id')::uuid;
  v_future := (public.staff_create(v_building, 'Alert Later')   ->> 'staff_id')::uuid;

  delete from public.attendance_alerts where staff_id in (v_late, v_open, v_future);
  delete from public.attendance_events where staff_id in (v_late, v_open, v_future);
  delete from public.roster_shifts    where staff_id in (v_late, v_open, v_future);

  -- 1. settings come back with sane defaults before anyone opens the screen
  v_res := public.alert_settings_get(v_building);
  if (v_res ->> 'ok')::boolean and (v_res ->> 'grace_min')::int = 15
     and not (v_res ->> 'configured')::boolean then
    raise notice 'ok 1: alert settings default to 15 minutes without being configured';
  else raise exception 'FAIL 1: %', v_res; end if;

  -- 2. a rubbish email address is refused rather than failing at send time
  v_res := public.alert_settings_set(v_building, true, 15, 60, true,
             array['ops@example.com', 'not-an-address']);
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 2: an invalid recipient is refused when it is typed';
  else raise exception 'FAIL 2: invalid email accepted'; end if;

  -- 3. good addresses are stored, trimmed and de-duplicated
  v_res := public.alert_settings_set(v_building, true, 15, 60, true,
             array['  Ops@Example.com ', 'ops@example.com', 'sup@example.com']);
  if (v_res ->> 'ok')::boolean
     and jsonb_array_length(v_res -> 'notify_emails') = 2 then
    raise notice 'ok 3: recipients are cleaned and de-duplicated';
  else raise exception 'FAIL 3: %', v_res; end if;

  -- ------------------------------------------------------------- raising --
  -- Nobody: rostered two hours ago, never checked in
  perform public.roster_shift_set(v_building, v_late, v_today,
    greatest(0, v_now_min - 120), least(1440, v_now_min + 120), 'Lobby');
  -- Later: rostered to start in two hours (must NOT alert)
  if v_now_min < 1200 then
    perform public.roster_shift_set(v_building, v_future, v_today,
      least(1439, v_now_min + 120), 1440, 'L9–L24');
  end if;
  -- Forgot: shift finished three hours ago, still signed in
  perform public.roster_shift_set(v_building, v_open, v_today,
    greatest(0, v_now_min - 400), greatest(1, v_now_min - 180), 'Car park');
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_open, 'in', now() - interval '6 hours', 'kiosk');

  v_res := public.attendance_alerts_scan(v_building);

  -- 4. the no-show is raised
  if exists (select 1 from public.attendance_alerts
              where staff_id = v_late and kind = 'missed' and resolved_at is null) then
    raise notice 'ok 4: a rostered no-show raises a missed alert';
  else raise exception 'FAIL 4: no alert raised'; end if;

  -- 5. NOTHING is raised for a shift that has not started
  if not exists (select 1 from public.attendance_alerts where staff_id = v_future) then
    raise notice 'ok 5: a shift still to start raises nothing';
  else raise exception 'FAIL 5: cried wolf before the shift began'; end if;

  -- 6. the forgotten sign-out is raised as its own kind
  if exists (select 1 from public.attendance_alerts
              where staff_id = v_open and kind = 'overdue' and resolved_at is null) then
    raise notice 'ok 6: a shift never signed out raises an overdue alert';
  else raise exception 'FAIL 6: no overdue alert'; end if;

  -- 7. THE SPAM TEST: running the scan again raises nothing new
  perform public.attendance_alerts_scan(v_building);
  perform public.attendance_alerts_scan(v_building);
  select count(*) into v_n from public.attendance_alerts
   where staff_id in (v_late, v_open);
  if v_n = 2 then
    raise notice 'ok 7: scanning repeatedly never raises the same alert twice';
  else raise exception 'FAIL 7: % alerts after three scans', v_n; end if;

  -- 8. an unsent alert is listed for sending, with its recipients
  v_res := public.attendance_alerts_scan(v_building);
  if jsonb_array_length(v_res -> 'to_send') >= 2
     and exists (select 1 from jsonb_array_elements(v_res -> 'to_send') t
                  where jsonb_array_length(t -> 'emails') = 2) then
    raise notice 'ok 8: unsent alerts are returned with their recipients';
  else raise exception 'FAIL 8: %', v_res -> 'to_send'; end if;

  -- 9. the open list is what the screen reads
  v_res := public.attendance_alerts_open(v_building);
  if (v_res ->> 'ok')::boolean
     and exists (select 1 from jsonb_array_elements(v_res -> 'alerts') a
                  where a ->> 'staff_name' = 'Alert Nobody') then
    raise notice 'ok 9: open alerts read back with the person''s name';
  else raise exception 'FAIL 9: %', v_res; end if;

  -- ----------------------------------------------------------- resolving --
  -- 10. turning up late CLOSES the alert by itself
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_late, 'in', now(), 'kiosk');
  perform public.attendance_alerts_scan(v_building);
  if (select resolution from public.attendance_alerts
       where staff_id = v_late and kind = 'missed') = 'arrived' then
    raise notice 'ok 10: arriving late resolves the alert without anyone touching it';
  else raise exception 'FAIL 10: still open after they arrived'; end if;

  -- 11. and it does not come back on the next scan
  perform public.attendance_alerts_scan(v_building);
  select count(*) into v_n from public.attendance_alerts
   where staff_id = v_late and kind = 'missed';
  if v_n = 1 then raise notice 'ok 11: a resolved alert is not re-raised';
  else raise exception 'FAIL 11: % alerts for one person', v_n; end if;

  -- 12. signing out closes an overdue alert
  insert into public.attendance_events (building_id, staff_id, kind, at, source)
  values (v_building, v_open, 'out', now(), 'kiosk');
  perform public.attendance_alerts_scan(v_building);
  if (select resolution from public.attendance_alerts
       where staff_id = v_open and kind = 'overdue') = 'signed_out' then
    raise notice 'ok 12: signing out resolves the overdue alert';
  else raise exception 'FAIL 12: overdue alert still open'; end if;

  -- 13. acknowledging is a resolution WITH A NAME ON IT, not a delete
  delete from public.attendance_alerts where staff_id = v_late;
  delete from public.attendance_events where staff_id = v_late;
  perform public.attendance_alerts_scan(v_building);
  select id into v_alert from public.attendance_alerts
   where staff_id = v_late and resolved_at is null;
  v_res := public.attendance_alert_ack(v_alert, 'called her, running late');
  if (v_res ->> 'ok')::boolean
     and (select resolution from public.attendance_alerts where id = v_alert) = 'acknowledged'
     and (select acknowledged_by from public.attendance_alerts where id = v_alert) = c_manager
     and (select note from public.attendance_alerts where id = v_alert) <> '' then
    raise notice 'ok 13: acknowledging records who, when and why';
  else raise exception 'FAIL 13: %', v_res; end if;

  -- 14. an acknowledged alert leaves the open list
  v_res := public.attendance_alerts_open(v_building);
  if not exists (select 1 from jsonb_array_elements(v_res -> 'alerts') a
                  where (a ->> 'id')::uuid = v_alert) then
    raise notice 'ok 14: an acknowledged alert leaves the open list';
  else raise exception 'FAIL 14: acknowledged alert still open'; end if;

  -- 15. TURNING IT OFF means off
  perform public.alert_settings_set(v_building, false, 15, 60, true, array['ops@example.com']);
  delete from public.attendance_alerts where staff_id = v_late;
  perform public.attendance_alerts_scan(v_building);
  if not exists (select 1 from public.attendance_alerts where staff_id = v_late) then
    raise notice 'ok 15: alerts switched off raise nothing';
  else raise exception 'FAIL 15: raised while disabled'; end if;
  perform public.alert_settings_set(v_building, true, 15, 60, true, array['ops@example.com']);

  -- ------------------------------------------------------------ sending ---
  -- 16. a manager cannot stamp an alert as SENT — only the job that sent it
  perform public.attendance_alerts_scan(v_building);
  select id into v_alert from public.attendance_alerts
   where staff_id = v_late and resolved_at is null limit 1;
  begin
    perform public.attendance_alerts_mark_sent(array[v_alert]);
    raise exception 'FAIL 16: a user marked an alert as sent';
  exception when others then
    if sqlerrm like '%not permitted%' then
      raise notice 'ok 16: only the sending job can stamp an alert as notified';
    else raise; end if;
  end;

  -- 17. and scan_all is the job's alone
  begin
    perform public.attendance_alerts_scan_all();
    raise exception 'FAIL 17: a user ran the whole-estate scan';
  exception when others then
    if sqlerrm like '%not permitted%' then
      raise notice 'ok 17: the estate-wide scan belongs to the scheduled job';
    else raise; end if;
  end;

  -- 18. ISOLATION: another company cannot read this site's alerts
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
      raise notice 'ok 18: (no rival org seeded to test against)';
    else
      perform set_config('request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_rival), true);
      begin
        perform public.attendance_alerts_open(v_building);
        raise exception 'FAIL 18: a rival org read these alerts';
      exception when others then
        if sqlerrm like '%not permitted%' then
          raise notice 'ok 18: another company cannot read this site''s alerts';
        else raise; end if;
      end;
    end if;
  end;
end $$;
