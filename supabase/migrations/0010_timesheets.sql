-- =============================================================================
-- 0010 — Timesheets: the hours a cleaner is actually paid for.
--
-- The kiosk records punches (0007/0009). This turns them into a week a manager
-- can read, correct, approve or reject, and export — and makes that decision a
-- durable record rather than a screen state.
--
-- Two tables and three rules:
--
--   attendance_adjustments — a manager's +/- correction to ONE worked session,
--     always with a reason. The punches themselves are never edited: what the
--     tablet recorded stays exactly as recorded, and the correction sits beside
--     it. If a payroll query ever arises, both numbers survive.
--
--   timesheet_weeks — the decision: pending → approved / rejected, with who
--     decided, when, the paid figure and a note. Reopening is allowed and
--     recorded; silently changing an approved week is not.
--
--   RULE: an APPROVED week is locked. Corrections are refused until someone
--   reopens it. That is the difference between a record and a spreadsheet.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ------------------------------------------------------ per-session ------
create table if not exists public.attendance_adjustments (
  id             uuid primary key default gen_random_uuid(),
  -- the CHECK-IN event identifies the session; its check-out is whatever
  -- follows it that day (see attendance_sessions)
  session_event_id uuid not null unique
                   references public.attendance_events(id) on delete cascade,
  building_id    uuid not null references public.buildings(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  delta_minutes  int not null check (delta_minutes between -1440 and 1440),
  note           text not null default '',
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists attendance_adjustments_staff_idx
  on public.attendance_adjustments (building_id, staff_id);

-- --------------------------------------------------------- the week -----
create table if not exists public.timesheet_weeks (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  -- Monday of the week, in the BUILDING's timezone
  week_start     date not null,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  /** what payroll pays: derived hours + corrections, or a manager's override */
  approved_minutes int,
  note           text not null default '',
  decided_by     uuid references public.users(id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (building_id, staff_id, week_start)
);
create index if not exists timesheet_weeks_lookup
  on public.timesheet_weeks (building_id, week_start);

-- ------------------------------------------------------------- RLS ------
alter table public.attendance_adjustments enable row level security;
alter table public.timesheet_weeks        enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='attendance_adjustments' and policyname='adjustments_read') then
    create policy adjustments_read on public.attendance_adjustments for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='attendance_adjustments' and policyname='adjustments_write') then
    create policy adjustments_write on public.attendance_adjustments for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='timesheet_weeks' and policyname='timesheet_read') then
    create policy timesheet_read on public.timesheet_weeks for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='timesheet_weeks' and policyname='timesheet_write') then
    create policy timesheet_write on public.timesheet_weeks for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;
end $$;

-- Monday of the week containing a date, in the building's own timezone.
create or replace function app.week_start(p_building uuid, p_when timestamptz default now())
returns date
language sql stable security definer set search_path = public as $$
  select (date_trunc('week', p_when at time zone
           coalesce((select timezone from public.buildings where id = p_building),
                    'Australia/Melbourne')))::date
$$;


-- ============================================ the week, as payroll sees it ===
-- One call returns everything the timesheet screen and the CSV export need, so
-- the two can never disagree: per-person sessions with their corrections, the
-- rostered comparison, and the current decision.
create or replace function public.timesheet_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_rows jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.recorded_offline, e.source,
           (e.at at time zone v_tz)::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone v_tz)::date
             between p_week_start and p_week_start + 6
  ), paired as (
    select ev.*,
           lead(ev.kind) over w as next_kind,
           lead(ev.at)   over w as next_at
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  ), sessions as (
    select p.id as session_event_id, p.staff_id, p.work_date, p.at as in_at,
           case when p.next_kind = 'out' then p.next_at end as out_at,
           case when p.next_kind = 'out'
                then round(extract(epoch from (p.next_at - p.at)) / 60)::int end as minutes,
           p.recorded_offline, p.selfie_path, p.source
      from paired p
     where p.kind = 'in'
  ), rostered as (
    select r.staff_id, sum(r.end_min - r.start_min)::int as minutes
      from public.roster_shifts r
     where r.building_id = p_building
       and r.work_date between p_week_start and p_week_start + 6
     group by r.staff_id
  )
  select coalesce(jsonb_agg(x order by x ->> 'staff_name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
      'staff_id',   s.id,
      'staff_name', s.name,
      'role',       s.role,
      'active',     s.active,
      'rostered_minutes', coalesce(ro.minutes, 0),
      -- a session still open (no check-out) contributes nothing to pay yet,
      -- but is reported so a manager can see and correct it
      'worked_minutes', coalesce((select sum(se.minutes) from sessions se where se.staff_id = s.id), 0),
      'adjustment_minutes', coalesce((
          select sum(a.delta_minutes) from public.attendance_adjustments a
           join sessions se2 on se2.session_event_id = a.session_event_id
          where a.staff_id = s.id), 0),
      'open_sessions', (select count(*) from sessions se where se.staff_id = s.id and se.out_at is null),
      'status',           coalesce(w.status, 'pending'),
      'approved_minutes', w.approved_minutes,
      'note',             coalesce(w.note, ''),
      'decided_at',       w.decided_at,
      'decided_by',       (select u.name from public.users u where u.id = w.decided_by),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'session_event_id', se.session_event_id,
                 'work_date', se.work_date,
                 'in_at', se.in_at,
                 'out_at', se.out_at,
                 'minutes', se.minutes,
                 'recorded_offline', se.recorded_offline,
                 'selfie_path', se.selfie_path,
                 'adjustment_minutes', coalesce(a.delta_minutes, 0),
                 'adjustment_note', coalesce(a.note, '')
               ) order by se.in_at)
          from sessions se
          left join public.attendance_adjustments a on a.session_event_id = se.session_event_id
         where se.staff_id = s.id), '[]'::jsonb)
    ) as x
    from public.staff s
    left join rostered ro on ro.staff_id = s.id
    left join public.timesheet_weeks w
           on w.staff_id = s.id and w.building_id = p_building and w.week_start = p_week_start
    where s.building_id = p_building
      and (s.active
           or exists (select 1 from sessions se where se.staff_id = s.id)
           or w.id is not null)
  ) rows;

  return jsonb_build_object(
    'ok', true,
    'week_start', p_week_start,
    'timezone', v_tz,
    'rows', v_rows);
end $$;
revoke all on function public.timesheet_week(uuid, date) from public;
grant execute on function public.timesheet_week(uuid, date) to authenticated;


-- ================================================= correct one session =====
-- Never edits the punch. Adds (or replaces) a signed correction beside it,
-- with a reason, and refuses once the week is approved.
create or replace function public.attendance_adjust(
  p_session_event uuid, p_delta_minutes int, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare e public.attendance_events; v_week date; v_status text;
begin
  select * into e from public.attendance_events where id = p_session_event;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'Session not found'); end if;
  if not app.manages_staff_at(e.building_id) then raise exception 'not permitted'; end if;
  if e.kind <> 'in' then
    return jsonb_build_object('ok', false, 'error', 'Corrections attach to a check-in');
  end if;
  if coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A correction needs a reason');
  end if;

  v_week := app.week_start(e.building_id, e.at);
  select status into v_status from public.timesheet_weeks
   where building_id = e.building_id and staff_id = e.staff_id and week_start = v_week;
  if v_status = 'approved' then
    return jsonb_build_object('ok', false, 'locked', true,
      'error', 'That week is approved — reopen it before changing hours.');
  end if;

  if p_delta_minutes = 0 then
    delete from public.attendance_adjustments where session_event_id = p_session_event;
    return jsonb_build_object('ok', true, 'removed', true);
  end if;

  insert into public.attendance_adjustments
    (session_event_id, building_id, staff_id, delta_minutes, note, created_by)
  values (p_session_event, e.building_id, e.staff_id, p_delta_minutes, trim(p_note), auth.uid())
  on conflict (session_event_id) do update
    set delta_minutes = excluded.delta_minutes,
        note = excluded.note,
        created_by = excluded.created_by,
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.attendance_adjust(uuid, int, text) from public;
grant execute on function public.attendance_adjust(uuid, int, text) to authenticated;


-- =================================================== approve / reject =====
-- One entry point for every decision, so the audit trail is uniform:
--   'approved' — pays approved_minutes (defaults to worked + corrections)
--   'rejected' — sent back, always with a reason
--   'pending'  — reopened, which clears the previous decision
create or replace function public.timesheet_decide(
  p_building uuid, p_staff uuid, p_week_start date,
  p_status text, p_minutes int default null, p_note text default ''
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_minutes int; v_open int;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_status not in ('pending','approved','rejected') then
    return jsonb_build_object('ok', false, 'error', 'Unknown decision');
  end if;
  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building) then
    return jsonb_build_object('ok', false, 'error', 'Unknown employee for this site');
  end if;
  -- a rejection without a reason is not a rejection, it is a mystery
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Say why it is being sent back');
  end if;

  if p_status = 'approved' then
    select ((r ->> 'worked_minutes')::int + (r ->> 'adjustment_minutes')::int),
           (r ->> 'open_sessions')::int
      into v_minutes, v_open
      from jsonb_array_elements(public.timesheet_week(p_building, p_week_start) -> 'rows') r
     where (r ->> 'staff_id')::uuid = p_staff;
    v_minutes := coalesce(p_minutes, v_minutes, 0);
    if v_minutes < 0 then v_minutes := 0; end if;
  else
    v_minutes := null;
  end if;

  insert into public.timesheet_weeks
    (building_id, staff_id, week_start, status, approved_minutes, note, decided_by, decided_at)
  values (p_building, p_staff, p_week_start, p_status, v_minutes,
          coalesce(trim(p_note), ''),
          case when p_status = 'pending' then null else auth.uid() end,
          case when p_status = 'pending' then null else now() end)
  on conflict (building_id, staff_id, week_start) do update
    set status = excluded.status,
        approved_minutes = excluded.approved_minutes,
        note = excluded.note,
        decided_by = excluded.decided_by,
        decided_at = excluded.decided_at,
        updated_at = now();

  return jsonb_build_object('ok', true, 'status', p_status,
    'approved_minutes', v_minutes,
    -- worth saying out loud rather than silently paying zero for it
    'open_sessions', coalesce(v_open, 0));
end $$;
revoke all on function public.timesheet_decide(uuid, uuid, date, text, int, text) from public;
grant execute on function public.timesheet_decide(uuid, uuid, date, text, int, text) to authenticated;
