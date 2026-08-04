-- =============================================================================
-- 0015 — Getting IN. Signing in should not require the SQL editor.
--
-- WHAT WAS WRONG
-- Creating a login meant three manual steps in the Supabase dashboard and a
-- hand-written INSERT for the profile row, the organisation membership and the
-- building membership. Miss any one of them and the app signs you in to
-- nothing — which is exactly what happened: an account was created, the
-- password was right, and the product still showed demo mode.
--
-- WHAT THIS DOES
--   1. `handle_new_auth_user` — a new account gets its `public.users` row by
--      itself. (A user row alone grants NOTHING; it is an identity, not access.)
--   2. `org_invites` — an admin invites an email address to a role. When that
--      person signs in, the invitation becomes their membership. No SQL.
--   3. `claim_access()` — called once after every sign-in. Ensures the profile
--      row exists, stamps last_seen_at, and converts any invitation waiting for
--      that address.
--   4. THE FIRST SIGN-IN CLAIMS THE PROJECT. On a project where nobody has ever
--      signed in, the first person to arrive becomes an admin of the
--      organisation that actually runs the site. After that the door is shut:
--      once anybody has signed in, an uninvited arrival gets nothing at all.
--
-- The rules that keep this from being a way in:
--   * an invitation is single-use, expires, and is revocable;
--   * you cannot invite somebody to an organisation you are not in;
--   * you cannot invite somebody to a role above your own — a manager cannot
--     mint a super admin;
--   * bootstrap fires exactly once, and only while the project has no history.
--
-- Idempotent — safe to re-run.
-- =============================================================================

alter table public.users add column if not exists last_seen_at timestamptz;

-- --------------------------------------------------------------- invites ----
create table if not exists public.org_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  -- optional: also put them on this building when they arrive
  building_id uuid references public.buildings(id) on delete cascade,
  role_id     uuid not null references public.roles(id),
  email       text not null,
  invited_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.users(id),
  revoked_at  timestamptz
);
-- one live invitation per address per organisation; re-inviting replaces
create unique index if not exists org_invites_pending
  on public.org_invites (org_id, lower(email))
  where accepted_at is null and revoked_at is null;

alter table public.org_invites enable row level security;
do $$ begin
  drop policy if exists invites_read on public.org_invites;
  create policy invites_read on public.org_invites for select to authenticated
    using (app.in_org(org_id));
  drop policy if exists invites_write on public.org_invites;
  create policy invites_write on public.org_invites for all to authenticated
    using (app.in_org(org_id)) with check (app.in_org(org_id));
end $$;


-- ------------------------------------------------- a new account gets a row --
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
             nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(coalesce(new.email, ''), '@', 1)),
    new.email)
  on conflict (id) do nothing;
  return new;
end $$;

-- On a locked-down project the trigger may not be creatable; `claim_access()`
-- creates the same row on first sign-in, so this is a convenience, not a
-- dependency. Failing to install it must not fail the migration.
do $$ begin
  if to_regclass('auth.users') is not null then
    begin
      drop trigger if exists on_auth_user_created on auth.users;
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_auth_user();
    exception when insufficient_privilege or others then
      raise notice '0015: could not attach the auth.users trigger (%) — claim_access() covers it', sqlerrm;
    end;
  end if;
end $$;


-- ------------------------------------------------------- invite: create ------
-- Rank roles so nobody can invite somebody above themselves.
create or replace function app.role_rank(p_key text) returns int
language sql immutable as $$
  select case p_key
           when 'super_admin' then 4
           when 'org_admin'   then 3
           when 'manager'     then 2
           else 1                       -- staff, and anything unknown
         end
$$;

create or replace function public.invite_create(
  p_org uuid, p_email text, p_role_key text, p_building uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_role uuid; v_caller_rank int; v_id uuid; v_email text;
begin
  if not app.in_org(p_org) then raise exception 'not permitted'; end if;
  v_email := lower(trim(coalesce(p_email, '')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'That is not a valid email address.');
  end if;

  select id into v_role from public.roles where key = p_role_key;
  if v_role is null then
    return jsonb_build_object('ok', false, 'error', 'Unknown role.');
  end if;

  -- your own rank in THIS organisation, so a manager elsewhere gains nothing
  select coalesce(max(app.role_rank(r.key)), 0) into v_caller_rank
    from public.organisation_memberships m
    join public.roles r on r.id = m.role_id
   where m.user_id = auth.uid() and m.active and m.org_id = p_org;
  if app.is_super_admin() then v_caller_rank := 4; end if;

  if v_caller_rank < 2 then
    return jsonb_build_object('ok', false,
      'error', 'Only a manager or an admin can invite people.');
  end if;
  if app.role_rank(p_role_key) > v_caller_rank then
    return jsonb_build_object('ok', false,
      'error', 'You cannot invite somebody to a role above your own.');
  end if;

  -- re-inviting the same address replaces the pending invitation rather than
  -- leaving two of them to race
  update public.org_invites
     set revoked_at = now()
   where org_id = p_org and lower(email) = v_email
     and accepted_at is null and revoked_at is null;

  insert into public.org_invites (org_id, building_id, role_id, email, invited_by)
  values (p_org, p_building, v_role, v_email, auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'invite_id', v_id, 'email', v_email);
end $$;
revoke all on function public.invite_create(uuid, text, text, uuid) from public;
grant execute on function public.invite_create(uuid, text, text, uuid) to authenticated;


create or replace function public.invite_revoke(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare v_org uuid;
begin
  select org_id into v_org from public.org_invites where id = p_id;
  if v_org is null then return jsonb_build_object('ok', true, 'already_gone', true); end if;
  if not app.in_org(v_org) then raise exception 'not permitted'; end if;
  update public.org_invites set revoked_at = now() where id = p_id and accepted_at is null;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.invite_revoke(uuid) from public;
grant execute on function public.invite_revoke(uuid) to authenticated;


-- Who is in this organisation, and who has been invited but not arrived.
create or replace function public.org_people(p_org uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v_members jsonb; v_invites jsonb;
begin
  if not app.in_org(p_org) then raise exception 'not permitted'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.id, 'name', u.name, 'email', u.email,
           'role', r.key, 'role_name', r.name,
           'last_seen_at', u.last_seen_at,
           'never_signed_in', u.last_seen_at is null
         ) order by u.name), '[]'::jsonb)
    into v_members
    from public.organisation_memberships m
    join public.users u on u.id = m.user_id
    join public.roles r on r.id = m.role_id
   where m.org_id = p_org and m.active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'email', i.email, 'role', r.key, 'role_name', r.name,
           'created_at', i.created_at, 'expires_at', i.expires_at,
           'expired', i.expires_at < now()
         ) order by i.created_at desc), '[]'::jsonb)
    into v_invites
    from public.org_invites i
    join public.roles r on r.id = i.role_id
   where i.org_id = p_org and i.accepted_at is null and i.revoked_at is null;

  return jsonb_build_object('ok', true, 'members', v_members, 'invites', v_invites);
end $$;
revoke all on function public.org_people(uuid) from public;
grant execute on function public.org_people(uuid) to authenticated;


-- ========================================================== claim_access =====
-- Called once after every sign-in. Everything it does is for the CALLER: it
-- cannot be used to grant access to anybody else.
create or replace function public.claim_access()
returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text;
  v_claimed int := 0; v_bootstrapped boolean := false;
  v_org uuid; v_role uuid; i record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not signed in');
  end if;

  select lower(u.email), u.raw_user_meta_data ->> 'name'
    into v_email, v_name
    from auth.users u where u.id = v_uid;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'account has no email');
  end if;

  -- 1. the profile row, in case the trigger is not installed
  insert into public.users (id, name, email)
  values (v_uid, coalesce(nullif(trim(v_name), ''), split_part(v_email, '@', 1)), v_email)
  on conflict (id) do nothing;

  -- 2. accept every invitation waiting for this address
  for i in
    select * from public.org_invites
     where lower(email) = v_email
       and accepted_at is null and revoked_at is null and expires_at > now()
  loop
    insert into public.organisation_memberships (org_id, user_id, role_id)
    values (i.org_id, v_uid, i.role_id)
    on conflict (org_id, user_id) do nothing;

    if i.building_id is not null then
      insert into public.building_memberships (building_id, org_id, user_id)
      values (i.building_id, i.org_id, v_uid)
      on conflict do nothing;
    else
      -- otherwise every building that organisation already services
      insert into public.building_memberships (building_id, org_id, user_id)
      select bo.building_id, i.org_id, v_uid
        from public.building_organisations bo
       where bo.org_id = i.org_id and bo.active
      on conflict do nothing;
    end if;

    update public.org_invites
       set accepted_at = now(), accepted_by = v_uid where id = i.id;
    v_claimed := v_claimed + 1;
  end loop;

  -- 3. THE FIRST SIGN-IN CLAIMS THE PROJECT — and only the first.
  if v_claimed = 0
     and not exists (select 1 from public.organisation_memberships
                      where user_id = v_uid and active)
     and not exists (select 1 from public.users
                      where last_seen_at is not null and id <> v_uid)
  then
    -- the organisation that actually runs a site here, else the oldest one
    select org_id into v_org from (
      select s.org_id, count(*) as n
        from public.staff s where s.active group by s.org_id
       order by n desc limit 1) t;
    if v_org is null then
      select id into v_org from public.organisations order by created_at limit 1;
    end if;

    if v_org is not null then
      select id into v_role from public.roles where key = 'org_admin';
      insert into public.organisation_memberships (org_id, user_id, role_id)
      values (v_org, v_uid, v_role)
      on conflict (org_id, user_id) do nothing;
      insert into public.building_memberships (building_id, org_id, user_id)
      select bo.building_id, v_org, v_uid
        from public.building_organisations bo where bo.org_id = v_org and bo.active
      on conflict do nothing;
      v_bootstrapped := true;
    end if;
  end if;

  -- 4. stamped LAST: the bootstrap test above reads this column, so writing it
  --    earlier would lock the very first person out of their own project.
  update public.users set last_seen_at = now() where id = v_uid;

  return jsonb_build_object('ok', true,
    'claimed', v_claimed, 'bootstrapped', v_bootstrapped,
    'has_access', exists (select 1 from public.organisation_memberships
                           where user_id = v_uid and active));
end $$;
revoke all on function public.claim_access() from public;
grant execute on function public.claim_access() to authenticated;
