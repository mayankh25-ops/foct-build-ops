# ARCHITECTURE (stub)

Filled in as stages land. For product intent and non-negotiable rules, read
`CLAUDE.md` first.

## Layout

| Path | Purpose |
| --- | --- |
| `app/` | Next.js App Router routes and root layout |
| `modules/` | One folder per product module + `registry.ts` (single source of truth for module id/name/status/nav) |
| `lib/supabase/` | Browser and server Supabase clients (`@supabase/ssr`) |
| `supabase/` | CLI config + SQL migrations (RLS ships with tables) |
| `design/` | Design token documentation |
| `docs/` | PROJECT_STATE, DECISIONS, this file |

## To document in later stages

- Multi-org isolation model (org × building × module × role × permission ×
  service_contract) and its RLS implementation.
- Auth flow and Supabase session-refresh middleware.
- Theming pipeline (token sets, `data-theme`, per-building assignment).
- Integrations adapter framework.
- Background jobs (Inngest).
