-- =============================================================================
-- seed_service_desk.sql — Service Desk reference data for Aurora on Collins.
-- Idempotent. Runs as postgres/service_role.
-- =============================================================================

-- global default category set (org-admin configurable per site later)
insert into public.sd_categories (org_id, building_id, label, sort_order)
select null, null, v.label, v.ord
from (values
  ('Spillage', 10), ('Dirty area', 20), ('Rubbish overflow', 30),
  ('Toilet issue', 40), ('Glass/window', 50), ('Graffiti', 60),
  ('Odour', 70), ('Carpet stain', 80), ('Lift interior', 90), ('Other', 999)
) v(label, ord)
where not exists (select 1 from public.sd_categories c where c.label = v.label and c.org_id is null);

-- site staff registry (drives name dropdowns + notification routing)
insert into public.sd_site_staff (building_id, org_id, name, role, email)
select b.id, o.id, v.name, v.role, v.email
from (values
  ('concierge-collective', 'Amelia Ng',    'concierge', 'amelia@concierge.demo'),
  ('concierge-collective', 'Oliver Reyes', 'concierge', 'oliver@concierge.demo'),
  ('foct-cleaning',        'Marcus Chen',  'cleaner',   'marcus@foct.demo'),
  ('foct-cleaning',        'Leila Haddad', 'cleaner',   'leila@foct.demo'),
  ('foct-cleaning',        'Tom Nguyen',   'cleaner',   'tom@foct.demo'),
  ('foct-cleaning',        'Sofia Marino', 'cleaner',   'sofia@foct.demo'),
  ('foct-cleaning',        'Priya Sharma', 'manager',   'priya@foct.demo')
) v(org_slug, name, role, email)
join public.organisations o on o.slug = v.org_slug
cross join public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (
    select 1 from public.sd_site_staff s
    where s.building_id = b.id and s.name = v.name and s.org_id = o.id
  );

-- SLA defaults for FOCT Cleaning (owner to confirm; PRD open question 2)
insert into public.sd_sla_policies (org_id, priority, respond_minutes, resolve_minutes)
select o.id, v.p, v.respond, v.resolve
from (values
  ('urgent', 15, 120), ('high', 45, 240), ('normal', 120, 480), ('low', 240, 1440)
) v(p, respond, resolve)
join public.organisations o on o.slug = 'foct-cleaning'
on conflict (org_id, priority) do nothing;

-- demo intake token for the Aurora QR/link (rotate via the dashboard later)
insert into public.sd_intake_tokens (building_id, token)
select b.id, 'aurora-demo-intake-7f2k'
from public.buildings b
where b.slug = 'aurora-on-collins'
  and not exists (select 1 from public.sd_intake_tokens t where t.token = 'aurora-demo-intake-7f2k');
