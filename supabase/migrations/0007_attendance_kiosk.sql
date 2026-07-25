-- =============================================================================
-- 0007 — Stage 2 phase 2: attendance + KIOSK DEVICES.
--
-- The kiosk (wall tablet / Android APK) is NOT a logged-in user. It is a
-- provisioned DEVICE: an admin creates it, gets a 6-digit pair code, the
-- device redeems that code once and stores a long-lived device token. From
-- then on it calls three SECURITY DEFINER RPCs and can do NOTHING else:
--   kiosk_pair(code)                  → token + building identity
--   kiosk_staff_search(token, query)  → matching NAMES only (never PINs)
--   kiosk_punch(token, pin, kind, …)  → records a check-in/out
-- PINs never leave the server: the device sends a PIN, the database compares
-- and answers yes/no. A stolen device token can only punch for its own
-- building and can never read rosters, timesheets or other buildings.
--
-- Everything else (staff, shifts, events) is ordinary RLS-protected data
-- visible to the org members who service that building, per app.can().
-- Idempotent — safe to re-run.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- staff ----
create table if not exists public.staff (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  building_id  uuid not null references public.buildings(id) on delete cascade,
  name         text not null,
  role         text not null default 'Cleaner',
  -- 4-digit kiosk PIN, unique per building. Never selected by client code:
  -- reads go through RLS which excludes anon/kiosk, and the kiosk compares
  -- via a definer function instead of fetching.
  pin          text not null check (pin ~ '^[0-9]{4}$'),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists staff_pin_per_building
  on public.staff (building_id, pin) where active;
create index if not exists staff_building_idx on public.staff (building_id) where active;

-- --------------------------------------------------------- kiosk devices ----
create table if not exists public.kiosk_devices (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  org_id       uuid not null references public.organisations(id) on delete cascade,
  label        text not null,                       -- "Cleaners room iPad"
  pair_code    text,                                -- 6 digits, cleared on pair
  pair_expires timestamptz,
  device_token uuid,                                -- issued at pairing
  paired_at    timestamptz,
  last_seen    timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists kiosk_device_token_idx
  on public.kiosk_devices (device_token) where device_token is not null;
create unique index if not exists kiosk_pair_code_idx
  on public.kiosk_devices (pair_code) where pair_code is not null;

-- ---------------------------------------------------------------- shifts ----
create table if not exists public.roster_shifts (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  work_date    date not null,
  start_min    int  not null check (start_min between 0 and 1440),
  end_min      int  not null check (end_min between 0 and 1440),
  zone         text not null default '',
  created_at   timestamptz not null default now(),
  unique (staff_id, work_date, start_min)
);
create index if not exists roster_shifts_building_date_idx
  on public.roster_shifts (building_id, work_date);

-- ---------------------------------------------------------------- events ----
create table if not exists public.attendance_events (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references public.buildings(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  kind         text not null check (kind in ('in','out')),
  at           timestamptz not null default now(),
  source       text not null default 'kiosk' check (source in ('kiosk','qr','manual')),
  device_id    uuid references public.kiosk_devices(id) on delete set null,
  selfie_path  text,                                  -- Storage object path
  created_at   timestamptz not null default now()
);
create index if not exists attendance_events_building_at_idx
  on public.attendance_events (building_id, at desc);
create index if not exists attendance_events_staff_at_idx
  on public.attendance_events (staff_id, at desc);


-- Who may manage cleaners/devices/shifts at a building? NOT just the owner
-- org: the CLEANING COMPANY manages its own staff at every building it
-- services (multi-org rule — a provider is responsible for its own people).
-- Owner/strata admins keep their authority via app.manages_building.
create or replace function app.manages_staff_at(check_building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select app.is_super_admin() or app.manages_building(check_building) or exists (
    select 1
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.active
      and r.key in ('org_admin','manager')
      and app.org_serves_building(m.org_id, check_building)
  )
$$;

-- Which organisation does a cleaner created by THIS caller belong to? The
-- cleaning company's own org, not the building owner's — a cleaner is FOCT
-- Cleaning's employee even though they work in Meridian's tower. Falls back to
-- the owner org for super admins and owner-side admins creating their own.
create or replace function app.managing_org_for(check_building uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.org_id
       from public.organisation_memberships m
       join public.roles r on r.id = m.role_id
      where m.user_id = auth.uid() and m.active
        and r.key in ('org_admin','manager')
        and app.org_serves_building(m.org_id, check_building)
      limit 1),
    (select owner_org_id from public.buildings where id = check_building))
$$;

-- ------------------------------------------------------------------- RLS ----
alter table public.staff             enable row level security;
alter table public.kiosk_devices     enable row level security;
alter table public.roster_shifts     enable row level security;
alter table public.attendance_events enable row level security;

do $$ begin
  -- staff: readable/writable by org members who service the building
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='staff_read') then
    create policy staff_read on public.staff for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='staff_write') then
    create policy staff_write on public.staff for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='kiosk_devices' and policyname='kiosk_read') then
    create policy kiosk_read on public.kiosk_devices for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='kiosk_devices' and policyname='kiosk_write') then
    create policy kiosk_write on public.kiosk_devices for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='roster_shifts' and policyname='shifts_read') then
    create policy shifts_read on public.roster_shifts for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='roster_shifts' and policyname='shifts_write') then
    create policy shifts_write on public.roster_shifts for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='attendance_events' and policyname='events_read') then
    create policy events_read on public.attendance_events for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  -- events are written by the kiosk RPC (definer) or a manager correcting
  if not exists (select 1 from pg_policies where tablename='attendance_events' and policyname='events_write') then
    create policy events_write on public.attendance_events for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;
end $$;

-- ------------------------------------------------- admin: device pairing ----
-- Creates (or re-issues) a 6-digit pair code valid for 24 hours.
create or replace function public.kiosk_issue_pair_code(p_device uuid)
returns text
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_code text;
begin
  select building_id into v_building from public.kiosk_devices where id = p_device;
  if v_building is null then raise exception 'device not found'; end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.kiosk_devices where pair_code = v_code);
  end loop;
  update public.kiosk_devices
     set pair_code = v_code, pair_expires = now() + interval '24 hours',
         device_token = null, paired_at = null
   where id = p_device;
  return v_code;
end $$;
revoke all on function public.kiosk_issue_pair_code(uuid) from public;
grant execute on function public.kiosk_issue_pair_code(uuid) to authenticated;

-- ------------------------------------------------------- device: pairing ----
-- Redeems a pair code ONCE and returns the device's long-lived token.
create or replace function public.kiosk_pair(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare d record; v_token uuid;
begin
  select k.*, b.name as building_name into d
    from public.kiosk_devices k
    join public.buildings b on b.id = k.building_id
   where k.pair_code = p_code and k.active
     and (k.pair_expires is null or k.pair_expires > now());
  if d is null then return jsonb_build_object('ok', false, 'error', 'Pair code not recognised or expired'); end if;
  v_token := gen_random_uuid();
  update public.kiosk_devices
     set device_token = v_token, paired_at = now(), pair_code = null,
         pair_expires = null, last_seen = now()
   where id = d.id;
  return jsonb_build_object(
    'ok', true, 'device_token', v_token, 'device_label', d.label,
    'building_id', d.building_id, 'building_name', d.building_name);
end $$;
revoke all on function public.kiosk_pair(text) from public;
grant execute on function public.kiosk_pair(text) to anon, authenticated;

-- resolve a token → device row (internal helper)
create or replace function app.kiosk_device(p_token uuid)
returns public.kiosk_devices
language sql stable security definer set search_path = public as $$
  select * from public.kiosk_devices
   where device_token = p_token and active and device_token is not null
$$;

-- --------------------------------------------------- device: name search ----
-- Names only. Never returns PINs — the device cannot learn a credential.
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
     and (coalesce(p_query,'') = '' or s.name ilike '%' || p_query || '%')
   limit 12;
  return jsonb_build_object('ok', true, 'staff', v);
end $$;
revoke all on function public.kiosk_staff_search(uuid, text) from public;
grant execute on function public.kiosk_staff_search(uuid, text) to anon, authenticated;

-- -------------------------------------------------------- device: punch ----
-- The whole check-in/out transaction. Validates the PIN server-side, guards
-- against double check-in / check-out with no open shift, and records the
-- event (optionally with a selfie object path uploaded by the device).
create or replace function public.kiosk_punch(
  p_token uuid, p_pin text, p_kind text, p_selfie_path text default null,
  p_staff_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; s public.staff; last_kind text;
begin
  if p_kind not in ('in','out') then return jsonb_build_object('ok', false, 'error', 'Bad action'); end if;
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  update public.kiosk_devices set last_seen = now() where id = d.id;

  select * into s from public.staff
   where building_id = d.building_id and pin = p_pin and active;
  if s.id is null then
    return jsonb_build_object('ok', false, 'error', 'PIN not recognised — check with your supervisor.');
  end if;
  -- when the user picked their name first, the PIN must be theirs
  if p_staff_id is not null and p_staff_id <> s.id then
    return jsonb_build_object('ok', false, 'error', 'That PIN does not match the selected name.');
  end if;

  -- "today" is the BUILDING's day, not UTC's — a 6am Melbourne start is still
  -- the previous UTC date for most of the year.
  select e.kind into last_kind from public.attendance_events e
   where e.staff_id = s.id
     and (e.at at time zone 'Australia/Melbourne')::date
       = (now() at time zone 'Australia/Melbourne')::date
   order by e.at desc limit 1;

  if p_kind = 'in' and last_kind = 'in' then
    return jsonb_build_object('ok', false, 'already', true, 'staff_name', s.name,
      'error', s.name || ', you are already checked in — use Check out when you leave.');
  end if;
  if p_kind = 'out' and (last_kind is null or last_kind = 'out') then
    return jsonb_build_object('ok', false, 'no_open_shift', true, 'staff_name', s.name,
      'error', s.name || ', there is no open shift to check out of — check in first.');
  end if;

  insert into public.attendance_events (building_id, staff_id, kind, source, device_id, selfie_path)
  values (d.building_id, s.id, p_kind, 'kiosk', d.id, p_selfie_path);

  return jsonb_build_object('ok', true, 'staff_id', s.id, 'staff_name', s.name,
    'kind', p_kind, 'at', now());
end $$;
revoke all on function public.kiosk_punch(uuid, text, text, text, uuid) from public;
grant execute on function public.kiosk_punch(uuid, text, text, text, uuid) to anon, authenticated;

-- ------------------------------------------------- admin: create a cleaner ----
-- Generates a unique non-trivial 4-digit PIN for the building and returns it
-- ONCE for the admin to pass on privately.
create or replace function public.staff_create(
  p_building uuid, p_name text, p_role text default 'Cleaner'
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid; v_pin text; v_id uuid;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  v_org := app.managing_org_for(p_building);
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff where building_id = p_building and pin = v_pin and active);
  end loop;
  insert into public.staff (org_id, building_id, name, role, pin)
  values (v_org, p_building, trim(p_name), coalesce(nullif(trim(p_role),''),'Cleaner'), v_pin)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'staff_id', v_id, 'name', trim(p_name), 'pin', v_pin);
end $$;
revoke all on function public.staff_create(uuid, text, text) from public;
grant execute on function public.staff_create(uuid, text, text) to authenticated;

-- ------------------------------------------------------ admin: reset a PIN ----
-- PINs are write-only from the app's point of view: nobody can look one up, so
-- "they forgot it" is answered by issuing a new one and reading it out once.
create or replace function public.staff_reset_pin(p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_building uuid; v_pin text;
begin
  select building_id into v_building from public.staff where id = p_staff;
  if v_building is null then raise exception 'staff not found'; end if;
  if not app.manages_staff_at(v_building) then raise exception 'not permitted'; end if;
  loop
    v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when v_pin not in ('0000','1111','2222','3333','4444','5555','6666','7777','8888','9999','1234','4321')
      and not exists (select 1 from public.staff
                       where building_id = v_building and pin = v_pin and active and id <> p_staff);
  end loop;
  update public.staff set pin = v_pin where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- --------------------------------------------- admin: provision a kiosk ----
-- One call creates the device and hands back the code to type into the tablet.
create or replace function public.kiosk_device_create(p_building uuid, p_label text)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_id uuid; v_code text;
begin
  if not app.manages_staff_at(p_building) then raise exception 'not permitted'; end if;
  insert into public.kiosk_devices (building_id, org_id, label)
  values (p_building, app.managing_org_for(p_building),
          coalesce(nullif(trim(p_label),''), 'Kiosk'))
  returning id into v_id;
  v_code := public.kiosk_issue_pair_code(v_id);
  return jsonb_build_object('ok', true, 'device_id', v_id, 'pair_code', v_code);
end $$;
revoke all on function public.kiosk_device_create(uuid, text) from public;
grant execute on function public.kiosk_device_create(uuid, text) to authenticated;

-- ------------------------------------------- reporting: paired attendance ----
-- The raw table is a stream of in/out punches; a timesheet needs SESSIONS.
-- This pairs each 'in' with the next event for that cleaner on that building
-- day and returns worked minutes, so the timesheet screen never has to guess.
-- An unpaired 'in' comes back with out_at null (still on site, or forgot).
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
   where p.kind = 'in';
  return jsonb_build_object('ok', true, 'sessions', v);
end $$;
revoke all on function public.attendance_sessions(uuid, date, date) from public;
grant execute on function public.attendance_sessions(uuid, date, date) to authenticated;
