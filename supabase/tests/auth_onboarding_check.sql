-- Getting in (0015). Expect 15 ok notices.
--
-- This suite is about the front door. The failures it guards against are: a
-- correct password that signs you in to nothing, an invitation that grants more
-- than it should, an invitation that can be used twice or after it expires, and
-- the bootstrap ("first sign-in claims the project") turning into a way in for
-- anybody who arrives later.
do $$
declare
  v_building uuid; v_foct uuid; v_rival uuid; v_res jsonb;
  v_owner uuid := '44444444-0000-0000-0000-000000000001';   -- the project's first human
  v_mate  uuid := '44444444-0000-0000-0000-000000000002';   -- invited later
  v_rando uuid := '44444444-0000-0000-0000-000000000003';   -- nobody invited them
  v_invite uuid; v_n int;
  c_priya constant uuid := '22222222-0000-0000-0000-000000000003'; -- manager, FOCT Cleaning
begin
  select id into v_building from public.buildings where slug = 'aurora-on-collins';
  select id into v_foct  from public.organisations where slug = 'foct-cleaning';
  select id into v_rival from public.organisations where slug = 'rival-cleaning';

  -- The site has to be RUNNING for the bootstrap rule to mean anything: the
  -- first arrival lands in the organisation that employs the staff, so give
  -- FOCT Cleaning somebody to employ. (On a project with no staff at all the
  -- rule falls back to the oldest organisation — the owner side, which is who
  -- sets a project up.)
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);
  if not exists (select 1 from public.staff where building_id = v_building and active) then
    perform public.staff_create(v_building, 'Onboarding Cleaner');
  end if;

  -- a clean front door: nobody in this project has ever signed in
  update public.users set last_seen_at = null;
  delete from public.organisation_memberships
   where user_id in (v_owner, v_mate, v_rando);
  delete from public.users where id in (v_owner, v_mate, v_rando);

  insert into auth.users (id, email) values
    (v_owner, 'owner@example.com'),
    (v_mate,  'mate@example.com'),
    (v_rando, 'stranger@example.com')
  on conflict (id) do nothing;

  -- 1. a new account gets its profile row without anybody writing SQL
  --    (the trigger does it on a real project; claim_access() covers a
  --     locked-down one where the trigger could not be installed)
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_owner), true);
  v_res := public.claim_access();
  if exists (select 1 from public.users where id = v_owner and email = 'owner@example.com') then
    raise notice 'ok 1: a new account gets its profile row automatically';
  else raise exception 'FAIL 1: no profile row'; end if;

  -- 2. THE FIRST SIGN-IN CLAIMS THE PROJECT
  if (v_res ->> 'bootstrapped')::boolean and (v_res ->> 'has_access')::boolean then
    raise notice 'ok 2: the first person to sign in gets admin of the working organisation';
  else raise exception 'FAIL 2: %', v_res; end if;

  -- 3. and it is the org that actually runs the site, not an arbitrary one
  if exists (select 1 from public.organisation_memberships m
              where m.user_id = v_owner and m.org_id = v_foct) then
    raise notice 'ok 3: they land in the organisation that employs the staff';
  else raise exception 'FAIL 3: landed in the wrong organisation'; end if;

  -- 4. with the buildings that organisation services
  if exists (select 1 from public.building_memberships
              where user_id = v_owner and building_id = v_building) then
    raise notice 'ok 4: and on the buildings that organisation services';
  else raise exception 'FAIL 4: no building membership'; end if;

  -- 5. THE DOOR SHUTS. Somebody arriving afterwards gets nothing.
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_rando), true);
  v_res := public.claim_access();
  if not (v_res ->> 'bootstrapped')::boolean and not (v_res ->> 'has_access')::boolean then
    raise notice 'ok 5: once anybody has signed in, an uninvited arrival gets NOTHING';
  else raise exception 'FAIL 5: a stranger claimed access — %', v_res; end if;

  -- 6. and they really do see nothing
  select count(*) into v_n from public.organisation_memberships where user_id = v_rando;
  if v_n = 0 then raise notice 'ok 6: a stranger has no memberships at all';
  else raise exception 'FAIL 6: stranger has % memberships', v_n; end if;

  -- ------------------------------------------------------------ invites ----
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', c_priya), true);

  -- 7. a manager can invite somebody to their own organisation
  v_res := public.invite_create(v_foct, '  Mate@Example.com ', 'staff');
  if (v_res ->> 'ok')::boolean and v_res ->> 'email' = 'mate@example.com' then
    v_invite := (v_res ->> 'invite_id')::uuid;
    raise notice 'ok 7: a manager can invite somebody, and the address is normalised';
  else raise exception 'FAIL 7: %', v_res; end if;

  -- 8. NOT to a role above their own — a manager cannot mint an admin
  v_res := public.invite_create(v_foct, 'sneaky@example.com', 'super_admin');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 8: nobody can invite somebody to a role above their own';
  else raise exception 'FAIL 8: a manager minted a super admin'; end if;

  -- 9. and not into an organisation they are not in
  begin
    v_res := public.invite_create(v_rival, 'mole@example.com', 'manager');
    raise exception 'FAIL 9: invited into another company';
  exception when others then
    if sqlerrm like '%not permitted%' then
      raise notice 'ok 9: you cannot invite somebody into a company you are not in';
    else raise; end if;
  end;

  -- 10. a bad address is refused when it is typed, not at send time
  v_res := public.invite_create(v_foct, 'not-an-address', 'staff');
  if not (v_res ->> 'ok')::boolean then
    raise notice 'ok 10: an invalid email is refused up front';
  else raise exception 'FAIL 10: invalid email accepted'; end if;

  -- 11. the invitation shows up on the people list
  v_res := public.org_people(v_foct);
  if exists (select 1 from jsonb_array_elements(v_res -> 'invites') i
              where i ->> 'email' = 'mate@example.com') then
    raise notice 'ok 11: a pending invitation is visible to the organisation';
  else raise exception 'FAIL 11: %', v_res -> 'invites'; end if;

  -- 12. SIGNING IN CLAIMS IT — no SQL, no dashboard
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', v_mate), true);
  v_res := public.claim_access();
  if (v_res ->> 'claimed')::int = 1 and (v_res ->> 'has_access')::boolean
     and exists (select 1 from public.organisation_memberships m
                  join public.roles r on r.id = m.role_id
                 where m.user_id = v_mate and m.org_id = v_foct and r.key = 'staff') then
    raise notice 'ok 12: signing in turns the invitation into the invited role';
  else raise exception 'FAIL 12: %', v_res; end if;

  -- 13. an invitation is SINGLE USE
  v_res := public.claim_access();
  if (v_res ->> 'claimed')::int = 0 then
    raise notice 'ok 13: an accepted invitation cannot be claimed twice';
  else raise exception 'FAIL 13: claimed again'; end if;

  -- 14. an EXPIRED invitation grants nothing
  declare v_late uuid := '44444444-0000-0000-0000-000000000004';
  begin
    insert into auth.users (id, email) values (v_late, 'late@example.com')
    on conflict (id) do nothing;
    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', c_priya), true);
    perform public.invite_create(v_foct, 'late@example.com', 'staff');
    update public.org_invites set expires_at = now() - interval '1 day'
     where lower(email) = 'late@example.com' and accepted_at is null;

    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', v_late), true);
    v_res := public.claim_access();
    if (v_res ->> 'claimed')::int = 0 and not (v_res ->> 'has_access')::boolean then
      raise notice 'ok 14: an expired invitation grants nothing';
    else raise exception 'FAIL 14: %', v_res; end if;
  end;

  -- 15. a REVOKED invitation grants nothing either
  declare v_gone uuid := '44444444-0000-0000-0000-000000000005';
  begin
    insert into auth.users (id, email) values (v_gone, 'gone@example.com')
    on conflict (id) do nothing;
    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', c_priya), true);
    v_invite := (public.invite_create(v_foct, 'gone@example.com', 'staff') ->> 'invite_id')::uuid;
    perform public.invite_revoke(v_invite);

    perform set_config('request.jwt.claims',
      format('{"sub":"%s","role":"authenticated"}', v_gone), true);
    v_res := public.claim_access();
    if (v_res ->> 'claimed')::int = 0 and not (v_res ->> 'has_access')::boolean then
      raise notice 'ok 15: a revoked invitation grants nothing';
    else raise exception 'FAIL 15: %', v_res; end if;
  end;
end $$;
