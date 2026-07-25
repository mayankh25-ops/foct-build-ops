-- Which project am I looking at, and what does it contain?
-- Safe to run in ANY Supabase project (never errors on missing tables).
-- Paste into the SQL editor when you're unsure which project a tab is on.
select
  current_database()                                        as database,
  (select count(*) from auth.users)                         as auth_users,
  (select string_agg(email, ' | ' order by email) from auth.users) as user_emails,
  to_regclass('public.users')                is not null     as has_platform_tables,
  to_regclass('public.organisations')        is not null     as has_organisations,
  to_regclass('public.sd_tickets')           is not null     as has_service_desk,
  to_regclass('public.integration_providers') is not null    as has_integrations,
  to_regproc('public.current_profile')       is not null     as has_session_profile;

-- Reading it:
--   has_platform_tables = false → this project has NOT been set up.
--     Fix: paste supabase/APPLY_EVERYTHING.sql here, then re-run this query.
--   auth_users / user_emails → the accounts that can sign in HERE.
--     A login that works elsewhere will not work here unless it is in this list.
