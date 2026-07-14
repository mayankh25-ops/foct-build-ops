-- =============================================================================
-- sd_isolation_check.sql — Service Desk RLS acceptance tests (Stage 3).
-- Run after APPLY_STAGE3.sql (or locally after 0002 + seed_service_desk).
-- Same conventions as isolation_check.sql: exceptions on violation, rollback.
-- =============================================================================
begin;

create or replace function pg_temp.become(user_email text) returns void
language plpgsql security definer as $$
declare uid uuid;
begin
  select id into uid from public.users where email = user_email;
  if uid is null then raise exception 'seed user % missing', user_email; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.assert(cond boolean, label text) returns void
language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'SD ISOLATION FAIL: %', label; end if;
  raise notice 'ok: %', label;
end $$;

set local role authenticated;

-- ---- 1 · Concierge lodges through the app (authenticated path) --------------
select pg_temp.become('amelia@concierge.demo');
insert into public.sd_tickets (ref, org_id, building_id, priority, category_label, description, lodged_by_name)
select app.sd_next_ref(b.id), o.id, b.id, 'high', 'Graffiti', 'Tags beside lift bank B', 'Amelia Ng'
from public.buildings b, public.organisations o
where b.slug = 'aurora-on-collins' and o.slug = 'foct-cleaning';
select pg_temp.assert(
  (select count(*)::int from public.sd_tickets where lodged_by_name = 'Amelia Ng') = 1,
  'concierge can lodge and read a ticket for her building');
select pg_temp.assert(
  (select ref from public.sd_tickets where lodged_by_name = 'Amelia Ng') like 'SD-AUR-%',
  'ticket ref follows SD-{CODE}-{YYMM}-{seq}');

-- ---- 2 · Public QR intake (anon, token-gated RPC) ----------------------------
set local role anon;
select pg_temp.assert(
  (select ticket_ref from public.sd_lodge_ticket('aurora-demo-intake-7f2k',
    '{"lodgedBy":"Tenant rep","categoryLabel":"Spillage","priority":"normal",
      "locations":[{"level":"L12","area":"Kitchen point"}],
      "followers":["bm@auroraoncollins.com.au"],
      "photos":["data:image/jpeg;base64,QUJD"]}'::jsonb)) like 'SD-AUR-%',
  'anon lodges via valid intake token');
do $$
begin
  begin
    perform public.sd_lodge_ticket('wrong-token', '{}'::jsonb);
    raise exception 'SD ISOLATION FAIL: invalid token accepted';
  exception when others then
    if sqlerrm like '%invalid intake token%' then null;
    elsif sqlerrm like '%FAIL%' then raise;
    else null; end if;
  end;
end $$;
do $$
begin
  begin
    perform count(*) from public.sd_tickets;
    raise exception 'SD ISOLATION FAIL: anon can read tickets directly';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.assert(true, 'invalid token rejected; anon has no direct table read');

-- ---- 3 · Cleaning org works the ticket; internal notes stay internal ---------
set local role authenticated;
select pg_temp.become('priya@foct.demo');
select pg_temp.assert(
  (select count(*)::int from public.sd_tickets where lodged_by_name = 'Tenant rep') = 1,
  'cleaning manager sees the QR-lodged ticket');
update public.sd_tickets set status = 'in_progress', assigned_name = 'Marcus Chen', attended_at = now()
where lodged_by_name = 'Amelia Ng';
insert into public.sd_ticket_events (ticket_id, kind, actor_name, body, internal)
select id, 'note', 'Priya Sharma', 'Solvent stock low — use B2 backup', true
from public.sd_tickets where lodged_by_name = 'Amelia Ng';
insert into public.sd_ticket_events (ticket_id, kind, actor_name, body, internal)
select id, 'status', 'Marcus Chen', 'Attending — status In progress', false
from public.sd_tickets where lodged_by_name = 'Amelia Ng';
select pg_temp.assert(
  (select count(*)::int from public.sd_ticket_events where internal) >= 1,
  'cleaning org can write + read internal notes');

select pg_temp.become('amelia@concierge.demo');
select pg_temp.assert(
  (select count(*)::int from public.sd_ticket_events e
   join public.sd_tickets t on t.id = e.ticket_id
   where t.lodged_by_name = 'Amelia Ng' and e.internal) = 0,
  'concierge CANNOT see internal notes');
select pg_temp.assert(
  (select count(*)::int from public.sd_ticket_events e
   join public.sd_tickets t on t.id = e.ticket_id
   where t.lodged_by_name = 'Amelia Ng' and not e.internal) >= 1,
  'concierge sees public timeline events');
do $$
begin
  begin
    insert into public.sd_ticket_events (ticket_id, kind, actor_name, body, internal)
    select id, 'note', 'Amelia Ng', 'sneaky internal', true from public.sd_tickets limit 1;
    raise exception 'SD ISOLATION FAIL: concierge wrote an internal note';
  exception when others then
    if sqlerrm like '%FAIL%' then raise; end if;
  end;
end $$;
select pg_temp.assert(true, 'concierge cannot write internal notes');

-- ---- 4 · Building owner: oversight without the cleaning org''s internals -----
select pg_temp.become('sandra@meridian.demo');
select pg_temp.assert(
  (select count(*)::int from public.sd_tickets) >= 2,
  'building owner sees the building''s tickets');
select pg_temp.assert(
  (select count(*)::int from public.sd_ticket_events where internal) = 0,
  'building owner cannot read the cleaning org''s internal notes');

-- ---- 5 · Unrelated org: nothing -----------------------------------------------
select pg_temp.become('rita@rival.demo');
select pg_temp.assert((select count(*)::int from public.sd_tickets) = 0, 'rival org sees no tickets');
select pg_temp.assert((select count(*)::int from public.sd_ticket_photos) = 0, 'rival org sees no photos');
select pg_temp.assert((select count(*)::int from public.sd_site_staff) = 0, 'rival org sees no site staff');
update public.sd_tickets set status = 'closed' where true;
select pg_temp.become('priya@foct.demo');
select pg_temp.assert(
  (select count(*)::int from public.sd_tickets where status = 'closed') = 0,
  'rival org cannot modify tickets');

rollback;
