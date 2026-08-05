-- A COMPLETELY EMPTY PROJECT — the owner's actual starting point. Expect 12 ok.
--
-- This suite runs against migrations WITHOUT the demo seed, because that is the
-- one arrangement the other thirteen suites can never express: they all start
-- from a database that already contains Meridian Strata, FOCT Cleaning and
-- Aurora on Collins, so every one of them silently assumes an organisation
-- exists.
--
-- On a real new project none does. `claim_access()` looked for an organisation
-- to attach the first person to, found none, and returned ok:true having done
-- nothing. That person signed in successfully, saw an empty sidebar, and hit
-- four screens that spin forever — with no error anywhere, because nothing had
-- errored. This is the walk from "brand-new Supabase project" to "a cleaner can
-- clock on", and it is the walk that was broken.
do $$
declare
  v_res jsonb; v_profile jsonb; v_b uuid; v_uid uuid; v_staff jsonb;
begin
  -- ----------------------------------------------------- the empty project --
  -- 1. nothing here at all
  if not exists (select 1 from public.organisations)
     and not exists (select 1 from public.buildings) then
    raise notice 'ok 1: the project starts with no organisations and no sites';
  else raise exception 'FAIL 1: the seed leaked into the bare suite'; end if;

  -- ------------------------------------------------- the first person in ---
  v_uid := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_uid, 'priya@brightclean.com.au', '{"name":"Priya Sharma"}'::jsonb);

  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_uid), true);

  -- 2. claiming access succeeds
  v_res := public.claim_access();
  if (v_res ->> 'ok')::boolean then
    raise notice 'ok 2: the first sign-in is accepted';
  else raise exception 'FAIL 2: %', v_res; end if;

  -- 3. AND ACTUALLY GIVES THEM SOMETHING. This is the assertion that would
  --    have caught the original bug: the old code returned ok:true with
  --    has_access false, which reads as success and behaves as a locked door.
  if (v_res ->> 'has_access')::boolean then
    raise notice 'ok 3: the first person in is given access, not an empty account';
  else raise exception 'FAIL 3: signed in with no access — %', v_res; end if;

  -- 4. an organisation was created for them, named from their email domain
  if exists (select 1 from public.organisations where name = 'Brightclean') then
    raise notice 'ok 4: an organisation is created and named from their email';
  else raise exception 'FAIL 4: no organisation — %',
    (select coalesce(string_agg(name, ', '), 'none') from public.organisations); end if;

  -- 5. and they are its admin, so they can actually set the place up
  if exists (select 1 from public.organisation_memberships m
               join public.roles r on r.id = m.role_id
              where m.user_id = v_uid and m.active and r.key = 'org_admin') then
    raise notice 'ok 5: they are an admin of it';
  else raise exception 'FAIL 5: not an org_admin'; end if;

  -- 6. ONLY THE FIRST. A second person signing up must not be handed the
  --    company — they wait for an invitation.
  declare v_other uuid := gen_random_uuid();
  begin
    insert into auth.users (id, email) values (v_other, 'stranger@example.com');
    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', v_other), true);
    v_res := public.claim_access();
    if not (v_res ->> 'has_access')::boolean then
      raise notice 'ok 6: the second person to find the URL gets nothing';
    else raise exception 'FAIL 6: a stranger claimed the project — %', v_res; end if;
  end;

  -- ------------------------------------------------------- the first site --
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_uid), true);

  -- 7. the profile has an organisation but no site yet — the state in which
  --    the app must say "add your first site", not spin
  v_profile := public.current_profile();
  if jsonb_array_length(v_profile -> 'buildings') = 0 then
    raise notice 'ok 7: before any site exists, the profile reports zero buildings';
  else raise exception 'FAIL 7: %', v_profile -> 'buildings'; end if;

  -- 8. and they can create one from the app
  v_res := public.site_create('Aurora on Collins', '380 Collins Street, Melbourne VIC 3000',
                              'Australia/Melbourne', 'en');
  v_b := (v_res ->> 'building_id')::uuid;
  if (v_res ->> 'ok')::boolean and v_b is not null then
    raise notice 'ok 8: the first site is created from inside the app';
  else raise exception 'FAIL 8: %', v_res; end if;

  -- 9. THE SITE IS VISIBLE TO THEM IMMEDIATELY — no re-login, no SQL editor
  v_profile := public.current_profile();
  if jsonb_array_length(v_profile -> 'buildings') = 1
     and (v_profile -> 'buildings' -> 0 ->> 'id')::uuid = v_b then
    raise notice 'ok 9: it appears in their profile straight away';
  else raise exception 'FAIL 9: created a site they cannot see — %', v_profile -> 'buildings'; end if;

  -- ------------------------------------------------- and the work starts ---
  -- 10. a cleaner can be added to it
  v_staff := public.staff_create(v_b, 'Marcus Chen', 'cleaner');
  if (v_staff ->> 'ok')::boolean and (v_staff ->> 'pin') ~ '^[0-9]{4}$' then
    raise notice 'ok 10: a cleaner is created with a kiosk PIN';
  else raise exception 'FAIL 10: %', v_staff; end if;

  -- 11. and appears on the Cleaners screen's query
  if exists (select 1 from public.staff where building_id = v_b and name = 'Marcus Chen') then
    raise notice 'ok 11: they show on the Cleaners screen';
  else raise exception 'FAIL 11: the cleaner is invisible'; end if;

  -- 12. a kiosk tablet can be provisioned, which is the last step before a
  --     cleaner can actually clock on
  v_res := public.kiosk_device_create(v_b, 'Cleaners room iPad');
  if (v_res ->> 'pair_code') ~ '^[0-9A-Z]{4,8}$' then
    raise notice 'ok 12: a kiosk tablet is provisioned — the site is ready to use';
  else raise exception 'FAIL 12: %', v_res; end if;
end $$;
