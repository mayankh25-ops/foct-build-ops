-- =============================================================================
-- FOCT BuildingOps — MISSED CHECK-IN ALERTS (paste into the Supabase SQL editor
-- and Run). Idempotent — safe to re-run.
--
-- Turns "nobody turned up" from something you have to notice into something the
-- system tells you. Raises a durable alert when a rostered shift passes its
-- start plus a grace period with no check-in, and when somebody is still signed
-- in long after their shift ended. Alerts close themselves when the person
-- arrives or signs out, and a scan can run every few minutes without ever
-- emailing the same thing twice.
--
-- Afterwards run supabase/tests/alerts_isolation_check.sql (expect 18 ok).
--
-- To make the EMAILS happen you also need, in Vercel:
--   CRON_SECRET        any long random string
--   SUPABASE_SECRET_KEY  (you may already have this for integrations)
-- and an active email provider under Settings → Integrations. Without those the
-- alerts still appear on Roster → Today; nothing is sent.
-- =============================================================================

-- =============================================================================
-- 0014 — Missed check-in alerts: the system tells somebody, instead of waiting
-- to be asked.
--
-- 0013 knows who never turned up. Until now that fact sat on a screen nobody
-- was necessarily looking at. This raises a DURABLE alert and lets a job email
-- it — which is the last item on the original CleaningOps list.
--
-- The rules that stop an alert system from being ignored:
--
--   * NEVER TWICE. One alert per person, per day, per shift, per kind. The
--     scan runs every few minutes and must be able to run a hundred times an
--     hour without sending a hundred emails — a unique index enforces that,
--     not the caller's care.
--   * IT CLOSES ITSELF. Somebody who turns up late resolves their own alert
--     ('arrived'), and somebody who finally signs out resolves theirs
--     ('signed_out'). An alert list that only grows stops being read.
--   * NOTHING IS RAISED BEFORE IT COULD HAVE HAPPENED. Start plus grace, in the
--     building's own timezone — the same rule 0013 shows on screen, so the
--     board and the email can never disagree.
--   * THE SEND IS RECORDED SEPARATELY from the alert. `notified_at` is stamped
--     only when a provider accepted it, so a mail outage means an unsent alert
--     you can see, not a silent one.
--
-- Two kinds:
--   missed  — rostered, start + grace has passed, no check-in
--   overdue — signed in and still signed in long after the shift should have
--             ended (the forgotten sign-out that pays nothing)
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- --------------------------------------------------------------- settings ---
create table if not exists public.attendance_alert_settings (
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  enabled       boolean not null default true,
  -- how long after a start time counts as "not here"
  grace_min     int not null default 15 check (grace_min between 0 and 240),
  -- how long past a finish time a still-open shift is worth chasing
  overdue_after_min int not null default 60 check (overdue_after_min between 0 and 1440),
  raise_overdue boolean not null default true,
  -- who hears about it. Empty = alerts are raised on screen but not emailed.
  notify_emails text[] not null default '{}',
  updated_by    uuid references public.users(id),
  updated_at    timestamptz not null default now(),
  primary key (building_id, org_id)
);

-- ----------------------------------------------------------------- alerts ---
create table if not exists public.attendance_alerts (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  staff_id      uuid not null references public.staff(id) on delete cascade,
  shift_id      uuid references public.roster_shifts(id) on delete set null,
  kind          text not null check (kind in ('missed','overdue')),
  work_date     date not null,
  /** the minute of the day the alert is about: a start time, or a finish */
  due_min       int,
  raised_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  resolution    text check (resolution in ('arrived','signed_out','acknowledged')),
  note          text not null default '',
  acknowledged_by uuid references public.users(id),
  -- stamped only when a provider ACCEPTED the message
  notified_at   timestamptz,
  notify_error  text
);

-- The promise that a scan every five minutes cannot spam anyone. `shift_id` is
-- nullable (an overdue session need not be rostered), so it is coalesced —
-- a plain unique constraint would treat every null as distinct and let
-- duplicates through.
create unique index if not exists attendance_alerts_once
  on public.attendance_alerts (
    staff_id, work_date, kind,
    coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists attendance_alerts_open_idx
  on public.attendance_alerts (building_id, work_date) where resolved_at is null;

alter table public.attendance_alert_settings enable row level security;
alter table public.attendance_alerts         enable row level security;

do $$ begin
  -- 0012's rule: staff facts belong to the organisation that employs them
  drop policy if exists alert_settings_read on public.attendance_alert_settings;
  create policy alert_settings_read on public.attendance_alert_settings
    for select to authenticated using (app.in_org(org_id));
  drop policy if exists alert_settings_write on public.attendance_alert_settings;
  create policy alert_settings_write on public.attendance_alert_settings
    for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  drop policy if exists alerts_read on public.attendance_alerts;
  create policy alerts_read on public.attendance_alerts
    for select to authenticated using (app.employs_staff(staff_id));
  drop policy if exists alerts_write on public.attendance_alerts;
  create policy alerts_write on public.attendance_alerts
    for all to authenticated
    using (app.manages_staff(staff_id)) with check (app.manages_staff(staff_id));
end $$;


-- The scheduled job runs as the service role, which has no `auth.uid()`. It
-- still must not be able to do anything a manager couldn't — it only ever
-- scans and stamps.
create or replace function app.is_service_role() returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
    or current_user = 'service_role'
$$;


-- ==================================================== settings: read/write ===
create or replace function public.alert_settings_get(p_building uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_org uuid; r public.attendance_alert_settings;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  select * into r from public.attendance_alert_settings
   where building_id = p_building and org_id = v_org;

  -- defaults are returned rather than stored, so a site that has never opened
  -- this screen still behaves sensibly
  return jsonb_build_object('ok', true,
    'building_id', p_building, 'org_id', v_org,
    'enabled',           coalesce(r.enabled, true),
    'grace_min',         coalesce(r.grace_min, 15),
    'overdue_after_min', coalesce(r.overdue_after_min, 60),
    'raise_overdue',     coalesce(r.raise_overdue, true),
    'notify_emails',     to_jsonb(coalesce(r.notify_emails, '{}')),
    'configured',        r.building_id is not null);
end $$;
revoke all on function public.alert_settings_get(uuid) from public;
grant execute on function public.alert_settings_get(uuid) to authenticated;


create or replace function public.alert_settings_set(
  p_building uuid, p_enabled boolean, p_grace_min int,
  p_overdue_after_min int, p_raise_overdue boolean, p_emails text[]
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_clean text[];
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  if p_grace_min < 0 or p_grace_min > 240 then
    return jsonb_build_object('ok', false, 'error', 'Grace must be between 0 and 240 minutes.');
  end if;

  -- a malformed address is refused here rather than failing silently at send
  select coalesce(array_agg(distinct lower(trim(e))), '{}')
    into v_clean
    from unnest(coalesce(p_emails, '{}')) e
   where trim(e) <> '';
  if exists (select 1 from unnest(v_clean) e where e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$') then
    return jsonb_build_object('ok', false, 'error', 'One of those email addresses is not valid.');
  end if;

  insert into public.attendance_alert_settings
    (building_id, org_id, enabled, grace_min, overdue_after_min, raise_overdue,
     notify_emails, updated_by, updated_at)
  values (p_building, v_org, coalesce(p_enabled, true), coalesce(p_grace_min, 15),
          coalesce(p_overdue_after_min, 60), coalesce(p_raise_overdue, true),
          v_clean, auth.uid(), now())
  on conflict (building_id, org_id) do update
    set enabled = excluded.enabled,
        grace_min = excluded.grace_min,
        overdue_after_min = excluded.overdue_after_min,
        raise_overdue = excluded.raise_overdue,
        notify_emails = excluded.notify_emails,
        updated_by = excluded.updated_by,
        updated_at = now();

  return jsonb_build_object('ok', true, 'notify_emails', to_jsonb(v_clean));
end $$;
revoke all on function public.alert_settings_set(uuid, boolean, int, int, boolean, text[]) from public;
grant execute on function public.alert_settings_set(uuid, boolean, int, int, boolean, text[]) to authenticated;


-- ============================================================== the scan =====
-- Raises what is now true, resolves what is no longer true, and returns the
-- alerts that still need sending. Safe to call every few minutes: the unique
-- index means a second run raises nothing new.
create or replace function public.attendance_alerts_scan(p_building uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_org uuid; v_tz text; v_today date; v_now_min int;
  s public.attendance_alert_settings;
  v_raised int := 0; v_resolved int := 0; v_n int; v_pending jsonb;
begin
  if not (app.is_service_role() or app.manages_staff_at(p_building)) then
    raise exception 'not permitted';
  end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  v_today   := (now() at time zone v_tz)::date;
  v_now_min := floor(extract(epoch from (now() at time zone v_tz)::time) / 60)::int;

  -- every cleaning company at this site is scanned in its own right
  for v_org in
    select distinct st.org_id from public.staff st
     where st.building_id = p_building and st.active
  loop
    select * into s from public.attendance_alert_settings
     where building_id = p_building and org_id = v_org;
    if s.building_id is not null and not s.enabled then continue; end if;

    -- ---- raise: rostered, past start + grace, never checked in ----------
    insert into public.attendance_alerts
      (building_id, org_id, staff_id, shift_id, kind, work_date, due_min)
    select p_building, v_org, r.staff_id, r.id, 'missed', v_today, r.start_min
      from public.roster_shifts r
      join public.staff st on st.id = r.staff_id and st.active and st.org_id = v_org
     where r.building_id = p_building
       and r.work_date = v_today
       and v_now_min >= r.start_min + coalesce(s.grace_min, 15)
       and not exists (
         select 1 from public.attendance_events e
          where e.staff_id = r.staff_id and e.kind = 'in'
            and (e.at at time zone v_tz)::date = v_today)
    on conflict do nothing;
    -- counts ACCUMULATE across the organisations at this site; assigning
    -- would report only the last one
    get diagnostics v_n = row_count;  v_raised := v_raised + v_n;

    -- ---- raise: signed in, long past the finish, still signed in --------
    if coalesce(s.raise_overdue, true) then
      insert into public.attendance_alerts
        (building_id, org_id, staff_id, shift_id, kind, work_date, due_min)
      select p_building, v_org, o.staff_id, o.shift_id, 'overdue', v_today, o.end_min
        from (
          select e.staff_id,
                 (select r.id from public.roster_shifts r
                   where r.staff_id = e.staff_id and r.work_date = v_today
                     and r.building_id = p_building
                   order by r.end_min desc limit 1) as shift_id,
                 (select max(r.end_min) from public.roster_shifts r
                   where r.staff_id = e.staff_id and r.work_date = v_today
                     and r.building_id = p_building) as end_min
            from public.attendance_events e
            join public.staff st on st.id = e.staff_id and st.org_id = v_org and st.active
           where e.building_id = p_building
             and (e.at at time zone v_tz)::date = v_today
           group by e.staff_id
          having (array_agg(e.kind order by e.at desc))[1] = 'in'
        ) o
       where o.end_min is not null
         and v_now_min > o.end_min + coalesce(s.overdue_after_min, 60)
      on conflict do nothing;
      get diagnostics v_n = row_count;  v_raised := v_raised + v_n;
    end if;

    -- ---- resolve: they turned up after all --------------------------------
    update public.attendance_alerts a
       set resolved_at = now(), resolution = 'arrived'
     where a.building_id = p_building and a.org_id = v_org
       and a.kind = 'missed' and a.resolved_at is null
       and exists (
         select 1 from public.attendance_events e
          where e.staff_id = a.staff_id and e.kind = 'in'
            and (e.at at time zone v_tz)::date = a.work_date);
    get diagnostics v_n = row_count;  v_resolved := v_resolved + v_n;

    -- ---- resolve: they finally signed out ---------------------------------
    update public.attendance_alerts a
       set resolved_at = now(), resolution = 'signed_out'
     where a.building_id = p_building and a.org_id = v_org
       and a.kind = 'overdue' and a.resolved_at is null
       and (select (array_agg(e.kind order by e.at desc))[1]
              from public.attendance_events e
             where e.staff_id = a.staff_id
               and (e.at at time zone v_tz)::date = a.work_date) = 'out';
    get diagnostics v_n = row_count;  v_resolved := v_resolved + v_n;
  end loop;

  -- what still needs an email: open, never sent, and somebody to send it to
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'org_id', a.org_id, 'kind', a.kind,
           'staff_name', st.name, 'work_date', a.work_date, 'due_min', a.due_min,
           'emails', to_jsonb(coalesce(cfg.notify_emails, '{}'))
         ) order by a.raised_at), '[]'::jsonb)
    into v_pending
    from public.attendance_alerts a
    join public.staff st on st.id = a.staff_id
    left join public.attendance_alert_settings cfg
           on cfg.building_id = a.building_id and cfg.org_id = a.org_id
   where a.building_id = p_building
     and a.resolved_at is null
     and a.notified_at is null
     and coalesce(array_length(cfg.notify_emails, 1), 0) > 0;

  return jsonb_build_object('ok', true, 'building_id', p_building,
    'timezone', v_tz, 'date', v_today,
    'raised', v_raised, 'resolved', v_resolved, 'to_send', v_pending);
end $$;
revoke all on function public.attendance_alerts_scan(uuid) from public;
grant execute on function public.attendance_alerts_scan(uuid) to authenticated, service_role;


-- Every building at once — what the scheduled job calls.
create or replace function public.attendance_alerts_scan_all()
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare b record; v_all jsonb := '[]'::jsonb;
begin
  if not app.is_service_role() then raise exception 'not permitted'; end if;
  for b in select distinct s.building_id as id from public.staff s where s.active loop
    v_all := v_all || jsonb_build_array(public.attendance_alerts_scan(b.id));
  end loop;
  return jsonb_build_object('ok', true, 'buildings', v_all);
end $$;
revoke all on function public.attendance_alerts_scan_all() from public;
grant execute on function public.attendance_alerts_scan_all() to service_role;


-- Stamped only when a provider ACCEPTED the message, so an outage leaves an
-- unsent alert that is visibly unsent.
create or replace function public.attendance_alerts_mark_sent(p_ids uuid[], p_error text default null)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_n int;
begin
  if not app.is_service_role() then raise exception 'not permitted'; end if;
  update public.attendance_alerts
     set notified_at = case when p_error is null then now() end,
         notify_error = p_error
   where id = any(coalesce(p_ids, '{}'));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'updated', v_n);
end $$;
revoke all on function public.attendance_alerts_mark_sent(uuid[], text) from public;
grant execute on function public.attendance_alerts_mark_sent(uuid[], text) to service_role;


-- ============================================================ read + ack =====
create or replace function public.attendance_alerts_open(p_building uuid, p_date date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_date date; v_rows jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  v_date := coalesce(p_date, (now() at time zone v_tz)::date);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'kind', a.kind, 'staff_id', a.staff_id, 'staff_name', st.name,
           'work_date', a.work_date, 'due_min', a.due_min, 'raised_at', a.raised_at,
           'notified_at', a.notified_at, 'notify_error', a.notify_error,
           'resolved_at', a.resolved_at, 'resolution', a.resolution, 'note', a.note
         ) order by a.raised_at desc), '[]'::jsonb)
    into v_rows
    from public.attendance_alerts a
    join public.staff st on st.id = a.staff_id
   where a.building_id = p_building
     and a.work_date = v_date
     and app.in_org(a.org_id)          -- 0012: your own company's alerts
     and a.resolved_at is null;

  return jsonb_build_object('ok', true, 'date', v_date, 'alerts', v_rows);
end $$;
revoke all on function public.attendance_alerts_open(uuid, date) from public;
grant execute on function public.attendance_alerts_open(uuid, date) to authenticated;


-- Acknowledging is a RESOLUTION with a name on it, not a delete: "I know, I
-- called them" is the useful record.
create or replace function public.attendance_alert_ack(p_alert uuid, p_note text default '')
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare a public.attendance_alerts;
begin
  select * into a from public.attendance_alerts where id = p_alert;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'That alert no longer exists.'); end if;
  if not app.manages_staff(a.staff_id) then raise exception 'not permitted'; end if;
  if a.resolved_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  update public.attendance_alerts
     set resolved_at = now(), resolution = 'acknowledged',
         note = coalesce(trim(p_note), ''), acknowledged_by = auth.uid()
   where id = p_alert;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.attendance_alert_ack(uuid, text) from public;
grant execute on function public.attendance_alert_ack(uuid, text) to authenticated;
