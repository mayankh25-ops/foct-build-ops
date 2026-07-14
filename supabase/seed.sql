-- =============================================================================
-- seed.sql — Aurora on Collins demo dataset (CLAUDE.md → Demo dataset)
-- Idempotent: safe to re-run. Runs as postgres/service_role (bypasses RLS).
-- Demo passwords are NOT set here — users sign in via magic link, or set
-- passwords in the dashboard. auth.users rows are created minimally so the
-- public.users profiles + memberships can exist for RLS testing.
-- =============================================================================

-- ---- reference data ---------------------------------------------------------
insert into public.organisation_types (key, name) values
  ('owner_strata', 'Building owner / strata'),
  ('cleaning', 'Cleaning company'),
  ('concierge_bm', 'Concierge / building management'),
  ('subcontractor', 'Subcontractor')
on conflict (key) do nothing;

insert into public.roles (key, name) values
  ('super_admin', 'Super admin'),
  ('org_admin', 'Organisation admin'),
  ('manager', 'Manager / supervisor'),
  ('staff', 'Staff'),
  ('viewer', 'Client viewer (read-only)')
on conflict (key) do nothing;

insert into public.modules (key, name, description) values
  ('cleaning_ops', 'CleaningOps', 'Sign-in/out, rosters, timesheets, consumables, tasks, audits'),
  ('service_desk', 'Service Desk', 'Ticketing with photo proof, followers, SLA'),
  ('tasks_incidents', 'Tasks & incidents', 'Assignable tasks for cleaners and concierge'),
  ('calendar', 'Calendar', 'Building calendar'),
  ('site_audits', 'Site audits', 'Scored site audit forms'),
  ('concierge_desk', 'Concierge desk', 'Front-of-house log and handover'),
  ('parcels', 'Parcels', 'Parcel intake and collection'),
  ('resident_requests', 'Resident requests', 'Resident maintenance and amenity requests'),
  ('contractors', 'Contractors', 'Inductions, insurance, arrivals'),
  ('floor_plans', 'Floor plans', 'Interactive levels with zones and assets'),
  ('automation', 'Automation', 'People counting, lifts, robots, cameras, BMS')
on conflict (key) do nothing;

-- ---- organisations ----------------------------------------------------------
insert into public.organisations (id, type_id, name, slug)
select v.id::uuid, t.id, v.name, v.slug
from (values
  ('11111111-0000-0000-0000-000000000001', 'owner_strata',  'Meridian Strata Group', 'meridian-strata'),
  ('11111111-0000-0000-0000-000000000002', 'cleaning',      'FOCT Cleaning',         'foct-cleaning'),
  ('11111111-0000-0000-0000-000000000003', 'concierge_bm',  'Concierge Collective',  'concierge-collective'),
  ('11111111-0000-0000-0000-000000000004', 'subcontractor', 'BrightSpark Electrical','brightspark-electrical'),
  -- rival org NOT linked to Aurora — exists purely to prove isolation
  ('11111111-0000-0000-0000-000000000005', 'cleaning',      'Rival Cleaning Pty',    'rival-cleaning')
) as v(id, type_key, name, slug)
join public.organisation_types t on t.key = v.type_key
on conflict (slug) do nothing;

-- ---- users (auth stub + profile + membership) --------------------------------
-- CLAUDE.md cast: 1 super admin, 1 strata manager, 1 cleaning manager,
-- 3 cleaners, 1 concierge, 1 subcontractor admin (+1 extra concierge, +1 rival).
create or replace function pg_temp.seed_user(
  uid uuid, uname text, uemail text, org_slug text, role_key text
) returns void language plpgsql as $$
begin
  insert into auth.users (id, email) values (uid, uemail)
  on conflict (id) do nothing;
  insert into public.users (id, name, email) values (uid, uname, uemail)
  on conflict (id) do nothing;
  insert into public.organisation_memberships (org_id, user_id, role_id)
  select o.id, uid, r.id
  from public.organisations o, public.roles r
  where o.slug = org_slug and r.key = role_key
  on conflict (org_id, user_id) do nothing;
end $$;

select pg_temp.seed_user('22222222-0000-0000-0000-000000000001', 'FOCT Super Admin', 'admin@foct.demo',            'foct-cleaning',          'super_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000002', 'Sandra Wells',     'sandra@meridian.demo',       'meridian-strata',        'org_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000003', 'Priya Sharma',     'priya@foct.demo',            'foct-cleaning',          'manager');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000004', 'Marcus Chen',      'marcus@foct.demo',           'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000005', 'Leila Haddad',     'leila@foct.demo',            'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000006', 'Tom Nguyen',       'tom@foct.demo',              'foct-cleaning',          'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000007', 'Amelia Ng',        'amelia@concierge.demo',      'concierge-collective',   'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000008', 'Oliver Reyes',     'oliver@concierge.demo',      'concierge-collective',   'staff');
select pg_temp.seed_user('22222222-0000-0000-0000-000000000009', 'Ben Sparks',       'ben@brightspark.demo',       'brightspark-electrical', 'org_admin');
select pg_temp.seed_user('22222222-0000-0000-0000-00000000000a', 'Rita Rival',       'rita@rival.demo',            'rival-cleaning',         'manager');

-- ---- building ----------------------------------------------------------------
insert into public.buildings (id, name, slug, address, levels, owner_org_id)
select
  '33333333-0000-0000-0000-000000000001',
  'Aurora on Collins',
  'aurora-on-collins',
  '525 Collins St, Melbourne VIC 3000',
  (
    select jsonb_agg(l) from (
      select unnest(array['B4','B3','B2','B1','GF']) as l
      union all
      select 'L' || g from generate_series(1, 40) g
    ) levels
  ),
  o.id
from public.organisations o where o.slug = 'meridian-strata'
on conflict (slug) do nothing;

insert into public.building_organisations (building_id, org_id, relationship)
select b.id, o.id, v.rel
from (values
  ('meridian-strata', 'owner'),
  ('foct-cleaning', 'cleaning'),
  ('concierge-collective', 'concierge_bm'),
  ('brightspark-electrical', 'subcontractor')
) v(slug, rel)
join public.organisations o on o.slug = v.slug
cross join public.buildings b
where b.slug = 'aurora-on-collins'
on conflict (building_id, org_id) do nothing;

-- staff working at Aurora
insert into public.building_memberships (building_id, org_id, user_id)
select b.id, m.org_id, m.user_id
from public.buildings b
join public.building_organisations bo on bo.building_id = b.id and bo.active
join public.organisation_memberships m on m.org_id = bo.org_id and m.active
where b.slug = 'aurora-on-collins'
on conflict (building_id, org_id, user_id) do nothing;

-- ---- module packaging (mirrors the app's Module access page) -----------------
insert into public.building_modules (building_id, module_id, status)
select b.id, m.id,
  case m.key
    when 'cleaning_ops' then 'enabled'
    when 'service_desk' then 'enabled'
    when 'concierge_desk' then 'disabled'
    when 'floor_plans' then 'pro'
    when 'automation' then 'pro'
    else 'coming_soon'
  end
from public.buildings b, public.modules m
where b.slug = 'aurora-on-collins'
on conflict (building_id, module_id) do nothing;

-- explicit cross-org grants (never implicit)
insert into public.organisation_module_access (org_id, building_id, module_id)
select o.id, b.id, m.id
from public.organisations o
join public.buildings b on b.slug = 'aurora-on-collins'
join public.modules m on m.key = any (
  case o.slug
    when 'foct-cleaning' then array['cleaning_ops','service_desk']
    when 'concierge-collective' then array['service_desk']
    else array[]::text[]
  end
)
where o.slug in ('foct-cleaning','concierge-collective')
on conflict (org_id, building_id, module_id) do nothing;

insert into public.service_contracts (building_id, provider_org_id, client_org_id, scope, starts_on, active)
select b.id, p.id, c.id, v.scope, current_date, true
from (values
  ('foct-cleaning', 'meridian-strata', 'Daily cleaning + service desk attendance'),
  ('concierge-collective', 'meridian-strata', 'Concierge and building management')
) v(provider, client, scope)
join public.organisations p on p.slug = v.provider
join public.organisations c on c.slug = v.client
cross join public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (
    select 1 from public.service_contracts sc
    where sc.building_id = b.id and sc.provider_org_id = p.id and sc.client_org_id = c.id
  );

-- ---- themes: built-in rows + Aurora's assignment (Nature = default) ----------
insert into public.themes (org_id, building_id, name, slug, is_builtin)
select null, null, v.name, v.slug, true
from (values
  ('Nature', 'option-nature'), ('Graphite', 'graphite'), ('Harbour', 'harbour'),
  ('Eucalypt', 'eucalypt'), ('Sandstone', 'sandstone'), ('Ink', 'ink'),
  ('Analytics', 'option-analytics'), ('Blush', 'option-blush'),
  ('Slate', 'option-slate'), ('Sunset', 'option-sunset')
) v(name, slug)
on conflict on constraint themes_slug_unique do nothing;

insert into public.building_theme_assignments (building_id, theme_id)
select b.id, t.id
from public.buildings b
join public.themes t on t.slug = 'option-nature' and t.is_builtin
where b.slug = 'aurora-on-collins'
on conflict (building_id) do update set theme_id = excluded.theme_id;

-- ---- integration catalogue (adapter pattern; credentials come via the GUI) ---
insert into public.integration_providers (category, brand, capabilities) values
  ('email', 'Resend',       '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'Postmark',     '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'SendGrid',     '["send","sendTemplate","verifyCredentials"]'),
  ('email', 'AWS SES',      '["send","verifyCredentials"]'),
  ('sms',   'Twilio',       '["send","verifyCredentials","deliveryStatus","whatsapp"]'),
  ('sms',   'MessageMedia', '["send","verifyCredentials","deliveryStatus"]'),
  ('sms',   'ClickSend',    '["send","verifyCredentials","deliveryStatus"]')
on conflict (category, brand) do nothing;
