# FOCT BuildingOps

Multi-tenant SaaS for Australian high-rise building operations. Next.js
(App Router) + Supabase, multi-organisation isolation enforced in Postgres RLS
first and the UI second.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Without Supabase environment variables the app runs in **demo mode** on seeded
local data — every screen works, nothing is saved to a server. To connect a
real project, copy `.env.example` to `.env.local` and fill in the two
`NEXT_PUBLIC_SUPABASE_*` values, then **restart the dev server** (Next inlines
them at start-up).

```bash
npm run check:supabase          # diagnoses a connection in plain English
npm run check:supabase -- you@example.com yourpassword   # and a real sign-in
```

## Test it

```bash
npm run verify         # tokens, contrast, types, lint, unit, secrets, deps, build
npm run test:db        # database + RLS isolation (needs a scratch Postgres)
npm run test:e2e       # end-to-end in a real browser, against a production build
```

`npm run verify` is what CI runs first and what you should run before pushing.
The full layered strategy, the release gate, and an honest list of what is
**not** yet covered are in **[docs/TESTING.md](docs/TESTING.md)**.

## Set up a database

| Situation | Do this |
|---|---|
| Brand-new / empty Supabase project | paste `supabase/APPLY_EVERYTHING.sql` |
| Not sure what a project contains | paste `supabase/tests/project_inventory.sql` |
| A half-built project that errors on apply | `supabase/RESET_PUBLIC_SCHEMA.sql`, then the bundle (logins survive) |
| A real building to test with | edit and paste `supabase/NEW_BUILDING.sql` |

## Docs

| File | What's in it |
|---|---|
| `CLAUDE.md` | product rules: isolation model, design system, module scope |
| `docs/TESTING.md` | testing layers, release gate, known gaps |
| `docs/KIOSK.md` | the kiosk end to end — who creates what, PINs, pairing, Android |
| `docs/DEPLOY.md` | Vercel, environment variables, why a redeploy is needed |
| `docs/PROJECT_STATE.md` | where the build is right now |
| `docs/DECISIONS.md` | every deviation and why, dated |
| `supabase/README.md` | which SQL bundle to apply when |
