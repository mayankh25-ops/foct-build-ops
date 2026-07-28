set -e
OUT=supabase/APPLY_EVERYTHING.sql
{
  echo "-- ============================================================================="
  echo "-- APPLY_EVERYTHING.sql — GENERATED. Sets up a COMPLETE, EMPTY Supabase project"
  echo "-- in one paste: platform foundation, theme engine, demo seed, Service Desk,"
  echo "-- anon hardening, authz, integrations framework, session profile, attendance +\n-- kiosk devices."
  echo "--"
  echo "-- Use when a project has auth users but no tables (or a brand-new project)."
  echo "-- Idempotent — safe to re-run. Regenerate with: npm run build:apply-everything"
  echo "-- Afterwards, verify with supabase/tests/session_profile_check.sql (5 ok)."
  echo "-- ============================================================================="
  echo
  for f in \
    supabase/migrations/0000_platform_foundation.sql \
    supabase/migrations/0001_theme_engine.sql \
    supabase/seed.sql \
    supabase/migrations/0002_service_desk.sql \
    supabase/migrations/0003_anon_hardening.sql \
    supabase/seed_service_desk.sql \
    supabase/migrations/0004_authz_can.sql \
    supabase/migrations/0005_integrations_framework.sql \
    supabase/migrations/0006_session_profile.sql \
    supabase/migrations/0007_attendance_kiosk.sql \
    supabase/migrations/0008_kiosk_selfie_storage.sql \
    supabase/migrations/0009_kiosk_notices.sql ; do
    echo "-- ---------------------------------------------------------------------------"
    echo "-- $(basename "$f")"
    echo "-- ---------------------------------------------------------------------------"
    cat "$f"
    echo
  done
} > "$OUT"
wc -l "$OUT"
