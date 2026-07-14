# Supabase — Stage 2 apply guide

Project: `https://iitdhglgatyoxjocxprs.supabase.co` (Sydney). This build
environment cannot reach `*.supabase.co` (egress proxy), so migrations were
**validated against a local Postgres 16** — full run + 23-assertion RLS
isolation suite, all green — and are applied by you in ~2 minutes:

## Apply (one paste)
1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the whole of **`supabase/APPLY_STAGE2.sql`** → Run.
   (Idempotent — safe to re-run.)
3. New query → paste **`supabase/tests/isolation_check.sql`** → Run.
   Expect **23 `ok:` notices** and no errors. It rolls itself back — no
   probe data persists.

## What it creates
- `migrations/0000_platform_foundation.sql` — all CLAUDE.md core tables,
  `app.*` helper functions, RLS on every table, grants.
- `migrations/0001_theme_engine.sql` — themes + building_theme_assignments.
- `seed.sql` — Aurora on Collins cast (orgs, users, memberships, modules,
  contracts, built-in themes, Nature assigned) + a rival org used only to
  prove isolation. Demo users have no passwords — invite/magic-link via the
  dashboard when you want to sign in as one.

## Files
- `APPLY_STAGE2.sql` — generated concatenation (`npm run build:apply-sql`);
  never edit by hand.
- `tests/local_prelude.sql` — LOCAL validation shim only (fake `auth` schema
  + roles). Never run on Supabase.
- `tests/isolation_check.sql` — the acceptance tests; runs locally and on
  Supabase.
- `tests/0001_theme_engine_isolation.sql` — pgTAP variant for CI (needs the
  pgTAP extension + platform test helpers; the plain-SQL check above covers
  the same ground today).

## Local validation (how it was verified here)
```sh
initdb + pg_ctl (PG16)  # any scratch cluster
psql -f supabase/tests/local_prelude.sql
psql -f supabase/migrations/0000_platform_foundation.sql
psql -f supabase/migrations/0001_theme_engine.sql
psql -f supabase/seed.sql
psql -f supabase/tests/isolation_check.sql   # expect 23 ok-notices
```

## Stage 3 apply (Service Desk backend)
1. SQL Editor → paste **`supabase/APPLY_STAGE3.sql`** → Run (idempotent; includes
   `0003_anon_hardening.sql`, which strips Supabase's default anon table grants
   down to the single intake RPC — required for the test's strict anon check).
2. New query → paste **`supabase/tests/sd_isolation_check.sql`** → Run.
   Expect **15 `ok:` notices** (anon QR-intake RPC works; internal notes
   invisible to concierge AND building owner; rival org sees nothing).
3. To go LIVE in the app on your machine/Vercel: set `NEXT_PUBLIC_SD_LIVE=1`
   in `.env.local`, set a password for `priya@foct.demo` in Authentication →
   Users, sign in at `/sign-in`, then open `/service-desk`. The public intake
   (`/support/new`, QR form) lodges through the token RPC without a login.
   Until the flag is set, all screens keep the local demo store.

## Stage 4 apply (Integrations framework)
1. SQL Editor → paste **`supabase/APPLY_STAGE4_INTEGRATIONS.sql`** → Run
   (idempotent; extends the Stage-2 integration stub — catalogue JSON Schemas,
   Vault-backed replace-only credentials, notification_log, save/activate
   RPCs). It requires the **supabase_vault** extension; on a standard project
   it is pre-installed, otherwise enable it under Database → Extensions first.
2. New query → paste **`supabase/tests/integrations_isolation_check.sql`** →
   Run. Expect **19 `ok:` notices** (secrets never readable back, replace-only
   enforced at the DB, one active credential per scope, rival org sees
   nothing, notification_log write-locked to service_role). Rolls itself back.
3. To go LIVE in the app: add `SUPABASE_SECRET_KEY` (server-side, Project
   Settings → API) and `NEXT_PUBLIC_INTEGRATIONS_LIVE=1` to `.env.local`,
   sign in as an org admin, then open `/settings/integrations`. Test
   connection and test sends run through `/api/integrations/*` server routes —
   the browser never touches provider APIs or decrypted secrets. Until the
   flag is set, the GUI runs on the local demo store (masked-only, no secrets
   persisted anywhere client-side).

## App wiring
`.env.local` (gitignored) carries `NEXT_PUBLIC_SUPABASE_URL` +
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`); the browser client is
`src/lib/supabase.ts`. Screens keep their local demo stores until each
module's data layer swaps over (Service Desk first, Stage 3).
