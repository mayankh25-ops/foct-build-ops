-- app_health() (0018). Expect 9 ok notices.
--
-- A health check is only worth having if it is right when things are wrong, so
-- most of this suite deliberately breaks the database and asks whether the
-- check noticed. The last two are the ones that matter: it must still ANSWER
-- when the thing it is reporting on is missing, rather than raising the same
-- error as everything else.
do $$
declare
  v_h jsonb;
  c_priya constant uuid := '22222222-0000-0000-0000-000000000003';
begin
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);

  -- 1. a complete database reports healthy
  v_h := public.app_health();
  if (v_h ->> 'ok')::boolean then
    raise notice 'ok 1: a fully-applied database reports healthy';
  else raise exception 'FAIL 1: %', v_h; end if;

  -- 2. with nothing to fix
  if (v_h ->> 'remedy') = 'none' then
    raise notice 'ok 2: and asks for no remedy';
  else raise exception 'FAIL 2: %', v_h ->> 'remedy'; end if;

  -- 3. it counts what is actually set up, so "empty" is distinguishable from
  --    "broken" — the distinction the loading screens could not make
  if (v_h -> 'counts' ->> 'buildings')::int >= 1
     and (v_h -> 'counts' ->> 'staff')::int >= 1 then
    raise notice 'ok 3: it reports how much is set up, not just pass/fail';
  else raise exception 'FAIL 3: %', v_h -> 'counts'; end if;

  -- 4. it knows whether anybody is signed in
  if (v_h ->> 'signed_in')::boolean then
    raise notice 'ok 4: it knows the caller is signed in';
  else raise exception 'FAIL 4: %', v_h; end if;

  -- ------------------------------------------------- now break things -------
  -- 5. A MISSING COLUMN IS DETECTED — this is the `buildings.slug` failure the
  --    owner actually hit, reported as a sentence instead of a 42703.
  alter table public.buildings drop column default_language;
  v_h := public.app_health();
  if not (v_h ->> 'ok')::boolean
     and v_h -> 'missing_columns' ? 'buildings.default_language' then
    raise notice 'ok 5: a column an older project never got is named exactly';
  else raise exception 'FAIL 5: %', v_h; end if;

  -- 6. and the remedy is the REPAIR script, not the bundle — the bundle would
  --    apply cleanly and change nothing, which is how this became a mystery
  if (v_h ->> 'remedy') = 'repair' then
    raise notice 'ok 6: it asks for REPAIR_SCHEMA.sql, which is the file that fixes it';
  else raise exception 'FAIL 6: %', v_h ->> 'remedy'; end if;
  alter table public.buildings add column default_language text not null default 'en';

  -- 7. a missing RPC is detected — the "it just spins" cause
  drop function if exists public.handover_feed(uuid, timestamptz, int);
  v_h := public.app_health();
  if not (v_h ->> 'ok')::boolean
     and v_h -> 'missing_functions' ? 'handover_feed' then
    raise notice 'ok 7: a missing RPC is named';
  else raise exception 'FAIL 7: %', v_h -> 'missing_functions'; end if;

  -- 8. and THAT one asks for the bundle
  if (v_h ->> 'remedy') = 'bundle' then
    raise notice 'ok 8: it asks for APPLY_EVERYTHING.sql';
  else raise exception 'FAIL 8: %', v_h ->> 'remedy'; end if;

  -- 9. IT STILL ANSWERS WITH A TABLE MISSING. A health check that raises the
  --    same error as everything else tells you nothing you did not know.
  drop table if exists public.handover_notes cascade;
  v_h := public.app_health();
  if v_h -> 'missing_tables' ? 'handover_notes'
     and (v_h -> 'counts' ->> 'buildings')::int >= 1 then
    raise notice 'ok 9: it works on a broken database — which is when it is needed';
  else raise exception 'FAIL 9: %', v_h; end if;
end $$;
