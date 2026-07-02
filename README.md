# FOCT BuildingOps

Multi-tenant SaaS for Australian high-rise building operations. First
commercial module: **CleaningOps**. See `CLAUDE.md` for product intent and
non-negotiable rules, `docs/PROJECT_STATE.md` for current status.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind v4 (CSS-variable design
tokens) · Supabase (Postgres, Auth, RLS, Storage)

## Getting started

```sh
npm install
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

Checks: `npm run typecheck` · `npm run lint` · database workflow in
`supabase/README.md`.

## Repo map

- `app/` — routes and root layout
- `modules/` — module folders + `registry.ts` (id, name, status, nav)
- `lib/supabase/` — browser/server Supabase clients
- `supabase/` — CLI config + migrations
- `design/tokens.md` — design token reference
- `docs/` — PROJECT_STATE, DECISIONS, ARCHITECTURE
