# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage

**Stage 0 — repo + docs scaffold: COMPLETE.** Next up: **Stage 1** (design
tokens tuned for all 5 themes, app shell visuals).

## What exists

- **Next.js 16 (App Router) + TypeScript strict + Tailwind v4**, boots to a
  blank shell (`app/layout.tsx`, `app/page.tsx`).
- **Design tokens**: semantic CSS variables in `app/globals.css`, mapped to
  Tailwind utilities via `@theme inline`. Only the default `graphite` theme
  exists, with placeholder values. Themes switch via `data-theme` on `<html>`.
- **Supabase wiring**: `.env.example`, browser client `lib/supabase/client.ts`,
  server client `lib/supabase/server.ts` (@supabase/ssr). No project linked
  yet, no auth middleware yet, no migrations yet. Migration tooling =
  Supabase CLI via `npm run db:new|db:push|db:reset|db:diff`
  (see `supabase/README.md`).
- **Module system**: `modules/registry.ts` + `modules/types.ts` declare all 12
  modules (id, name, status, nav contribution). `core` and `cleaning-ops`
  active; `concierge-desk` not_enabled; the rest coming_soon. Each module has
  a folder with a README stub only.
- **Docs**: this file, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` (stub),
  `design/tokens.md` (stub), `CLAUDE.md` (project memory).
- **CI**: `.github/workflows/ci.yml` — typecheck + lint on push.

## Not done yet (deliberately — Stage 0 scope)

- No Supabase project link, no database schema, no RLS, no auth.
- No real UI beyond the blank shell; nav is not rendered from the registry yet.
- Fonts (General Sans / Hanken Grotesk / Geist Mono) not loaded — Stage 1.
- 4 of 5 themes (harbour, eucalypt, sandstone, ink) not defined — Stage 1.

## Exact next steps (Stage 1)

1. Tune graphite token values; add harbour, eucalypt, sandstone, ink token
   sets in `app/globals.css`; document every value + reference in
   `design/tokens.md`.
2. Load the three font families via `next/font`, wire type scale tokens.
3. Build the app shell (nav rendered from `modules/registry.ts`, statuses
   respected with polished disabled states).

## Known issues / HANDOVER

- `supabase/config.toml` is minimal (project_id only); run
  `npx supabase init --force` if the CLI demands more, then re-set project_id.
- Supabase env vars in `.env.example` use anon/service-role naming; if the
  project uses new-style publishable/secret keys, the same variables hold them
  (note in file).
- Nothing half-finished; working tree ships green (typecheck, lint, build).
