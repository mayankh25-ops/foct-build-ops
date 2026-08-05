-- =============================================================================
-- 0018 — "what is actually wrong with my database?"
--
-- The failure mode this closes: the app expects a table or a function, the
-- project is one bundle behind, and the symptom is a screen that never stops
-- loading. Nobody can get from that to "paste APPLY_EVERYTHING.sql" without
-- someone reading the console for them.
--
-- `app_health()` answers it directly. It checks for every table and function
-- the app calls, reports which are missing, and — because a health check that
-- needs a healthy database is no use — it is written to work when almost
-- nothing exists. `to_regclass` returns null rather than raising for a missing
-- table, and pg_proc is queried rather than the function being called.
--
-- It is deliberately readable by any signed-in user. It exposes no data: only
-- the names of things this repository already publishes. A cleaner who reaches
-- it learns nothing they could not read in the migrations.
-- =============================================================================

create or replace function public.app_health()
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_missing_tables text[] := '{}';
  v_missing_fns    text[] := '{}';
  v_missing_cols   text[] := '{}';
  v_t text; v_f text; v_c text;
  v_counts jsonb;
  v_uid uuid := auth.uid();
begin
  -- every table the app reads or writes, in the order they were introduced
  foreach v_t in array array[
    'organisations', 'organisation_types', 'buildings', 'building_organisations',
    'users', 'organisation_memberships', 'building_memberships',
    'roles', 'permissions', 'role_permissions',
    'modules', 'building_modules', 'audit_logs',
    'themes', 'building_theme_assignments',
    'integration_providers', 'integration_credentials',
    'staff', 'kiosk_devices', 'attendance_events', 'attendance_adjustments',
    'notices', 'notice_acks', 'timesheet_weeks', 'roster_shifts',
    'attendance_alerts', 'attendance_alert_settings',
    'org_invites', 'handover_notes'
  ] loop
    if to_regclass('public.' || v_t) is null then
      v_missing_tables := v_missing_tables || v_t;
    end if;
  end loop;

  -- every RPC the client calls by name. A missing one is the single most
  -- common cause of "it just spins": PostgREST answers 404 and the screen has
  -- nothing to show.
  foreach v_f in array array[
    'current_profile', 'claim_access', 'invite_create', 'org_people',
    'staff_create', 'staff_reset_pin', 'kiosk_device_create', 'kiosk_issue_pair_code',
    'kiosk_pair', 'kiosk_punch', 'attendance_sessions', 'attendance_day',
    'timesheet_week', 'timesheet_decide', 'attendance_adjust',
    'roster_week', 'roster_shift_set', 'roster_shift_delete', 'roster_copy_week',
    'attendance_alerts_open', 'attendance_alerts_scan', 'alert_settings_get',
    'handover_add', 'handover_feed', 'site_create', 'site_delete', 'app_health'
  ] loop
    if not exists (
      select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_f)
    then
      v_missing_fns := v_missing_fns || v_f;
    end if;
  end loop;

  -- columns added by a later migration to a table an older project already
  -- had. `create table if not exists` skips those, which is the exact reason
  -- REPAIR_SCHEMA.sql exists — this is how you find out you need it.
  foreach v_c in array array[
    'buildings.slug', 'buildings.timezone', 'buildings.default_language',
    'staff.preferred_language', 'users.last_seen_at'
  ] loop
    if to_regclass('public.' || split_part(v_c, '.', 1)) is not null
       and not exists (
         select 1 from information_schema.columns
          where table_schema = 'public'
            and table_name = split_part(v_c, '.', 1)
            and column_name = split_part(v_c, '.', 2))
    then
      v_missing_cols := v_missing_cols || v_c;
    end if;
  end loop;

  -- how much is actually set up. Zeroes are not a fault — they are the
  -- difference between "broken" and "empty", which is the distinction the
  -- loading screens could not make.
  if to_regclass('public.buildings') is not null then
    select jsonb_build_object(
      'organisations', (select count(*) from public.organisations),
      'buildings',     (select count(*) from public.buildings),
      'staff',         (select count(*) from public.staff),
      'kiosks',        (select count(*) from public.kiosk_devices),
      'people',        (select count(*) from public.users))
      into v_counts;
  else
    v_counts := jsonb_build_object('organisations', 0, 'buildings', 0,
                                   'staff', 0, 'kiosks', 0, 'people', 0);
  end if;

  return jsonb_build_object(
    'ok', cardinality(v_missing_tables) = 0
          and cardinality(v_missing_fns) = 0
          and cardinality(v_missing_cols) = 0,
    'signed_in', v_uid is not null,
    'missing_tables', to_jsonb(v_missing_tables),
    'missing_functions', to_jsonb(v_missing_fns),
    'missing_columns', to_jsonb(v_missing_cols),
    'counts', v_counts,
    -- the fix, named, so nobody has to work it out from a list of table names
    'remedy', case
      when cardinality(v_missing_cols) > 0 then 'repair'
      when cardinality(v_missing_tables) > 0 or cardinality(v_missing_fns) > 0 then 'bundle'
      else 'none' end);
exception when others then
  -- even the health check failing is a diagnosis
  return jsonb_build_object('ok', false, 'error', sqlerrm, 'remedy', 'bundle');
end $$;
revoke all on function public.app_health() from public;
grant execute on function public.app_health() to authenticated, anon;

do $$ begin raise notice '0018 health: the app can say what its database is missing'; end $$;
