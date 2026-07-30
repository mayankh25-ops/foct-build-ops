-- =============================================================================
-- 0012 — THE ISOLATION FIX. Staff records belong to their employer, not to the
-- building.
--
-- WHAT WAS WRONG
-- 0007–0011 gated every staff-related READ on `app.can_access_building()` —
-- "are you attached to this building". At a real tower that is the concierge
-- company, the strata manager, an electrical subcontractor and every other
-- cleaning company on site. With Supabase's default table grants, all of them
-- could read, through the REST API:
--
--     select name, pin from staff;          -- including the plaintext kiosk PIN
--     select * from attendance_events;      -- when each cleaner came and went
--     select * from roster_shifts;          -- the cleaning roster
--     select * from timesheet_weeks;        -- what each person is paid
--
-- Reproduced on the mirror: the concierge, the strata admin AND the electrician
-- each read a cleaner's row and their 4-digit PIN — a PIN is a credential, so
-- that is not only a privacy breach, it is enough to sign somebody else in.
--
-- (It was invisible locally because a plain Postgres grants nothing to
-- `authenticated`, while Supabase grants everything and leaves RLS as the only
-- guard. `_mirror_bootstrap.sql` now copies those grants, so this class of hole
-- fails in CI from here on.)
--
-- WHAT THIS DOES
--   1. `app.in_org()` / `app.employs_staff()` / `app.manages_staff()` — one
--      definition of "this is my company's employee".
--   2. Every staff-related read policy is re-scoped from the BUILDING to the
--      EMPLOYING ORGANISATION. Attachment to a building no longer grants
--      anything about another company's people.
--   3. The secrets lose their column privileges outright: `staff.pin` and
--      `kiosk_devices.device_token` can no longer be selected by any API role,
--      whatever the policies say. Definer functions still read them.
--   4. Write paths gain the same employer test, so one cleaning company cannot
--      edit another's roster, corrections or PINs at a shared site.
--   5. The kiosk is scoped to its own organisation: a tablet no longer caches
--      another company's staff or their PIN hashes.
--
-- What the other orgs keep: the building owner and the concierge still get
-- cleaning PROGRESS through `attendance_day()`'s summary (0013) — counts, not
-- names. That is the CLAUDE.md rule ("completion status only when granted"),
-- expressed where it cannot be bypassed.
--
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------- helpers ----

-- Is the caller a member of THIS organisation? Super admins pass everywhere.
create or replace function app.in_org(check_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or exists (
    select 1 from public.organisation_memberships m
     where m.user_id = auth.uid() and m.active and m.org_id = check_org
  )
$$;
revoke all on function app.in_org(uuid) from public;
grant execute on function app.in_org(uuid) to authenticated;

-- Does the caller's organisation EMPLOY this person?
create or replace function app.employs_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff and app.in_org(s.org_id)
  )
$$;
revoke all on function app.employs_staff(uuid) from public;
grant execute on function app.employs_staff(uuid) to authenticated;

-- May the caller CHANGE this person's record? Their employer, and a manager.
create or replace function app.manages_staff(check_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.id = check_staff
       and app.in_org(s.org_id)
       and app.manages_staff_at(s.building_id)
  )
$$;
revoke all on function app.manages_staff(uuid) from public;
grant execute on function app.manages_staff(uuid) to authenticated;


-- ------------------------------------------------------- read policies -------
-- Each of these replaces a building-scoped read with an employer-scoped one.
do $$ begin
  -- staff: your company's people, at any building you service
  drop policy if exists staff_read on public.staff;
  create policy staff_read on public.staff for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists staff_write on public.staff;
  create policy staff_write on public.staff for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- kiosk devices: a pair code is a credential; only the owning org sees it
  drop policy if exists kiosk_read on public.kiosk_devices;
  create policy kiosk_read on public.kiosk_devices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists kiosk_write on public.kiosk_devices;
  create policy kiosk_write on public.kiosk_devices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  -- the roster is an employer's internal document
  drop policy if exists shifts_read on public.roster_shifts;
  create policy shifts_read on public.roster_shifts for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists shifts_write on public.roster_shifts;
  create policy shifts_write on public.roster_shifts for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- when each person came and went
  drop policy if exists events_read on public.attendance_events;
  create policy events_read on public.attendance_events for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists events_write on public.attendance_events;
  create policy events_write on public.attendance_events for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- corrections and pay decisions
  drop policy if exists adjustments_read on public.attendance_adjustments;
  create policy adjustments_read on public.attendance_adjustments for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists adjustments_write on public.attendance_adjustments;
  create policy adjustments_write on public.attendance_adjustments for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  drop policy if exists timesheet_read on public.timesheet_weeks;
  create policy timesheet_read on public.timesheet_weeks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists timesheet_write on public.timesheet_weeks;
  create policy timesheet_write on public.timesheet_weeks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));

  -- notices are written by one company for its own people
  drop policy if exists notices_read on public.notices;
  create policy notices_read on public.notices for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists notices_write on public.notices;
  create policy notices_write on public.notices for all to authenticated
    using (app.in_org(org_id) and app.manages_staff_at(building_id))
    with check (app.in_org(org_id) and app.manages_staff_at(building_id));

  drop policy if exists notice_acks_read on public.notice_acks;
  create policy notice_acks_read on public.notice_acks for select to authenticated
    using (app.employs_staff(staff_id));
  drop policy if exists notice_acks_write on public.notice_acks;
  create policy notice_acks_write on public.notice_acks for all to authenticated
    using (app.manages_staff(staff_id))
    with check (app.manages_staff(staff_id));
end $$;


-- --------------------------------------------------- the secret columns ------
-- Belt and braces, and the guard that survives a future policy mistake: the
-- credentials are not selectable by any API role at all.
--
-- NOTE ON HOW THIS HAS TO BE WRITTEN: `revoke select (pin)` alone does nothing
-- while table-level SELECT is granted — Postgres treats the table grant as
-- covering every column, present and future. So the table grant is withdrawn
-- and SELECT is re-granted column by column. (Proven the wrong way round first:
-- the column revoke passed silently and the PIN was still readable.)
--
-- CONSEQUENCE, worth knowing before adding a column: a new column on `staff` or
-- `kiosk_devices` is NOT readable by the app until it is added to the list
-- below. That is the safe direction to fail in.
revoke select on public.staff         from anon, authenticated;
revoke select on public.kiosk_devices from anon, authenticated;

-- `pin` (the credential itself) and `pin_hash` (offline verification, handed to
-- a paired tablet by kiosk_bootstrap) are deliberately absent.
grant select (id, org_id, building_id, name, role, active, created_at,
              preferred_language)
  on public.staff to authenticated;

-- `device_token` is deliberately absent: it is issued to the tablet by
-- kiosk_pair and never shown again. UPDATE is untouched, so "unpair this
-- tablet" can still clear it from the admin screen.
grant select (id, building_id, org_id, label, pair_code, pair_expires,
              paired_at, last_seen, active, created_at)
  on public.kiosk_devices to authenticated;


-- ============================================== definer reads, re-scoped =====
-- These functions run as the owner, so RLS does not apply inside them and the
-- scoping has to be written out. Each keeps its building check (an unrelated
-- company still gets "not permitted") and now returns, or accepts, only the
-- caller's OWN employees.
--
-- EVERYTHING BELOW THIS LINE IS GENERATED by scripts/build-0012-org-isolation.mjs:
-- each function is lifted verbatim from the migration that shipped it and given
-- one named patch, so a body can never silently drift from what is running.
-- Regenerate with `npm run build:0012`; do not hand-edit past this point.

-- --------------------------------------------------------------------------
-- attendance_sessions (0007) — the admin session list
-- --------------------------------------------------------------------------
create or replace function public.attendance_sessions(
  p_building uuid, p_from date, p_to date
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.can_access_building(p_building) then raise exception 'not permitted'; end if;
  with ev as (
    select e.id, e.staff_id, e.kind, e.at, e.selfie_path, e.device_id, e.source,
           (e.at at time zone 'Australia/Melbourne')::date as work_date
      from public.attendance_events e
     where e.building_id = p_building
       and (e.at at time zone 'Australia/Melbourne')::date between p_from and p_to
  ), paired as (
    select ev.*,
           lead(ev.kind)        over w as next_kind,
           lead(ev.at)          over w as next_at,
           lead(ev.selfie_path) over w as next_selfie
      from ev
    window w as (partition by ev.staff_id, ev.work_date order by ev.at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'staff_id',    p.staff_id,
           'staff_name',  s.name,
           'role',        s.role,
           'work_date',   p.work_date,
           'in_at',       p.at,
           'out_at',      case when p.next_kind = 'out' then p.next_at end,
           'minutes',     case when p.next_kind = 'out'
                            then round(extract(epoch from (p.next_at - p.at)) / 60)::int end,
           'in_selfie',   p.selfie_path,
           'out_selfie',  case when p.next_kind = 'out' then p.next_selfie end,
           'source',      p.source,
           'device_id',   p.device_id)
           order by p.work_date desc, p.at desc), '[]'::jsonb)
    into v
    from paired p
    join public.staff s on s.id = p.staff_id
   where p.kind = 'in'
     -- 0012: my organisation's employees only
     and app.in_org(s.org_id);
  return jsonb_build_object('ok', true, 'sessions', v);
end $$;
revoke all on function public.attendance_sessions(uuid, date, date) from public;
grant execute on function public.attendance_sessions(uuid, date, date) to authenticated;

-- --------------------------------------------------------------------------
-- kiosk_staff_search (0007) — a tablet searches its own company's names
-- --------------------------------------------------------------------------
create or replace function public.kiosk_staff_search(p_token uuid, p_query text)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]'::jsonb)
    into v
    from public.staff s
   where s.building_id = d.building_id and s.active
     -- 0012: this tablet belongs to ONE company
     and s.org_id = d.org_id
     and (coalesce(p_query,'') = '' or s.name ilike '%' || p_query || '%')
   limit 12;
  return jsonb_build_object('ok', true, 'staff', v);
end $$;
revoke all on function public.kiosk_staff_search(uuid, text) from public;
grant execute on function public.kiosk_staff_search(uuid, text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_bootstrap (0009) — the offline cache must not hold another company's PIN hashes
-- --------------------------------------------------------------------------
create or replace function public.kiosk_bootstrap(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v_staff jsonb; v_notices jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'role', s.role,
           'pin_hash', s.pin_hash,
           'language', coalesce(s.preferred_language, b.default_language)
         ) order by s.name), '[]'::jsonb)
    into v_staff
    from public.staff s
   where s.building_id = d.building_id and s.active
     -- 0012: never cache another company's staff or their PIN hashes
     and s.org_id = d.org_id;

  -- general notices only; personal ones are fetched after a sign-in so they
  -- are never cached on a device where the wrong person could read them
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'title', n.title, 'body', n.body,
           'priority', n.priority, 'requires_ack', n.requires_ack,
           'version', n.version,
           'starts_on', n.starts_on, 'ends_on', n.ends_on,
           'start_min', n.start_min, 'end_min', n.end_min
         ) order by
           case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end,
           n.created_at desc), '[]'::jsonb)
    into v_notices
    from public.notices n
   where n.building_id = d.building_id and n.active and n.staff_id is null
     and n.org_id = d.org_id   -- 0012
     and (n.ends_on is null or n.ends_on >= (now() at time zone b.timezone)::date);

  return jsonb_build_object(
    'ok', true,
    'server_time', now(),
    'device', jsonb_build_object('id', d.id, 'label', d.label),
    'site', jsonb_build_object('id', b.id, 'name', b.name, 'timezone', b.timezone,
                               'default_language', b.default_language),
    'staff', v_staff,
    'notices', v_notices);
end $$;
revoke all on function public.kiosk_bootstrap(uuid) from public;
grant execute on function public.kiosk_bootstrap(uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_punch (0009) — a PIN is only valid on its own company's tablet
-- --------------------------------------------------------------------------
create or replace function public.kiosk_punch(
  p_token uuid, p_pin text, p_kind text, p_selfie_path text default null,
  p_staff_id uuid default null, p_client_event_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; s public.staff; last_kind text; v_event uuid; b public.buildings;
begin
  if p_kind not in ('in','out') then return jsonb_build_object('ok', false, 'error', 'Bad action'); end if;
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;
  select * into b from public.buildings where id = d.building_id;

  -- an already-recorded client event is answered, not repeated
  if p_client_event_id is not null then
    select id into v_event from public.attendance_events where client_event_id = p_client_event_id;
    if v_event is not null then
      select * into s from public.staff where id =
        (select staff_id from public.attendance_events where id = v_event);
      return jsonb_build_object('ok', true, 'duplicate', true, 'event_id', v_event,
        'staff_id', s.id, 'staff_name', s.name, 'kind', p_kind);
    end if;
  end if;

  select * into s from public.staff
   where building_id = d.building_id and pin = p_pin and active
     and org_id = d.org_id;   -- 0012
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'PIN not recognised — check with your supervisor.');
  end if;
  if p_staff_id is not null and p_staff_id <> s.id then
    return jsonb_build_object('ok', false, 'error', 'That PIN does not match the selected name.');
  end if;

  -- "today" is the BUILDING's day, not UTC's
  select e.kind into last_kind from public.attendance_events e
   where e.staff_id = s.id
     and (e.at at time zone b.timezone)::date = (now() at time zone b.timezone)::date
   order by e.at desc limit 1;

  if p_kind = 'in' and last_kind = 'in' then
    return jsonb_build_object('ok', false, 'already', true, 'staff_name', s.name,
      'error', s.name || ', you are already checked in — use Check out when you leave.');
  end if;
  if p_kind = 'out' and (last_kind is null or last_kind = 'out') then
    return jsonb_build_object('ok', false, 'no_open_shift', true, 'staff_name', s.name,
      'error', s.name || ', there is no open shift to check out of — check in first.');
  end if;

  insert into public.attendance_events
    (building_id, staff_id, kind, source, device_id, selfie_path, client_event_id)
  values (d.building_id, s.id, p_kind, 'kiosk', d.id, p_selfie_path, p_client_event_id)
  returning id into v_event;

  return jsonb_build_object('ok', true, 'staff_id', s.id, 'staff_name', s.name,
    'kind', p_kind, 'at', now(), 'event_id', v_event);
end $$;
revoke all on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) from public;
grant execute on function public.kiosk_punch(uuid, text, text, text, uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- kiosk_sync (0009) — an offline batch cannot punch somebody else's employee
-- --------------------------------------------------------------------------
create or replace function public.kiosk_sync(p_token uuid, p_events jsonb)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  d public.kiosk_devices;
  e jsonb;
  v_results jsonb := '[]'::jsonb;
  v_client uuid; v_staff uuid; v_kind text; v_at timestamptz; v_id uuid;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;

  for e in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_client := nullif(e ->> 'client_event_id', '')::uuid;
    v_staff  := nullif(e ->> 'staff_id', '')::uuid;
    v_kind   := e ->> 'kind';
    v_at     := nullif(e ->> 'device_time', '')::timestamptz;

    if v_client is null or v_staff is null or v_kind not in ('in','out') or v_at is null then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Malformed event');
      continue;
    end if;
    if v_at > now() + interval '5 minutes' or v_at < now() - interval '14 days' then
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Timestamp out of range');
      continue;
    end if;
    if not exists (select 1 from public.staff
                    where id = v_staff and building_id = d.building_id and active
                      and org_id = d.org_id) then   -- 0012
      v_results := v_results || jsonb_build_object(
        'client_event_id', v_client, 'ok', false, 'error', 'Unknown employee for this site');
      continue;
    end if;

    -- upsert on the client's own id: replaying a batch is a no-op, never a
    -- second punch
    insert into public.attendance_events
      (building_id, staff_id, kind, at, source, device_id, selfie_path,
       client_event_id, recorded_offline, device_time)
    values
      (d.building_id, v_staff, v_kind, v_at, 'kiosk', d.id, nullif(e ->> 'selfie_path', ''),
       v_client, coalesce((e ->> 'recorded_offline')::boolean, true), v_at)
    -- the index is partial, so the predicate has to be repeated here for
    -- Postgres to infer it
    on conflict (client_event_id) where client_event_id is not null do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.attendance_events where client_event_id = v_client;
    end if;
    v_results := v_results || jsonb_build_object(
      'client_event_id', v_client, 'ok', true, 'event_id', v_id);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results, 'server_time', now());
end $$;
revoke all on function public.kiosk_sync(uuid, jsonb) from public;
grant execute on function public.kiosk_sync(uuid, jsonb) to anon, authenticated;

-- --------------------------------------------------------------------------
-- notices_for_staff (0009) — notices belong to the company that wrote them
-- --------------------------------------------------------------------------
create or replace function public.notices_for_staff(p_token uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = d.building_id and active
                    and org_id = d.org_id) then   -- 0012
    return jsonb_build_object('ok', false, 'error', 'Unknown employee');
  end if;
  select * into b from public.buildings where id = d.building_id;

  select coalesce(jsonb_agg(x order by x_rank, x_created desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
               'id', n.id, 'title', n.title, 'body', n.body,
               'priority', n.priority, 'personal', n.staff_id is not null,
               'requires_ack', n.requires_ack, 'version', n.version,
               'acked', exists (select 1 from public.notice_acks a
                                 where a.notice_id = n.id and a.staff_id = p_staff
                                   and a.notice_version = n.version)
             ) as x,
             case n.priority when 'urgent' then 0 when 'important' then 1 else 2 end as x_rank,
             n.created_at as x_created
        from public.notices n
       where n.building_id = d.building_id and n.org_id = d.org_id   -- 0012
         and (n.staff_id is null or n.staff_id = p_staff)
         and app.notice_is_current(n, now(), b.timezone)
    ) s;

  return jsonb_build_object('ok', true, 'notices', v);
end $$;
revoke all on function public.notices_for_staff(uuid, uuid) from public;
grant execute on function public.notices_for_staff(uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- notice_ack (0009) — acknowledging somebody else's notice is not a thing
-- --------------------------------------------------------------------------
create or replace function public.notice_ack(p_token uuid, p_notice uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v_version int;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  select n.version into v_version from public.notices n
   where n.id = p_notice and n.building_id = d.building_id and n.org_id = d.org_id
     and (n.staff_id is null or n.staff_id = p_staff);
  if v_version is null then return jsonb_build_object('ok', false, 'error', 'Notice not found here'); end if;

  insert into public.notice_acks (notice_id, staff_id, notice_version, device_id)
  values (p_notice, p_staff, v_version, d.id)
  on conflict (notice_id, staff_id, notice_version) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.notice_ack(uuid, uuid, uuid) from public;
grant execute on function public.notice_ack(uuid, uuid, uuid) to anon, authenticated;

-- --------------------------------------------------------------------------
-- staff_reset_pin (0009) — issuing a PIN is the employer's business
-- --------------------------------------------------------------------------
create or replace function public.staff_reset_pin(p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_pin text;
begin
  select building_id into v_building from public.staff where id = p_staff;
  if v_building is null then raise exception 'staff not found'; end if;
  -- 0012: the EMPLOYER, not merely a manager at this building
  if not app.manages_staff(p_staff) then raise exception 'not permitted'; end if;
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff
                       where building_id = v_building and pin = v_pin and active and id <> p_staff);
  end loop;
  update public.staff set pin = v_pin, pin_hash = app.hash_pin(v_pin) where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- timesheet_week (0010) — payroll is the most private thing here
-- --------------------------------------------------------------------------
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
      and app.in_org(s.org_id)   -- 0012: my organisation's employees only
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

-- --------------------------------------------------------------------------
-- attendance_adjust (0010) — only the employer corrects hours
-- --------------------------------------------------------------------------
create or replace function public.attendance_adjust(
  p_session_event uuid, p_delta_minutes int, p_note text
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare e public.attendance_events; v_week date; v_status text;
begin
  select * into e from public.attendance_events where id = p_session_event;
  if e.id is null then return jsonb_build_object('ok', false, 'error', 'Session not found'); end if;
  -- 0012: the employer of THIS person, not any manager at the building
  if not app.manages_staff(e.staff_id) then raise exception 'not permitted'; end if;
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

-- --------------------------------------------------------------------------
-- timesheet_decide (0010) — one company cannot approve another's week
-- --------------------------------------------------------------------------
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
  -- 0012: `and app.in_org(org_id)` makes another company's employee read as
  -- unknown rather than approvable
  if not exists (select 1 from public.staff where id = p_staff and building_id = p_building
                  and app.in_org(org_id)) then
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

-- --------------------------------------------------------------------------
-- roster_week (0011) — each company sees its own board at a shared site
-- --------------------------------------------------------------------------
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
     and app.in_org(s.org_id)   -- 0012
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
   where s.building_id = p_building and s.active and app.in_org(s.org_id);   -- 0012

  return jsonb_build_object(
    'ok', true, 'week_start', p_week_start, 'timezone', v_tz,
    'staff', v_staff, 'shifts', v_shifts);
end $$;
revoke all on function public.roster_week(uuid, date) from public;
grant execute on function public.roster_week(uuid, date) to authenticated;

-- --------------------------------------------------------------------------
-- roster_shift_set (0011) — you can only roster your own people, and only edit your own shifts
-- --------------------------------------------------------------------------
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
  -- 0012: "does not work at this site" now also covers "works here, for
  -- somebody else"
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = p_building and active
                    and app.in_org(org_id)) then
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
         and app.employs_staff(staff_id)   -- 0012: not somebody else's shift
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

-- --------------------------------------------------------------------------
-- roster_shift_delete (0011) — deleting another company's shift was possible at a shared site
-- --------------------------------------------------------------------------
create or replace function public.roster_shift_delete(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_staff uuid;
begin
  select building_id, staff_id into v_building, v_staff
    from public.roster_shifts where id = p_id;
  if v_building is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  -- 0012: the employer of the person on the shift
  if not app.manages_staff(v_staff) then raise exception 'not permitted'; end if;
  delete from public.roster_shifts where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.roster_shift_delete(uuid) from public;
grant execute on function public.roster_shift_delete(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- roster_copy_week (0011) — copying a week must not copy another company's shifts
-- --------------------------------------------------------------------------
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
    select rs.* from public.roster_shifts rs
     join public.staff st on st.id = rs.staff_id
     where rs.building_id = p_building
       and app.in_org(st.org_id)   -- 0012
       and rs.work_date between p_from_week and p_from_week + 6
     order by rs.work_date, rs.start_min
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
