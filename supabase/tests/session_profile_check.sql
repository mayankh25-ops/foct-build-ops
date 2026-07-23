-- Stage 2 phase 1 — current_profile() isolation checks.
-- Run in the Supabase SQL editor (or the local mirror): expect 5 ok notices.
do $$
declare
  p jsonb;
begin
  -- 1. unauthenticated → null
  perform set_config('request.jwt.claims', '{}', true);
  select public.current_profile() into p;
  if p is null then raise notice 'ok 1: anon gets null profile';
  else raise exception 'FAIL 1: anon received a profile: %', p; end if;

  -- 2. Priya (FOCT Cleaning manager) sees her own identity
  perform set_config('request.jwt.claims',
    '{"sub":"22222222-0000-0000-0000-000000000003","role":"authenticated"}', true);
  select public.current_profile() into p;
  if p -> 'user' ->> 'email' = 'priya@foct.demo' then raise notice 'ok 2: profile user is the caller';
  else raise exception 'FAIL 2: wrong user: %', p -> 'user'; end if;

  -- 3. membership carries org + role keys
  if p -> 'memberships' -> 0 ->> 'org_slug' = 'foct-cleaning'
     and (p -> 'memberships' -> 0 ->> 'role') is not null then
    raise notice 'ok 3: membership exposes org + role';
  else raise exception 'FAIL 3: memberships: %', p -> 'memberships'; end if;

  -- 4. ONLY the caller's memberships — Priya must not see Meridian
  if p -> 'memberships' @> '[{"org_slug":"meridian-strata"}]' then
    raise exception 'FAIL 4: foreign membership leaked: %', p -> 'memberships';
  else raise notice 'ok 4: no foreign memberships'; end if;

  -- 5. buildings come only from the caller''s orgs
  if jsonb_array_length(p -> 'buildings') >= 1 then
    raise notice 'ok 5: serviced buildings resolved (%)', jsonb_array_length(p -> 'buildings');
  else raise exception 'FAIL 5: no buildings for a cleaning manager: %', p -> 'buildings'; end if;
end $$;
