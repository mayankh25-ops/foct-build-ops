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

-- IMPORTANT: Supabase installs pgcrypto into an `extensions` schema, NOT
-- `public`. A function with a pinned search_path that omits it fails with
-- "function gen_salt(unknown, integer) does not exist" — on the real project
-- only. The mirror therefore copies that layout exactly, so the failure
-- happens in CI instead of in the owner's SQL editor.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to public;

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

-- ------------------------------------------------------------- vault -------
-- `supabase_vault` cannot be installed off-platform, so this is a faithful
-- stand-in for the two calls 0005 makes: create_secret() returns an id, and
-- decrypted_secrets exposes the plaintext to privileged roles only.
--
-- It is NOT a security claim about the shim — on a real project this is
-- Supabase's own Vault. What the isolation suite actually proves lives in OUR
-- code and holds either way: the plaintext never lands in
-- integration_credentials, `authenticated` cannot read the vault at all, and
-- secret_ref is immutable (replace-only).
create schema if not exists vault;
revoke all on schema vault from public, anon, authenticated;

create table if not exists vault.secrets (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  secret      bytea not null,
  created_at  timestamptz not null default now()
);

-- one throwaway key per scratch database; never leaves this machine
create or replace function vault._key() returns text
language sql stable as $$ select 'mirror-only-key' $$;

create or replace function vault.create_secret(new_secret text, new_name text default null)
returns uuid language sql volatile security definer set search_path = vault, public, extensions as $$
  insert into vault.secrets (name, secret)
  values (new_name, extensions.pgp_sym_encrypt(new_secret, vault._key()))
  returning id
$$;

create or replace function vault.update_secret(
  secret_id uuid, new_secret text default null, new_name text default null)
returns void language sql volatile security definer set search_path = vault, public, extensions as $$
  update vault.secrets
     set secret = coalesce(extensions.pgp_sym_encrypt(new_secret, vault._key()), secret),
         name   = coalesce(new_name, name)
   where id = secret_id
$$;

create or replace view vault.decrypted_secrets as
  select id, name, extensions.pgp_sym_decrypt(secret, vault._key()) as decrypted_secret, created_at
    from vault.secrets;

revoke all on vault.secrets, vault.decrypted_secrets from public, anon, authenticated;
revoke all on function vault.create_secret(text, text) from public, anon, authenticated;

select 'mirror bootstrapped — now run APPLY_EVERYTHING.sql' as next_step;
