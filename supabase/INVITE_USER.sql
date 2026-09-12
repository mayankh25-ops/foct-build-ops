-- =============================================================================
-- Invite somebody by EMAIL, from the SQL editor.
--
-- Edit the four values below, paste the whole file into the Supabase SQL
-- editor, Run. Then that person goes to /sign-in, types the same address, and
-- clicks "Email me a sign-in link" -- claim_access() turns this invitation
-- into their membership the moment they arrive. No password, ever.
--
-- (In the app this is Settings -> People. This file is for before you have a
-- login of your own, or for scripting one.)
--
-- Roles, lowest to highest: 'staff', 'manager', 'org_admin', 'super_admin'.
-- Idempotent -- re-running replaces any pending invitation for the address.
-- =============================================================================
do $$
declare
  c_email    constant text := 'someone@theircompany.com';  -- <- who
  c_org      constant text := 'foct-cleaning';             -- <- organisations.slug
  c_role     constant text := 'org_admin';                 -- <- see the list above
  c_building constant text := 'aurora-on-collins';         -- <- buildings.slug, or null
  v_org uuid; v_role uuid; v_building uuid; v_email text;
begin
  v_email := lower(trim(c_email));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception '% is not a valid email address', c_email;
  end if;

  select id into v_org from public.organisations where slug = c_org;
  if v_org is null then
    raise exception 'No organisation with slug %. Try: select slug, name from public.organisations;', c_org;
  end if;

  select id into v_role from public.roles where key = c_role;
  if v_role is null then
    raise exception 'No role %. Try: select key, name from public.roles;', c_role;
  end if;

  if c_building is not null then
    select id into v_building from public.buildings where slug = c_building;
    if v_building is null then
      raise exception 'No building with slug %. Try: select slug, name from public.buildings;', c_building;
    end if;
  end if;

  -- one live invitation per address per org; re-inviting replaces
  update public.org_invites set revoked_at = now()
   where org_id = v_org and lower(email) = v_email
     and accepted_at is null and revoked_at is null;

  insert into public.org_invites (org_id, building_id, role_id, email, expires_at)
  values (v_org, v_building, v_role, v_email, now() + interval '14 days');

  raise notice 'ok: % invited to % as %', v_email, c_org, c_role;
  raise notice '    -> they sign in at /sign-in with a magic link. Expires in 14 days.';
end $$;
