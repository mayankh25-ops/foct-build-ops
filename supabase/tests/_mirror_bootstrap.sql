-- =============================================================================
-- _mirror_bootstrap.sql — makes a PLAIN PostgreSQL database look enough like a
-- Supabase project to run APPLY_EVERYTHING.sql and the isolation tests locally.
--
-- NOT for a real Supabase project (it already has all of this). This exists so
-- migrations and RLS tests can be proven on a throwaway database before the
-- owner pastes anything into the live SQL editor.
--
--   createdb k && psql -d k -f supabase/tests/_mirror_bootstrap.sql
--   psql -d k -f supabase/APPLY_EVERYTHING.sql
--   psql -d k -f supabase/migrations/0007_attendance_kiosk.sql
--   psql -d k -f supabase/tests/kiosk_isolation_check.sql
-- =============================================================================

create extension if not exists pgcrypto;

-- Supabase's three request roles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to current_user;
grant usage on schema public to anon, authenticated, service_role;

-- GoTrue's account table, reduced to the columns the app reads.
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() reads the request's JWT claims, exactly as it does on Supabase.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

-- supabase_vault is not available off-platform; 0004 only needs the schema to
-- exist for its credential columns, so stub it out.
create schema if not exists vault;

select 'mirror bootstrapped — now run APPLY_EVERYTHING.sql' as next_step;
