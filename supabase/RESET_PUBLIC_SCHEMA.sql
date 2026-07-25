-- =============================================================================
-- RESET_PUBLIC_SCHEMA.sql — wipes the app's tables so APPLY_EVERYTHING.sql can
-- rebuild them from scratch.
--
-- WHEN TO USE: a project that was half-built by an interrupted or out-of-date
-- apply, so APPLY_EVERYTHING fails with errors like
--     column b.owner_org_id does not exist
-- (`create table if not exists` skips an existing OLD table instead of
-- upgrading it, so the schema stays stuck at the older shape).
--
-- WHAT IT DELETES: everything in the `public` schema — the app's tables and
-- their rows (organisations, buildings, tickets, integrations, …).
-- WHAT IT KEEPS: your LOGINS. Supabase stores accounts in the separate `auth`
-- schema, which this does not touch. Storage buckets are also untouched.
--
-- DO NOT run this on a project holding real operational data you want to keep.
-- On a demo/dev project it is the fastest way back to a known-good state.
--
-- AFTER RUNNING THIS: paste supabase/APPLY_EVERYTHING.sql and Run, then
-- supabase/tests/project_inventory.sql to confirm the tables are present.
-- =============================================================================

drop schema if exists public cascade;
create schema public;

-- restore the grants Supabase expects on a fresh public schema
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- the app's helper schema is rebuilt by APPLY_EVERYTHING as well
drop schema if exists app cascade;

select 'public schema reset — now run APPLY_EVERYTHING.sql' as next_step;
