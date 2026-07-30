-- =============================================================================
-- 0013 — Today: who is actually here, against who was meant to be.
--
-- The kiosk records punches (0007/0009), the roster records intent (0011) and
-- the timesheet settles the week (0010). What was missing is the question a
-- supervisor asks twenty times a day: *right now, who is on site, who is late,
-- and who never turned up.*
--
-- One read, `attendance_day()`, answers it for any date and is the only place
-- those states are decided — a screen that computed "missed" for itself would
-- eventually disagree with the alert that emails somebody.
--
-- Two deliberate rules:
--
--   * NAMES ARE FOR THE EMPLOYER (0012's rule, applied here). Per-person rows
--     go only to an org that actually EMPLOYS people at this building, and only
--     its own people. Anyone else with building access — the strata manager, the
--     concierge — gets the COUNTS: cleaning progress without cleaning staff
--     records. Two cleaning companies at one tower each see their own crew and
--     the same site-wide summary they are entitled to.
--   * MISSED IS A FACT, NOT A GUESS. A shift is missed only once its start plus
--     the grace period has passed with no check-in. Before then it is upcoming,
--     and someone who signed in late is late — still here, still paid.
--
-- Idempotent — safe to re-run. No new tables: this is a read over existing rows.
-- =============================================================================

create or replace function public.attendance_day(
  p_building uuid,
  p_date date,
  p_grace_min int default 15
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_tz      text;
  v_now     timestamptz := now();
  v_now_min int;
  v_grace   int := greatest(0, least(coalesce(p_grace_min, 15), 240));
  v_detail  boolean;
  v_rows    jsonb;
  v_sum     jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  -- Whether names may be returned at all is decided here, once: do you employ
  -- anybody here? (0012's `app.in_org`, so a super admin passes too.)
  v_detail := exists (
    select 1 from public.staff s
     where s.building_id = p_building and app.in_org(s.org_id));

  -- "How far into the day is it" in the BUILDING's timezone. A past date is
  -- over (1440); a future date has not started (-1), so nothing is ever
  -- reported missed before it could possibly have happened.
  v_now_min := case
    when (v_now at time zone v_tz)::date = p_date
      then floor(extract(epoch from (v_now at time zone v_tz)::time) / 60)::int
    when (v_now at time zone v_tz)::date > p_date then 1440
    else -1
  end;

  with mine as (
    -- an employer sees its own crew; everyone else sees the site's counts, so
    -- the summary is computed over the whole site in that case
    select s.* from public.staff s
     where s.building_id = p_building
       and (not v_detail or app.in_org(s.org_id))
  ), ev as (
    select e.id, e.staff_id, e.kind, e.at, e.recorded_offline, e.selfie_path
      from public.attendance_events e
      join mine m on m.id = e.staff_id
     where e.building_id = p_building
       and (e.at at time zone v_tz)::date = p_date
  ), paired as (
    select ev.*,
           lead(ev.kind) over w as next_kind,
           lead(ev.at)   over w as next_at
      from ev
    window w as (partition by ev.staff_id order by ev.at)
  ), sessions as (
    -- a session is a check-in and whatever check-out follows it that day
    select p.staff_id, p.at as in_at, p.recorded_offline, p.selfie_path,
           case when p.next_kind = 'out' then p.next_at end as out_at,
           case when p.next_kind = 'out'
                then round(extract(epoch from (p.next_at - p.at)) / 60)::int end as minutes
      from paired p
     where p.kind = 'in'
  ), attendance as (
    select s.staff_id,
           min(s.in_at)                            as first_in,
           max(s.out_at)                           as last_out,
           coalesce(sum(s.minutes), 0)::int        as worked_minutes,
           count(*)::int                           as sessions,
           count(*) filter (where s.out_at is null)::int as open_sessions,
           max(s.in_at) filter (where s.out_at is null)  as open_since,
           bool_or(s.recorded_offline)             as any_offline
      from sessions s
     group by s.staff_id
  ), rostered as (
    select r.staff_id,
           min(r.start_min)::int                     as expected_start_min,
           max(r.end_min)::int                       as expected_end_min,
           sum(r.end_min - r.start_min)::int         as rostered_minutes,
           jsonb_agg(jsonb_build_object(
             'id', r.id, 'start_min', r.start_min, 'end_min', r.end_min,
             'zone', r.zone, 'note', r.note) order by r.start_min) as shifts
      from public.roster_shifts r
      join mine m on m.id = r.staff_id
     where r.building_id = p_building and r.work_date = p_date
     group by r.staff_id
  ), people as (
    -- everyone the day concerns: rostered, or here anyway
    select staff_id from rostered
    union
    select staff_id from attendance
  ), built as (
    select s.id                                        as staff_id,
           s.name                                      as staff_name,
           s.role                                      as role,
           s.active                                    as active,
           coalesce(r.shifts, '[]'::jsonb)             as shifts,
           coalesce(r.rostered_minutes, 0)             as rostered_minutes,
           r.expected_start_min,
           r.expected_end_min,
           a.first_in, a.last_out, a.open_since,
           coalesce(a.worked_minutes, 0)               as worked_minutes,
           coalesce(a.sessions, 0)                     as sessions,
           coalesce(a.open_sessions, 0)                as open_sessions,
           coalesce(a.any_offline, false)              as recorded_offline,
           (a.open_sessions > 0)                       as on_site,
           (r.staff_id is null)                        as unrostered,
           -- late: signed in after the start plus grace, and still counted
           case when a.first_in is not null and r.expected_start_min is not null
                then greatest(0,
                       floor(extract(epoch from (a.first_in at time zone v_tz)::time) / 60)::int
                       - r.expected_start_min - v_grace)
                else 0 end                            as late_minutes,
           -- still signed in long after the shift should have ended
           case when coalesce(a.open_sessions, 0) > 0 and r.expected_end_min is not null
                     and v_now_min > r.expected_end_min + v_grace
                then v_now_min - r.expected_end_min
                else 0 end                            as overdue_minutes,
           case
             when coalesce(a.open_sessions, 0) > 0 then 'on_site'
             when a.sessions > 0                   then 'finished'
             when r.expected_start_min is null     then 'finished'
             when v_now_min >= r.expected_start_min + v_grace then 'missed'
             else 'upcoming'
           end                                        as state
      from people pp
      join mine s on s.id = pp.staff_id
      left join rostered r on r.staff_id = pp.staff_id
      left join attendance a on a.staff_id = pp.staff_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'staff_id', b.staff_id, 'staff_name', b.staff_name, 'role', b.role,
      'active', b.active, 'shifts', b.shifts,
      'rostered_minutes', b.rostered_minutes,
      'expected_start_min', b.expected_start_min,
      'expected_end_min', b.expected_end_min,
      'first_in', b.first_in, 'last_out', b.last_out, 'open_since', b.open_since,
      'worked_minutes', b.worked_minutes, 'sessions', b.sessions,
      'open_sessions', b.open_sessions, 'recorded_offline', b.recorded_offline,
      'on_site', b.on_site, 'unrostered', b.unrostered,
      'late_minutes', b.late_minutes, 'overdue_minutes', b.overdue_minutes,
      'state', b.state
    ) order by
        -- the order a supervisor wants: problems first, then who is here
        case b.state when 'missed' then 0 when 'on_site' then 1
                     when 'upcoming' then 2 else 3 end,
        b.expected_start_min nulls last, b.staff_name),
      '[]'::jsonb),
    jsonb_build_object(
      'people', count(*),
      'rostered', count(*) filter (where not b.unrostered),
      'on_site', count(*) filter (where b.state = 'on_site'),
      'finished', count(*) filter (where b.state = 'finished'),
      'upcoming', count(*) filter (where b.state = 'upcoming'),
      'missed', count(*) filter (where b.state = 'missed'),
      'late', count(*) filter (where b.late_minutes > 0),
      'overdue', count(*) filter (where b.overdue_minutes > 0),
      'unrostered_here', count(*) filter (where b.unrostered and b.sessions > 0),
      'rostered_minutes', coalesce(sum(b.rostered_minutes), 0),
      'worked_minutes', coalesce(sum(b.worked_minutes), 0))
    into v_rows, v_sum
    from built b;

  return jsonb_build_object(
    'ok', true,
    'date', p_date,
    'timezone', v_tz,
    'server_time', v_now,
    'now_min', v_now_min,
    'grace_min', v_grace,
    -- false means: you may see the counts, not the people
    'detail', v_detail,
    'summary', v_sum,
    'rows', case when v_detail then v_rows else '[]'::jsonb end);
end $$;
revoke all on function public.attendance_day(uuid, date, int) from public;
grant execute on function public.attendance_day(uuid, date, int) to authenticated;
