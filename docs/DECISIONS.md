# DECISIONS

Dated log of every deviation from CLAUDE.md and every architectural choice.
Newest entries at the top.

## 2026-07-02 — Stage 0 scaffold

- **Tailwind v4 CSS-first config** (no `tailwind.config.ts`): tokens are
  defined as CSS variables in `app/globals.css` and mapped to utilities with
  `@theme inline`. This is the idiomatic v4 way to do CSS-variable tokens and
  keeps theme switching purely in CSS via `data-theme`.
- **`claude.md.txt` converted to `CLAUDE.md`** (fences and CRLF stripped, no
  content changes) so Claude Code picks it up automatically as project memory.
- **Module catalogue statuses**: CLAUDE.md fixes ConciergeDesk as
  visible-disabled (`not_enabled`) and Parcels/ResidentRequests/Integrations
  as `coming_soon`. Remaining registered modules (building-calendar, tasks,
  consumables, audits, floor-plans, contractors) default to `coming_soon`
  until a stage says otherwise.
- **Tasks/consumables/audits registered as standalone modules** per the
  Stage 0 brief, even though CLAUDE.md describes them as CleaningOps
  features. The CleaningOps build (Stage 2+) decides whether they stay
  separate nav items or fold into cleaning-ops; registry makes either cheap.
- **Supabase CLI via `npx`** (not a devDependency): avoids the CLI's binary
  postinstall in CI and keeps `npm ci` fast; CI only needs typecheck + lint.
- **`@supabase/ssr`** for client/server helpers (the maintained successor to
  auth-helpers). Auth session-refresh middleware deliberately deferred to the
  auth stage.
- **TanStack Query, Zustand, Inngest not yet installed** — stack-mandated but
  unused in Stage 0; adding them the moment a stage needs them avoids dead
  dependencies.
- **Deleted `create-next-app` boilerplate** (demo page, Geist font imports,
  logo SVGs, favicon). Kept its generated `AGENTS.md` note about Next.js 16
  breaking changes.
