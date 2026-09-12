-- =============================================================================
-- Undo supabase/tests/auth_onboarding_check.sql on a REAL project.
--
-- That suite invents five people to prove the front door works, and (before
-- the fix that added a teardown) left every one of them behind. On a live
-- project that matters twice over:
--
--   * 'owner@example.com' is left an ADMIN of the organisation running the
--     site, with membership of its buildings;
--   * claim_access() decides "has anybody ever signed in here?" by looking for
--     a non-null users.last_seen_at. The suite signs five people in, so the
--     one-time bootstrap is SPENT -- and the real first user then signs in to
--     nothing, which is the exact failure 0015 exists to prevent.
--
-- Running this puts both back. Idempotent -- safe to re-run.
-- =============================================================================
do $$
declare
  c_cast constant uuid[] := array[
    '44444444-0000-0000-0000-000000000001',   -- owner@example.com
    '44444444-0000-0000-0000-000000000002',   -- mate@example.com
    '44444444-0000-0000-0000-000000000003',   -- stranger@example.com
    '44444444-0000-0000-0000-000000000004',   -- late@example.com
    '44444444-0000-0000-0000-000000000005'    -- gone@example.com
  ]::uuid[];
  c_addresses constant text[] := array[
    'mate@example.com', 'sneaky@example.com', 'mole@example.com',
    'late@example.com', 'gone@example.com', 'not-an-address'
  ];
  v_n int;
begin
  -- invitations first: org_invites.accepted_by references public.users with no
  -- ON DELETE action, so it blocks the delete below
  delete from public.org_invites
   where invited_by = any(c_cast)
      or accepted_by = any(c_cast)
      or lower(email) = any(c_addresses);

  delete from public.building_memberships     where user_id = any(c_cast);
  delete from public.organisation_memberships where user_id = any(c_cast);
  delete from public.users                    where id      = any(c_cast);
  delete from auth.users                      where id      = any(c_cast);

  -- reopen the front door
  update public.users set last_seen_at = null;

  select count(*) into v_n from public.users where last_seen_at is not null;
  if v_n = 0 then
    raise notice 'ok: the test accounts are gone and the bootstrap is available again';
    raise notice '    -> the next person to sign in becomes an admin of the working org';
  else
    raise exception 'still % user(s) with last_seen_at set', v_n;
  end if;
end $$;
