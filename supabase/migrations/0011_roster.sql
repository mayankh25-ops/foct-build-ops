-- =============================================================================
-- 0011 — Roster: who is meant to be here, and when.
--
-- `roster_shifts` already exists (0007) with RLS. What was missing is the part
-- that keeps it honest:
--
--   * a shift must END AFTER it starts, and may not overlap another shift for
--     the same person on the same day — you cannot roster someone twice at
--     once, and a manager who tries deserves to be told, not to have it
--     silently accepted;
--   * one write path (`roster_shift_set`) that validates and returns a reason,
--     so the screen never has to guess what went wrong;
--   * `roster_week()` so the board and the timesheet's "rostered" figure read
--     the same rows;
--   * `roster_copy_week()`, because a cleaning roster is the same most weeks
--     and retyping it is how mistakes get in.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- 0007 allowed 0..1440 on each end but never compared them.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'roster_shifts_end_after_start'
       and conrelid = 'public.roster_shifts'::regclass
  ) then
    -- clean up anything already inverted, so the constraint can be trusted
    delete from public.roster_shifts where end_min <= start_min;
    alter table public.roster_shifts
      add constraint roster_shifts_end_after_start check (end_min > start_min);
  end if;
end $$;

alter table public.roster_shifts add column if not exists note text not null default '';

-- The overlap rule lives in the database, not the form: two managers editing
-- the same week from two laptops cannot both win.
create or replace function public.roster_no_overlap() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.roster_shifts r
     where r.staff_id = new.staff_id
       and r.work_date = new.work_date
       and r.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
       and new.start_min < r.end_min
       and r.start_min < new.end_min
  ) then
    raise exception 'overlapping shift'
      using errcode = 'check_violation',
            hint = 'This person is already rostered over that time on that day.';
  end if;
  return new;
end $$;

drop trigger if exists roster_no_overlap on public.roster_shifts;
create trigger roster_no_overlap before insert or update on public.roster_shifts
  for each row execute function public.roster_no_overlap();


-- ============================================================ the week =====
-- One call for the board: every shift in the week, every person who could be
-- rostered, and the totals the timesheet compares against.
create or replace function public.roster_week(p_building uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_tz text; v_shifts jsonb; v_staff jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  select timezone into v_tz from public.buildings where id = p_building;
  if v_tz is null then raise exception 'building not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'staff_id', r.staff_id,
           'staff_name', s.name,
           'work_date', r.work_date,
           'start_min', r.start_min,
           'end_min', r.end_min,
           'minutes', r.end_min - r.start_min,
           'zone', r.zone,
           'note', r.note
         ) order by r.work_date, r.start_min), '[]'::jsonb)
    into v_shifts
    from public.roster_shifts r
    join public.staff s on s.id = r.staff_id
   where r.building_id = p_building
     and r.work_date between p_week_start and p_week_start + 6;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'rostered_minutes', coalesce((
             select sum(r.end_min - r.start_min) from public.roster_shifts r
              where r.staff_id = s.id
                and r.work_date between p_week_start and p_week_start + 6), 0)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = p_building and s.active;

  return jsonb_build_object(
    'ok', true, 'week_start', p_week_start, 'timezone', v_tz,
    'staff', v_staff, 'shifts', v_shifts);
end $$;
revoke all on function public.roster_week(uuid, date) from public;
grant execute on function public.roster_week(uuid, date) to authenticated;


-- ==================================================== create / update =====
-- p_id null creates; otherwise updates that shift. Returns a reason rather
-- than a Postgres error string when something is wrong.
create or replace function public.roster_shift_set(
  p_building uuid, p_staff uuid, p_work_date date,
  p_start_min int, p_end_min int, p_zone text default '', p_note text default '',
  p_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_end_min <= p_start_min then
    return jsonb_build_object('ok', false, 'error', 'The finish time must be after the start time.');
  end if;
  if p_start_min < 0 or p_end_min > 1440 then
    return jsonb_build_object('ok', false, 'error', 'Times must be inside one day.');
  end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = p_building and active) then
    return jsonb_build_object('ok', false, 'error', 'That person does not work at this site.');
  end if;

  begin
    if p_id is null then
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, p_staff, p_work_date, p_start_min, p_end_min,
              coalesce(p_zone, ''), coalesce(p_note, ''))
      returning id into v_id;
    else
      update public.roster_shifts
         set staff_id = p_staff, work_date = p_work_date,
             start_min = p_start_min, end_min = p_end_min,
             zone = coalesce(p_zone, ''), note = coalesce(p_note, '')
       where id = p_id and building_id = p_building
      returning id into v_id;
      if v_id is null then
        return jsonb_build_object('ok', false, 'error', 'That shift no longer exists.');
      end if;
    end if;
  exception
    when check_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They are already rostered over that time that day.');
    when unique_violation then
      return jsonb_build_object('ok', false, 'overlap', true,
        'error', 'They already have a shift starting at that time.');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) from public;
grant execute on function public.roster_shift_set(uuid, uuid, date, int, int, text, text, uuid) to authenticated;


create or replace function public.roster_shift_delete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid;
begin
  select building_id into v_building from public.roster_shifts where id = p_id;
  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  delete from public.roster_shifts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.roster_shift_delete(uuid) from public;
grant execute on function public.roster_shift_delete(uuid) to authenticated;


-- ======================================================= copy a week =====
-- A cleaning roster is the same most weeks. Copying is additive and skips
-- anything that would clash, then REPORTS how many it skipped — silently
-- dropping shifts would be worse than refusing outright.
create or replace function public.roster_copy_week(
  p_building uuid, p_from_week date, p_to_week date
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare r record; v_offset int; v_copied int := 0; v_skipped int := 0;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  if p_from_week = p_to_week then
    return jsonb_build_object('ok', false, 'error', 'Pick a different week to copy into.');
  end if;
  v_offset := p_to_week - p_from_week;

  for r in
    select * from public.roster_shifts
     where building_id = p_building
       and work_date between p_from_week and p_from_week + 6
     order by work_date, start_min
  loop
    begin
      insert into public.roster_shifts
        (building_id, staff_id, work_date, start_min, end_min, zone, note)
      values (p_building, r.staff_id, r.work_date + v_offset,
              r.start_min, r.end_min, r.zone, r.note);
      v_copied := v_copied + 1;
    exception when check_violation or unique_violation then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'copied', v_copied, 'skipped', v_skipped);
end $$;
revoke all on function public.roster_copy_week(uuid, date, date) from public;
grant execute on function public.roster_copy_week(uuid, date, date) to authenticated;
