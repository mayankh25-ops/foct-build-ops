-- 0006 — Stage 2 phase 1: session profile RPC.
-- One SECURITY DEFINER call the app makes after sign-in to learn who the
-- user is: their profile row, active org memberships (org + role), and the
-- buildings those orgs service. Definer bypasses RLS but exposes ONLY the
-- caller's own rows (auth.uid()); returns null when unauthenticated.
-- Idempotent: safe to re-run.

create or replace function public.current_profile()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'user', (
      select jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
      from public.users u where u.id = auth.uid()
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'org_id',   o.id,
        'org_name', o.name,
        'org_slug', o.slug,
        'org_type', ot.key,
        'role',     r.key,
        'role_name', r.name
      ) order by o.name)
      from public.organisation_memberships m
      join public.organisations o      on o.id = m.org_id
      join public.organisation_types ot on ot.id = o.type_id
      join public.roles r              on r.id = m.role_id
      where m.user_id = auth.uid() and m.active
    ), '[]'::jsonb),
    'buildings', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id', b.id, 'name', b.name, 'slug', b.slug
      ))
      from public.building_organisations bo
      join public.buildings b on b.id = bo.building_id
      where bo.org_id in (
        select m.org_id from public.organisation_memberships m
        where m.user_id = auth.uid() and m.active
      ) and bo.active
    ), '[]'::jsonb)
  ) end
$$;

revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;
