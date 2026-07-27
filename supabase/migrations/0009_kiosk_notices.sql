-- =============================================================================
-- 0009 — Kiosk sign-in v1: notices, offline sync, per-site language.
--
-- Three things this adds to the kiosk built in 0007:
--
-- 1. NOTICES. Either general (everyone at a site) or personal (one employee),
--    with a date range, an optional daily time window, a priority, an optional
--    "must acknowledge", and a body stored as a per-language JSON map so one
--    notice carries English, Hindi, Punjabi… The acknowledgement record is
--    also the hook the future induction module hangs on.
--
-- 2. OFFLINE SYNC. A cleaners' room is a basement. The tablet caches what it
--    needs (kiosk_bootstrap), records sign-ins locally, and pushes them later
--    (kiosk_sync). Every event carries a client-generated UUID and the server
--    upserts on it, so replaying a batch after a flaky connection can never
--    double-punch anyone.
--
-- 3. OFFLINE PIN VERIFICATION. The tablet caches a bcrypt hash per employee,
--    never a PIN. Stated plainly: a 4-digit PIN is only 10,000 possibilities,
--    so this raises the cost of extracting one from a stolen tablet from
--    "read the file" to "hours of compute per person" — it does not make it
--    impossible. The real mitigations remain: retire the device (kills its
--    token instantly), reset the PIN, and the fact that a PIN alone only ever
--    permits punching in and out at one building.
--
-- Idempotent — safe to re-run.
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------- site settings ----
alter table public.buildings
  add column if not exists timezone text not null default 'Australia/Melbourne';
alter table public.buildings
  add column if not exists default_language text not null default 'en';

-- ------------------------------------------------------------- staff ------
alter table public.staff add column if not exists preferred_language text;
-- bcrypt of the PIN, for OFFLINE verification on the tablet. Online, the
-- server still compares the PIN itself (0007's kiosk_punch) and this is unused.
alter table public.staff add column if not exists pin_hash text;

-- --------------------------------------------------- attendance events ----
alter table public.attendance_events
  add column if not exists client_event_id uuid;
alter table public.attendance_events
  add column if not exists recorded_offline boolean not null default false;
-- what the tablet's own clock said, kept alongside `at` so a manager can see
-- when a device's time was wrong
alter table public.attendance_events
  add column if not exists device_time timestamptz;

-- THE idempotency guarantee: the same client event can only ever land once.
create unique index if not exists attendance_client_event_idx
  on public.attendance_events (client_event_id) where client_event_id is not null;


-- ---------------------------------------------------------- notices -------
create table if not exists public.notices (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  -- null = general (everyone at this site); set = personal to one employee
  staff_id      uuid references public.staff(id) on delete cascade,
  title         jsonb not null default '{}'::jsonb,  -- {"en": "...", "hi": "..."}
  body          jsonb not null,                      -- {"en": "...", "hi": "..."}
  priority      text not null default 'info'
                check (priority in ('info','important','urgent')),
  starts_on     date not null default current_date,
  ends_on       date,                                -- null = until switched off
  -- optional daily window, e.g. morning shift only (minutes from midnight)
  start_min     int check (start_min between 0 and 1440),
  end_min       int check (end_min between 0 and 1440),
  requires_ack  boolean not null default false,
  -- bumped when the text materially changes, so a re-issued notice
  -- re-prompts someone who already acknowledged the previous wording
  version       int not null default 1,
  active        boolean not null default true,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (body <> '{}'::jsonb),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists notices_building_idx
  on public.notices (building_id, starts_on desc) where active;
create index if not exists notices_staff_idx
  on public.notices (staff_id) where active and staff_id is not null;

create table if not exists public.notice_acks (
  id            uuid primary key default gen_random_uuid(),
  notice_id     uuid not null references public.notices(id) on delete cascade,
  staff_id      uuid not null references public.staff(id) on delete cascade,
  notice_version int not null default 1,
  acked_at      timestamptz not null default now(),
  device_id     uuid references public.kiosk_devices(id) on delete set null,
  unique (notice_id, staff_id, notice_version)
);

-- ------------------------------------------------------------- RLS --------
alter table public.notices     enable row level security;
alter table public.notice_acks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='notices' and policyname='notices_read') then
    create policy notices_read on public.notices for select to authenticated
      using (app.can_access_building(building_id));
  end if;
  if not exists (select 1 from pg_policies where tablename='notices' and policyname='notices_write') then
    create policy notices_write on public.notices for all to authenticated
      using (app.manages_staff_at(building_id))
      with check (app.manages_staff_at(building_id));
  end if;

  if not exists (select 1 from pg_policies where tablename='notice_acks' and policyname='notice_acks_read') then
    create policy notice_acks_read on public.notice_acks for select to authenticated
      using (exists (select 1 from public.notices n
                      where n.id = notice_id and app.can_access_building(n.building_id)));
  end if;
  -- acknowledgements are written by the kiosk RPC (definer); a manager may
  -- correct one at the building they manage
  if not exists (select 1 from pg_policies where tablename='notice_acks' and policyname='notice_acks_write') then
    create policy notice_acks_write on public.notice_acks for all to authenticated
      using (exists (select 1 from public.notices n
                      where n.id = notice_id and app.manages_staff_at(n.building_id)))
      with check (exists (select 1 from public.notices n
                      where n.id = notice_id and app.manages_staff_at(n.building_id)));
  end if;
end $$;

create or replace function public.notices_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  -- a changed body is a changed notice: bump the version so anyone who
  -- acknowledged the old wording is asked again
  if tg_op = 'UPDATE' and new.body is distinct from old.body then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
drop trigger if exists notices_touch on public.notices;
create trigger notices_touch before update on public.notices
  for each row execute function public.notices_touch();


-- ================================================== admin: write a PIN ====
-- 0007's staff_create / staff_reset_pin now also store the bcrypt hash the
-- tablet needs offline. Cost 10 ≈ 100 ms per guess: 10,000 PIN candidates is
-- a ~17-minute job per person, not an instant one.
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
  insert into public.staff (org_id, building_id, name, role, pin, pin_hash)
  values (v_org, p_building, trim(p_name), coalesce(nullif(trim(p_role),''),'Cleaner'),
          v_pin, crypt(v_pin, gen_salt('bf', 10)))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'staff_id', v_id, 'name', trim(p_name), 'pin', v_pin);
end $$;
revoke all on function public.staff_create(uuid, text, text) from public;
grant execute on function public.staff_create(uuid, text, text) to authenticated;

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
  update public.staff set pin = v_pin, pin_hash = crypt(v_pin, gen_salt('bf', 10)) where id = p_staff;
  return jsonb_build_object('ok', true, 'staff_id', p_staff, 'pin', v_pin);
end $$;
revoke all on function public.staff_reset_pin(uuid) from public;
grant execute on function public.staff_reset_pin(uuid) to authenticated;

-- backfill hashes for anyone created before this migration
update public.staff set pin_hash = crypt(pin, gen_salt('bf', 10))
 where pin_hash is null;


-- =============================================== which notices apply? =====
-- One definition of "showing now", used by every caller so the tablet and the
-- admin screen can never disagree about what a cleaner is being told.
create or replace function app.notice_is_current(n public.notices, at_time timestamptz, tz text)
returns boolean
language sql stable as $$
  select n.active
     and (at_time at time zone tz)::date >= n.starts_on
     and (n.ends_on is null or (at_time at time zone tz)::date <= n.ends_on)
     and (n.start_min is null
          or extract(hour from (at_time at time zone tz)) * 60
             + extract(minute from (at_time at time zone tz)) >= n.start_min)
     and (n.end_min is null
          or extract(hour from (at_time at time zone tz)) * 60
             + extract(minute from (at_time at time zone tz)) <= n.end_min)
$$;


-- ================================================ device: bootstrap ======
-- Everything the tablet caches, in one call: site, employees (names + PIN
-- HASHES, never PINs), the general notices, and the server's clock so the
-- device can measure its own drift.
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
   where s.building_id = d.building_id and s.active;

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


-- ============================================ device: notices for one =====
-- Called right after a sign-in: the general notices showing now, plus that
-- person's own, plus whether they still need to acknowledge each.
create or replace function public.notices_for_staff(p_token uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; b public.buildings; v jsonb;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  if not exists (select 1 from public.staff
                  where id = p_staff and building_id = d.building_id and active) then
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
       where n.building_id = d.building_id
         and (n.staff_id is null or n.staff_id = p_staff)
         and app.notice_is_current(n, now(), b.timezone)
    ) s;

  return jsonb_build_object('ok', true, 'notices', v);
end $$;
revoke all on function public.notices_for_staff(uuid, uuid) from public;
grant execute on function public.notices_for_staff(uuid, uuid) to anon, authenticated;


-- ================================================ device: acknowledge =====
create or replace function public.notice_ack(p_token uuid, p_notice uuid, p_staff uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare d public.kiosk_devices; v_version int;
begin
  d := app.kiosk_device(p_token);
  if d.id is null then return jsonb_build_object('ok', false, 'error', 'Device not paired'); end if;
  select n.version into v_version from public.notices n
   where n.id = p_notice and n.building_id = d.building_id
     and (n.staff_id is null or n.staff_id = p_staff);
  if v_version is null then return jsonb_build_object('ok', false, 'error', 'Notice not found here'); end if;

  insert into public.notice_acks (notice_id, staff_id, notice_version, device_id)
  values (p_notice, p_staff, v_version, d.id)
  on conflict (notice_id, staff_id, notice_version) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.notice_ack(uuid, uuid, uuid) from public;
grant execute on function public.notice_ack(uuid, uuid, uuid) to anon, authenticated;


-- ================================================== device: sync ==========
-- Push a batch of events recorded while the tablet had no network.
--
-- The PIN was verified on the device against the cached hash, so this trusts
-- the device token for identity — which is exactly as strong as the tablet
-- itself. Three things bound the damage: events must name a staff member at
-- THIS device's building, they cannot be dated in the future or more than 14
-- days back, and every one is stamped `recorded_offline` so a manager can see
-- which times came from an unsynced device.
--
-- Returns a verdict per event; the tablet deletes only what came back ok.
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
                    where id = v_staff and building_id = d.building_id and active) then
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


-- =========================== online punch keeps the same idempotency ======
-- Same contract as 0007 plus an optional client id, so a retried request over
-- a bad connection lands once. Superseded signature is dropped to keep the
-- catalogue honest.
drop function if exists public.kiosk_punch(uuid, text, text, text, uuid);
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
   where building_id = d.building_id and pin = p_pin and active;
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
