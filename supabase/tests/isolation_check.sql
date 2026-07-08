-- =============================================================================
-- isolation_check.sql — the CLAUDE.md isolation acceptance tests as plain SQL.
-- Runs BOTH on local Postgres (after tests/local_prelude.sql + migrations +
-- seed) AND in the Supabase SQL editor after applying APPLY_STAGE2.sql.
-- Every assertion raises an exception on violation; silence = pass.
-- =============================================================================
begin;

-- security definer: the lookup itself must bypass RLS (it runs before the
-- probe has an identity); owned by the applying role (postgres), which owns
-- the tables and therefore reads through RLS.
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
  if cond is distinct from true then raise exception 'ISOLATION FAIL: %', label; end if;
  raise notice 'ok: %', label;
end $$;

set local role authenticated;

-- ---- Priya Sharma: FOCT Cleaning manager ------------------------------------
select pg_temp.become('priya@foct.demo');
select pg_temp.assert(
  (select count(*) from public.buildings where slug = 'aurora-on-collins') = 1,
  'cleaning manager sees the assigned building');
select pg_temp.assert(
  (select count(*) from public.users where email = 'marcus@foct.demo') = 1,
  'cleaning manager sees own org cleaners');
select pg_temp.assert(
  (select count(*) from public.organisations where slug = 'rival-cleaning') = 0,
  'cleaning manager sees NOTHING of an unrelated org');
select pg_temp.assert(
  (select count(*) from public.users where email = 'rita@rival.demo') = 0,
  'cleaning manager cannot see another cleaning company''s staff');
select pg_temp.assert(
  (select count(*) from public.users where email = 'ben@brightspark.demo') = 0,
  'cleaning manager cannot see subcontractor staff records');
select pg_temp.assert(
  (select count(*) from public.organisations where slug = 'meridian-strata') = 1,
  'cleaning manager can see the building owner org name (shared building)');
select pg_temp.assert(
  (select count(*) from public.organisation_memberships m
   join public.organisations o on o.id = m.org_id where o.slug = 'concierge-collective') = 0,
  'cleaning manager cannot read concierge org memberships');

-- custom theme CRUD in own org
insert into public.themes (org_id, name, slug, base_theme)
select o.id, 'Isolation Probe', 'isolation-probe', 'option-nature'
from public.organisations o where o.slug = 'foct-cleaning';
select pg_temp.assert(
  (select count(*) from public.themes where slug = 'isolation-probe') = 1,
  'org member can create + read own custom theme');

-- ---- Amelia Ng: Concierge Collective staff ----------------------------------
select pg_temp.become('amelia@concierge.demo');
select pg_temp.assert(
  (select count(*) from public.buildings where slug = 'aurora-on-collins') = 1,
  'concierge sees the shared building');
select pg_temp.assert(
  (select count(*) from public.building_theme_assignments) >= 1,
  'concierge can read the building theme assignment (app must render it)');
select pg_temp.assert(
  (select count(*) from public.themes where slug = 'isolation-probe') = 0,
  'concierge cannot see another org''s custom theme');
select pg_temp.assert(
  (select count(*) from public.users where email = 'marcus@foct.demo') = 0,
  'concierge never sees cleaning staff records');
select pg_temp.assert(
  (select count(*) from public.service_contracts sc
   join public.organisations p on p.id = sc.provider_org_id
   where p.slug = 'foct-cleaning') = 0,
  'concierge cannot read the cleaning company''s contract');

-- ---- Rita Rival: unrelated cleaning org --------------------------------------
select pg_temp.become('rita@rival.demo');
select pg_temp.assert(
  (select count(*) from public.buildings) = 0,
  'unrelated org sees no buildings at all');
select pg_temp.assert(
  (select count(*) from public.users where email like '%@foct.demo') = 0,
  'unrelated org sees no FOCT users');
select pg_temp.assert(
  (select count(*) from public.themes where is_builtin) >= 10,
  'built-in themes are visible to every authenticated user');
select pg_temp.assert(
  (select count(*) from public.themes where slug = 'isolation-probe') = 0,
  'unrelated org cannot see FOCT''s custom theme');
select pg_temp.assert(
  (select count(*) from public.building_theme_assignments) = 0,
  'unrelated org cannot see theme assignments');
do $$
begin
  begin
    update public.themes set name = 'hijacked' where slug = 'isolation-probe';
  exception when others then null;
  end;
end $$;
select pg_temp.become('priya@foct.demo');
select pg_temp.assert(
  (select count(*) from public.themes where name = 'hijacked') = 0,
  'unrelated org cannot modify FOCT''s custom theme');

-- ---- Sandra Wells: building owner (Meridian Strata) ---------------------------
select pg_temp.become('sandra@meridian.demo');
select pg_temp.assert(
  (select count(*) from public.buildings where slug = 'aurora-on-collins') = 1,
  'owner org sees its building');
select pg_temp.assert(
  (select count(*) from public.building_modules) >= 5,
  'owner org reads module packaging');
select pg_temp.assert(
  (select count(*) from public.service_contracts) = 2,
  'owner org sees the contracts it is party to');
select pg_temp.assert(
  (select count(*) from public.users where email = 'marcus@foct.demo') = 0,
  'owner org still cannot browse contractor staff records');

rollback;  -- probe data never persists
