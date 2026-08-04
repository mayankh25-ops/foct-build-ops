-- =============================================================================
-- REPAIR_SCHEMA.sql — GENERATED. Brings an OLDER project up to the current shape.
--
-- WHY THIS EXISTS: `create table if not exists` does nothing to a table that
-- already exists, including one created by an older version of these
-- migrations. The bundle then applies without error and the app fails at
-- runtime with `column buildings.slug does not exist` (or similar).
--
-- This adds every column the current code expects, and only the ones that are
-- missing. It NEVER drops or rewrites anything: existing columns, data and
-- constraints are untouched.
--
-- HOW TO USE (safe to re-run, and safe on an up-to-date project — it is a
-- no-op there):
--   1. paste this file    → Run
--   2. paste APPLY_EVERYTHING.sql → Run
--   3. reload the app
--
-- Regenerate with: npm run build:repair
-- =============================================================================

-- ---- attendance_adjustments --------------------------------------------
do $$ begin
  if to_regclass('public.attendance_adjustments') is null then
    raise notice 'repair: public.attendance_adjustments does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists session_event_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.session_event_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists delta_minutes int;
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.delta_minutes — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists note text default '';
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.note — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists created_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.created_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_adjustments') is not null then
    alter table public.attendance_adjustments add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_adjustments.updated_at — %', sqlerrm;
end $$;

-- ---- attendance_alert_settings -----------------------------------------
do $$ begin
  if to_regclass('public.attendance_alert_settings') is null then
    raise notice 'repair: public.attendance_alert_settings does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists enabled boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.enabled — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists grace_min int default 15;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.grace_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists overdue_after_min int default 60;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.overdue_after_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists raise_overdue boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.raise_overdue — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists notify_emails text[] default '{}';
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.notify_emails — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists updated_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.updated_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alert_settings') is not null then
    alter table public.attendance_alert_settings add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_alert_settings.updated_at — %', sqlerrm;
end $$;

-- ---- attendance_alerts -------------------------------------------------
do $$ begin
  if to_regclass('public.attendance_alerts') is null then
    raise notice 'repair: public.attendance_alerts does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists shift_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.shift_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists kind text;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.kind — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists work_date date;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.work_date — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists due_min int;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.due_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists raised_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.raised_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists resolved_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.resolved_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists resolution text;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.resolution — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists note text default '';
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.note — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists acknowledged_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.acknowledged_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists notified_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.notified_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_alerts') is not null then
    alter table public.attendance_alerts add column if not exists notify_error text;
  end if;
exception when others then
  raise notice 'repair: public.attendance_alerts.notify_error — %', sqlerrm;
end $$;

-- ---- attendance_events -------------------------------------------------
do $$ begin
  if to_regclass('public.attendance_events') is null then
    raise notice 'repair: public.attendance_events does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists kind text;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.kind — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists source text default 'kiosk';
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.source — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists device_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.device_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists selfie_path text;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.selfie_path — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists client_event_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.client_event_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists recorded_offline boolean default false;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.recorded_offline — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.attendance_events') is not null then
    alter table public.attendance_events add column if not exists device_time timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.attendance_events.device_time — %', sqlerrm;
end $$;

-- ---- audit_logs --------------------------------------------------------
do $$ begin
  if to_regclass('public.audit_logs') is null then
    raise notice 'repair: public.audit_logs does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists actor_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.actor_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists action text;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.action — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists entity text;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.entity — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists entity_id text;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.entity_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists payload jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.payload — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.audit_logs') is not null then
    alter table public.audit_logs add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.audit_logs.created_at — %', sqlerrm;
end $$;

-- ---- building_memberships ----------------------------------------------
do $$ begin
  if to_regclass('public.building_memberships') is null then
    raise notice 'repair: public.building_memberships does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.building_memberships') is not null then
    alter table public.building_memberships add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.building_memberships.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_memberships') is not null then
    alter table public.building_memberships add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_memberships.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_memberships') is not null then
    alter table public.building_memberships add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_memberships.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_memberships') is not null then
    alter table public.building_memberships add column if not exists user_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_memberships.user_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_memberships') is not null then
    alter table public.building_memberships add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.building_memberships.active — %', sqlerrm;
end $$;

-- ---- building_modules --------------------------------------------------
do $$ begin
  if to_regclass('public.building_modules') is null then
    raise notice 'repair: public.building_modules does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.building_modules') is not null then
    alter table public.building_modules add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_modules.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_modules') is not null then
    alter table public.building_modules add column if not exists module_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_modules.module_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_modules') is not null then
    alter table public.building_modules add column if not exists status text default 'disabled';
  end if;
exception when others then
  raise notice 'repair: public.building_modules.status — %', sqlerrm;
end $$;

-- ---- building_organisations --------------------------------------------
do $$ begin
  if to_regclass('public.building_organisations') is null then
    raise notice 'repair: public.building_organisations does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.building_organisations') is not null then
    alter table public.building_organisations add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.building_organisations.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_organisations') is not null then
    alter table public.building_organisations add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_organisations.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_organisations') is not null then
    alter table public.building_organisations add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_organisations.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_organisations') is not null then
    alter table public.building_organisations add column if not exists relationship text;
  end if;
exception when others then
  raise notice 'repair: public.building_organisations.relationship — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_organisations') is not null then
    alter table public.building_organisations add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.building_organisations.active — %', sqlerrm;
end $$;

-- ---- building_theme_assignments ----------------------------------------
do $$ begin
  if to_regclass('public.building_theme_assignments') is null then
    raise notice 'repair: public.building_theme_assignments does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.building_theme_assignments') is not null then
    alter table public.building_theme_assignments add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_theme_assignments.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_theme_assignments') is not null then
    alter table public.building_theme_assignments add column if not exists theme_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_theme_assignments.theme_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_theme_assignments') is not null then
    alter table public.building_theme_assignments add column if not exists fonts jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.building_theme_assignments.fonts — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_theme_assignments') is not null then
    alter table public.building_theme_assignments add column if not exists assigned_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.building_theme_assignments.assigned_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.building_theme_assignments') is not null then
    alter table public.building_theme_assignments add column if not exists assigned_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.building_theme_assignments.assigned_at — %', sqlerrm;
end $$;

-- ---- buildings ---------------------------------------------------------
do $$ begin
  if to_regclass('public.buildings') is null then
    raise notice 'repair: public.buildings does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.buildings.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.buildings.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists slug text;
  end if;
exception when others then
  raise notice 'repair: public.buildings.slug — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists address text default '';
  end if;
exception when others then
  raise notice 'repair: public.buildings.address — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists levels jsonb default '[]'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.buildings.levels — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists owner_org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.buildings.owner_org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.buildings.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists timezone text default 'Australia/Melbourne';
  end if;
exception when others then
  raise notice 'repair: public.buildings.timezone — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.buildings') is not null then
    alter table public.buildings add column if not exists default_language text default 'en';
  end if;
exception when others then
  raise notice 'repair: public.buildings.default_language — %', sqlerrm;
end $$;

-- ---- handover_notes ----------------------------------------------------
do $$ begin
  if to_regclass('public.handover_notes') is null then
    raise notice 'repair: public.handover_notes does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists author_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.author_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists body text;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.body — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists kind text default 'info';
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.kind — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists created_at timestamptz default clock_timestamp();
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists deleted_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.deleted_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.handover_notes') is not null then
    alter table public.handover_notes add column if not exists deleted_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.handover_notes.deleted_by — %', sqlerrm;
end $$;

-- ---- integration_credentials -------------------------------------------
do $$ begin
  if to_regclass('public.integration_credentials') is null then
    raise notice 'repair: public.integration_credentials does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists provider_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.provider_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists label text;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.label — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists secret_ref text;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.secret_ref — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists masked text default '';
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.masked — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists created_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.created_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_credentials') is not null then
    alter table public.integration_credentials add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.integration_credentials.created_at — %', sqlerrm;
end $$;

-- ---- integration_providers ---------------------------------------------
do $$ begin
  if to_regclass('public.integration_providers') is null then
    raise notice 'repair: public.integration_providers does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists category text;
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.category — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists brand text;
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.brand — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists capabilities jsonb default '[]'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.capabilities — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists config_schema jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.config_schema — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.integration_providers') is not null then
    alter table public.integration_providers add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.integration_providers.active — %', sqlerrm;
end $$;

-- ---- kiosk_devices -----------------------------------------------------
do $$ begin
  if to_regclass('public.kiosk_devices') is null then
    raise notice 'repair: public.kiosk_devices does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists label text;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.label — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists pair_code text;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.pair_code — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists pair_expires timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.pair_expires — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists device_token uuid;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.device_token — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists paired_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.paired_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists last_seen timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.last_seen — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.kiosk_devices') is not null then
    alter table public.kiosk_devices add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.kiosk_devices.created_at — %', sqlerrm;
end $$;

-- ---- modules -----------------------------------------------------------
do $$ begin
  if to_regclass('public.modules') is null then
    raise notice 'repair: public.modules does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.modules') is not null then
    alter table public.modules add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.modules.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.modules') is not null then
    alter table public.modules add column if not exists key text;
  end if;
exception when others then
  raise notice 'repair: public.modules.key — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.modules') is not null then
    alter table public.modules add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.modules.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.modules') is not null then
    alter table public.modules add column if not exists description text default '';
  end if;
exception when others then
  raise notice 'repair: public.modules.description — %', sqlerrm;
end $$;

-- ---- notice_acks -------------------------------------------------------
do $$ begin
  if to_regclass('public.notice_acks') is null then
    raise notice 'repair: public.notice_acks does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists notice_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.notice_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists notice_version int default 1;
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.notice_version — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists acked_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.acked_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notice_acks') is not null then
    alter table public.notice_acks add column if not exists device_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notice_acks.device_id — %', sqlerrm;
end $$;

-- ---- notices -----------------------------------------------------------
do $$ begin
  if to_regclass('public.notices') is null then
    raise notice 'repair: public.notices does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.notices.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notices.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notices.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notices.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists title jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.notices.title — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists body jsonb;
  end if;
exception when others then
  raise notice 'repair: public.notices.body — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists priority text default 'info';
  end if;
exception when others then
  raise notice 'repair: public.notices.priority — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists starts_on date default current_date;
  end if;
exception when others then
  raise notice 'repair: public.notices.starts_on — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists ends_on date;
  end if;
exception when others then
  raise notice 'repair: public.notices.ends_on — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists start_min int;
  end if;
exception when others then
  raise notice 'repair: public.notices.start_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists end_min int;
  end if;
exception when others then
  raise notice 'repair: public.notices.end_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists requires_ack boolean default false;
  end if;
exception when others then
  raise notice 'repair: public.notices.requires_ack — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists version int default 1;
  end if;
exception when others then
  raise notice 'repair: public.notices.version — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.notices.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists created_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.notices.created_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.notices.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notices') is not null then
    alter table public.notices add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.notices.updated_at — %', sqlerrm;
end $$;

-- ---- notification_log --------------------------------------------------
do $$ begin
  if to_regclass('public.notification_log') is null then
    raise notice 'repair: public.notification_log does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.notification_log.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists channel text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.channel — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists provider_brand text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.provider_brand — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists credential_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.credential_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists recipient text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.recipient — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists subject text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.subject — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists status text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.status — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists is_test boolean default false;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.is_test — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists provider_message_id text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.provider_message_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists error text;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.error — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists created_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.notification_log.created_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.notification_log') is not null then
    alter table public.notification_log add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.notification_log.created_at — %', sqlerrm;
end $$;

-- ---- org_invites -------------------------------------------------------
do $$ begin
  if to_regclass('public.org_invites') is null then
    raise notice 'repair: public.org_invites does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.org_invites.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists role_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.role_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists email text;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.email — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists invited_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.invited_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.org_invites.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists expires_at timestamptz default now() + interval '14 days';
  end if;
exception when others then
  raise notice 'repair: public.org_invites.expires_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists accepted_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.accepted_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists accepted_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.accepted_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.org_invites') is not null then
    alter table public.org_invites add column if not exists revoked_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.org_invites.revoked_at — %', sqlerrm;
end $$;

-- ---- organisation_memberships ------------------------------------------
do $$ begin
  if to_regclass('public.organisation_memberships') is null then
    raise notice 'repair: public.organisation_memberships does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.organisation_memberships') is not null then
    alter table public.organisation_memberships add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.organisation_memberships.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_memberships') is not null then
    alter table public.organisation_memberships add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_memberships.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_memberships') is not null then
    alter table public.organisation_memberships add column if not exists user_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_memberships.user_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_memberships') is not null then
    alter table public.organisation_memberships add column if not exists role_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_memberships.role_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_memberships') is not null then
    alter table public.organisation_memberships add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.organisation_memberships.active — %', sqlerrm;
end $$;

-- ---- organisation_module_access ----------------------------------------
do $$ begin
  if to_regclass('public.organisation_module_access') is null then
    raise notice 'repair: public.organisation_module_access does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists module_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.module_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists granted_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.granted_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_module_access') is not null then
    alter table public.organisation_module_access add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.organisation_module_access.created_at — %', sqlerrm;
end $$;

-- ---- organisation_types ------------------------------------------------
do $$ begin
  if to_regclass('public.organisation_types') is null then
    raise notice 'repair: public.organisation_types does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.organisation_types') is not null then
    alter table public.organisation_types add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.organisation_types.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_types') is not null then
    alter table public.organisation_types add column if not exists key text;
  end if;
exception when others then
  raise notice 'repair: public.organisation_types.key — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisation_types') is not null then
    alter table public.organisation_types add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.organisation_types.name — %', sqlerrm;
end $$;

-- ---- organisations -----------------------------------------------------
do $$ begin
  if to_regclass('public.organisations') is null then
    raise notice 'repair: public.organisations does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table public.organisations add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.organisations.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table public.organisations add column if not exists type_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.organisations.type_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table public.organisations add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.organisations.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table public.organisations add column if not exists slug text;
  end if;
exception when others then
  raise notice 'repair: public.organisations.slug — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.organisations') is not null then
    alter table public.organisations add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.organisations.created_at — %', sqlerrm;
end $$;

-- ---- permissions -------------------------------------------------------
do $$ begin
  if to_regclass('public.permissions') is null then
    raise notice 'repair: public.permissions does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.permissions') is not null then
    alter table public.permissions add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.permissions.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.permissions') is not null then
    alter table public.permissions add column if not exists key text;
  end if;
exception when others then
  raise notice 'repair: public.permissions.key — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.permissions') is not null then
    alter table public.permissions add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.permissions.name — %', sqlerrm;
end $$;

-- ---- role_permissions --------------------------------------------------
do $$ begin
  if to_regclass('public.role_permissions') is null then
    raise notice 'repair: public.role_permissions does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.role_permissions') is not null then
    alter table public.role_permissions add column if not exists role_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.role_permissions.role_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.role_permissions') is not null then
    alter table public.role_permissions add column if not exists permission_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.role_permissions.permission_id — %', sqlerrm;
end $$;

-- ---- roles -------------------------------------------------------------
do $$ begin
  if to_regclass('public.roles') is null then
    raise notice 'repair: public.roles does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.roles') is not null then
    alter table public.roles add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.roles.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roles') is not null then
    alter table public.roles add column if not exists key text;
  end if;
exception when others then
  raise notice 'repair: public.roles.key — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roles') is not null then
    alter table public.roles add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.roles.name — %', sqlerrm;
end $$;

-- ---- roster_shifts -----------------------------------------------------
do $$ begin
  if to_regclass('public.roster_shifts') is null then
    raise notice 'repair: public.roster_shifts does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists work_date date;
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.work_date — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists start_min int;
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.start_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists end_min int;
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.end_min — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists zone text default '';
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.zone — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.roster_shifts') is not null then
    alter table public.roster_shifts add column if not exists note text default '';
  end if;
exception when others then
  raise notice 'repair: public.roster_shifts.note — %', sqlerrm;
end $$;

-- ---- sd_categories -----------------------------------------------------
do $$ begin
  if to_regclass('public.sd_categories') is null then
    raise notice 'repair: public.sd_categories does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists label text;
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.label — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists sort_order int default 100;
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.sort_order — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_categories') is not null then
    alter table public.sd_categories add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.sd_categories.active — %', sqlerrm;
end $$;

-- ---- sd_intake_tokens --------------------------------------------------
do $$ begin
  if to_regclass('public.sd_intake_tokens') is null then
    raise notice 'repair: public.sd_intake_tokens does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_intake_tokens') is not null then
    alter table public.sd_intake_tokens add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_intake_tokens.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_intake_tokens') is not null then
    alter table public.sd_intake_tokens add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_intake_tokens.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_intake_tokens') is not null then
    alter table public.sd_intake_tokens add column if not exists token text;
  end if;
exception when others then
  raise notice 'repair: public.sd_intake_tokens.token — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_intake_tokens') is not null then
    alter table public.sd_intake_tokens add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.sd_intake_tokens.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_intake_tokens') is not null then
    alter table public.sd_intake_tokens add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_intake_tokens.created_at — %', sqlerrm;
end $$;

-- ---- sd_ref_counters ---------------------------------------------------
do $$ begin
  if to_regclass('public.sd_ref_counters') is null then
    raise notice 'repair: public.sd_ref_counters does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_ref_counters') is not null then
    alter table public.sd_ref_counters add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_ref_counters.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ref_counters') is not null then
    alter table public.sd_ref_counters add column if not exists yymm text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ref_counters.yymm — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ref_counters') is not null then
    alter table public.sd_ref_counters add column if not exists seq int default 0;
  end if;
exception when others then
  raise notice 'repair: public.sd_ref_counters.seq — %', sqlerrm;
end $$;

-- ---- sd_site_staff -----------------------------------------------------
do $$ begin
  if to_regclass('public.sd_site_staff') is null then
    raise notice 'repair: public.sd_site_staff does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists role text;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.role — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists email text;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.email — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists whatsapp_number text;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.whatsapp_number — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists notify_channels jsonb default '["push"]'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.notify_channels — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_site_staff') is not null then
    alter table public.sd_site_staff add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.sd_site_staff.active — %', sqlerrm;
end $$;

-- ---- sd_sla_policies ---------------------------------------------------
do $$ begin
  if to_regclass('public.sd_sla_policies') is null then
    raise notice 'repair: public.sd_sla_policies does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_sla_policies') is not null then
    alter table public.sd_sla_policies add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_sla_policies.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_sla_policies') is not null then
    alter table public.sd_sla_policies add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_sla_policies.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_sla_policies') is not null then
    alter table public.sd_sla_policies add column if not exists priority text;
  end if;
exception when others then
  raise notice 'repair: public.sd_sla_policies.priority — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_sla_policies') is not null then
    alter table public.sd_sla_policies add column if not exists respond_minutes int;
  end if;
exception when others then
  raise notice 'repair: public.sd_sla_policies.respond_minutes — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_sla_policies') is not null then
    alter table public.sd_sla_policies add column if not exists resolve_minutes int;
  end if;
exception when others then
  raise notice 'repair: public.sd_sla_policies.resolve_minutes — %', sqlerrm;
end $$;

-- ---- sd_ticket_events --------------------------------------------------
do $$ begin
  if to_regclass('public.sd_ticket_events') is null then
    raise notice 'repair: public.sd_ticket_events does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists ticket_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.ticket_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists kind text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.kind — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists actor_name text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.actor_name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists body text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.body — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists internal boolean default false;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.internal — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists payload jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.payload — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_events') is not null then
    alter table public.sd_ticket_events add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_events.created_at — %', sqlerrm;
end $$;

-- ---- sd_ticket_followers -----------------------------------------------
do $$ begin
  if to_regclass('public.sd_ticket_followers') is null then
    raise notice 'repair: public.sd_ticket_followers does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_followers') is not null then
    alter table public.sd_ticket_followers add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_followers.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_followers') is not null then
    alter table public.sd_ticket_followers add column if not exists ticket_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_followers.ticket_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_followers') is not null then
    alter table public.sd_ticket_followers add column if not exists email text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_followers.email — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_followers') is not null then
    alter table public.sd_ticket_followers add column if not exists added_by text default '';
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_followers.added_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_followers') is not null then
    alter table public.sd_ticket_followers add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_followers.created_at — %', sqlerrm;
end $$;

-- ---- sd_ticket_locations -----------------------------------------------
do $$ begin
  if to_regclass('public.sd_ticket_locations') is null then
    raise notice 'repair: public.sd_ticket_locations does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_locations') is not null then
    alter table public.sd_ticket_locations add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_locations.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_locations') is not null then
    alter table public.sd_ticket_locations add column if not exists ticket_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_locations.ticket_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_locations') is not null then
    alter table public.sd_ticket_locations add column if not exists level text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_locations.level — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_locations') is not null then
    alter table public.sd_ticket_locations add column if not exists area_text text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_locations.area_text — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_locations') is not null then
    alter table public.sd_ticket_locations add column if not exists sort_order int default 0;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_locations.sort_order — %', sqlerrm;
end $$;

-- ---- sd_ticket_photos --------------------------------------------------
do $$ begin
  if to_regclass('public.sd_ticket_photos') is null then
    raise notice 'repair: public.sd_ticket_photos does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists ticket_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.ticket_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists kind text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.kind — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists storage_path text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.storage_path — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists data_url text;
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.data_url — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists uploaded_by text default '';
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.uploaded_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_ticket_photos') is not null then
    alter table public.sd_ticket_photos add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_ticket_photos.created_at — %', sqlerrm;
end $$;

-- ---- sd_tickets --------------------------------------------------------
do $$ begin
  if to_regclass('public.sd_tickets') is null then
    raise notice 'repair: public.sd_tickets does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists ref text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.ref — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists status text default 'new';
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.status — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists priority text default 'normal';
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.priority — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists category_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.category_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists category_label text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.category_label — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists description text default '';
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.description — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists lodged_by_name text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.lodged_by_name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists lodged_by_staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.lodged_by_staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists assigned_staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.assigned_staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists assigned_name text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.assigned_name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists attended_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.attended_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists resolved_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.resolved_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists closed_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.closed_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists reopened_count int default 0;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.reopened_count — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists csat text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.csat — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists pdf_path text;
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.pdf_path — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.sd_tickets') is not null then
    alter table public.sd_tickets add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.sd_tickets.updated_at — %', sqlerrm;
end $$;

-- ---- service_contracts -------------------------------------------------
do $$ begin
  if to_regclass('public.service_contracts') is null then
    raise notice 'repair: public.service_contracts does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists provider_org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.provider_org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists client_org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.client_org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists scope text default '';
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.scope — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists starts_on date;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.starts_on — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists ends_on date;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.ends_on — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.service_contracts') is not null then
    alter table public.service_contracts add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.service_contracts.created_at — %', sqlerrm;
end $$;

-- ---- staff -------------------------------------------------------------
do $$ begin
  if to_regclass('public.staff') is null then
    raise notice 'repair: public.staff does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.staff.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.staff.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.staff.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.staff.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists role text default 'Cleaner';
  end if;
exception when others then
  raise notice 'repair: public.staff.role — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists pin text;
  end if;
exception when others then
  raise notice 'repair: public.staff.pin — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists active boolean default true;
  end if;
exception when others then
  raise notice 'repair: public.staff.active — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.staff.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists preferred_language text;
  end if;
exception when others then
  raise notice 'repair: public.staff.preferred_language — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.staff') is not null then
    alter table public.staff add column if not exists pin_hash text;
  end if;
exception when others then
  raise notice 'repair: public.staff.pin_hash — %', sqlerrm;
end $$;

-- ---- themes ------------------------------------------------------------
do $$ begin
  if to_regclass('public.themes') is null then
    raise notice 'repair: public.themes does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.themes.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists org_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.themes.org_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.themes.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.themes.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists slug text;
  end if;
exception when others then
  raise notice 'repair: public.themes.slug — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists base_theme text;
  end if;
exception when others then
  raise notice 'repair: public.themes.base_theme — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists tokens jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.themes.tokens — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists fonts jsonb default '{}'::jsonb;
  end if;
exception when others then
  raise notice 'repair: public.themes.fonts — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists is_builtin boolean default false;
  end if;
exception when others then
  raise notice 'repair: public.themes.is_builtin — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists created_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.themes.created_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.themes.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.themes') is not null then
    alter table public.themes add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.themes.updated_at — %', sqlerrm;
end $$;

-- ---- timesheet_weeks ---------------------------------------------------
do $$ begin
  if to_regclass('public.timesheet_weeks') is null then
    raise notice 'repair: public.timesheet_weeks does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists id uuid default gen_random_uuid();
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists building_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.building_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists staff_id uuid;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.staff_id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists week_start date;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.week_start — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists status text default 'pending';
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.status — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists approved_minutes int;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.approved_minutes — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists note text default '';
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.note — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists decided_by uuid;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.decided_by — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists decided_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.decided_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.timesheet_weeks') is not null then
    alter table public.timesheet_weeks add column if not exists updated_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.timesheet_weeks.updated_at — %', sqlerrm;
end $$;

-- ---- users -------------------------------------------------------------
do $$ begin
  if to_regclass('public.users') is null then
    raise notice 'repair: public.users does not exist yet — APPLY_EVERYTHING will create it';
  end if;
end $$;
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users add column if not exists id uuid;
  end if;
exception when others then
  raise notice 'repair: public.users.id — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users add column if not exists name text;
  end if;
exception when others then
  raise notice 'repair: public.users.name — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users add column if not exists email text;
  end if;
exception when others then
  raise notice 'repair: public.users.email — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users add column if not exists created_at timestamptz default now();
  end if;
exception when others then
  raise notice 'repair: public.users.created_at — %', sqlerrm;
end $$;
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users add column if not exists last_seen_at timestamptz;
  end if;
exception when others then
  raise notice 'repair: public.users.last_seen_at — %', sqlerrm;
end $$;

-- ---- backfills that a bare ADD COLUMN cannot do -------------------------
do $$ begin
  if to_regclass('public.buildings') is not null
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'buildings'
                    and column_name = 'slug') then
    -- a slug from the name: "Aurora on Collins" -> "aurora-on-collins"
    update public.buildings
       set slug = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
     where slug is null or trim(slug) = '';
    -- and a suffix for any collision, so the unique index can be created
    update public.buildings b
       set slug = b.slug || '-' || left(b.id::text, 4)
      from (select slug from public.buildings group by slug having count(*) > 1) d
     where b.slug = d.slug;
    begin
      create unique index if not exists buildings_slug_key on public.buildings (slug);
    exception when others then
      raise notice 'repair: buildings.slug unique index — %', sqlerrm;
    end;
  end if;
end $$;

do $$ begin raise notice 'repair: finished — now paste APPLY_EVERYTHING.sql'; end $$;
