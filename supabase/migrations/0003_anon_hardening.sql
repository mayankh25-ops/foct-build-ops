-- =============================================================================
-- 0003_anon_hardening.sql — strip the anonymous API role to least privilege.
--
-- WHY: Supabase projects ship ALTER DEFAULT PRIVILEGES that auto-grant table
-- access to `anon` for every table created in `public`. RLS still blocked all
-- rows (sd_isolation_check proved anon saw an EMPTY result, not data), but the
-- anonymous role should not be able to address these tables at all.
-- After this migration the ONLY thing `anon` can do is execute the token-gated
-- public intake RPC (SECURITY DEFINER, so it needs no table grants).
-- =============================================================================

-- take back everything the project defaults handed out (also from PUBLIC —
-- anon inherits anything granted to the PUBLIC pseudo-role)
revoke all on all tables    in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;

-- and stop future tables from being auto-granted to anon
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- belt-and-braces: revoke per-table explicitly (grantor-independent when run
-- as the table owner), so a silently no-op'd blanket revoke can't leave gaps
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- anon keeps exactly one capability: lodging a ticket via the intake token
grant usage on schema public to anon;
grant execute on function public.sd_lodge_ticket(text, jsonb) to anon;
