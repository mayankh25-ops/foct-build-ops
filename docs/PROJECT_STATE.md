# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage
**Stage 1 — Design system + theme engine: BUILT, awaiting visual approval at `/design-preview`.**
Stage 1 is the acceptance gate: do **not** start Stage 2 until the owner approves the preview page.

## What was built (session of 2026-07-02)

### Token system
- `src/styles/tokens.css` — full semantic token set; five themes (Graphite default, Harbour, Eucalypt, Sandstone, Ink) as `data-theme` token sets. Theme-independent type scale, radius, font-stack primitives in `:root`.
- `src/app/globals.css` — Tailwind v4 `@theme inline` mapping (semantic utilities only; stock palette and text sizes disabled), General Sans `@font-face`, base styles, global `:focus-visible` ring.
- `design/tokens.md` — every token with its reference (Radix step / Apple HIG role / Material equivalent) and **generated** WCAG AA contrast tables (145 rows, all passing).

### Fonts
- Hanken Grotesk (body): self-hosted variable woff2 in `src/fonts/hanken-grotesk/`, `next/font/local`.
- Inter (interim display): `src/fonts/inter/`, `next/font/local`.
- Geist Mono (numerics only): `geist` npm package.
- General Sans (display): **drop-in slot** at `public/fonts/general-sans/` — see README there and DECISIONS.md (network policy blocked Fontshare).

### Components — `src/components/ui/`
`button.tsx` (primary/secondary/ghost/destructive, sm/md, loading), `input.tsx` (label/hint/error), `select.tsx` (Radix), `badge.tsx` (Badge + StatusPill), `card.tsx`, `table.tsx` (numeric cells → Geist Mono), `tabs.tsx` (Radix), `modal.tsx` (Radix Dialog), `toast.tsx` (Radix Toast + `useToast`), `empty-state.tsx`, `coming-soon-state.tsx` (coming-soon / not-enabled modes), `sidebar.tsx` (sections, active + disabled-with-"Soon"-badge items), `top-bar.tsx`, `page-header.tsx`. All consume semantic tokens only. Helper: `src/lib/cn.ts`.

### Preview (the acceptance gate)
- `/design-preview` (`src/app/design-preview/page.tsx` + `preview.tsx`): every component in every theme; global theme switcher (also sets `data-theme` on `<html>`); "Compare all themes" side-by-side mode; Aurora on Collins demo data throughout (Priya Sharma cleaning manager, cleaners Marcus Chen / Leila Haddad / Tom Nguyen, FOCT Cleaning org); app-shell composition (Sidebar + TopBar + PageHeader + roster table).

### Guardrail scripts (run these after any styling change)
- `npm run check:tokens` — fails on raw hex/rgb/hsl or stock Tailwind colour utilities under `src/`.
- `npm run check:contrast` — parses tokens.css, fails below WCAG AA; `--md` regenerates the tables embedded in `design/tokens.md`.
- Verified this session: both checks pass, `tsc --noEmit` clean, `next build` clean, page screenshotted in Graphite/Harbour/Ink incl. modal, toast, and compare mode.

## Migrations applied
- None. No Supabase yet by design (DECISIONS.md) — first migration lands in Stage 2.

## Exact next steps
1. Owner reviews `/design-preview` (run `npm install && npm run dev`), approves or requests tuning. **Gate — nothing proceeds without this.**
2. On approval: Stage 2 planning — Supabase project (Sydney), core tables + RLS + pgTAP isolation tests per CLAUDE.md (`organisations` … `building_theme_assignments`), seed the Aurora on Collins demo dataset.
3. Whenever General Sans woff2 is obtainable, drop `GeneralSans-Variable.woff2` into `public/fonts/general-sans/` — no code change needed.

## HANDOVER (half-finished / risky)
- **General Sans is not actually loading** — headings currently render in Inter (documented fallback). Not broken, but the display face the design was specced around is absent until the woff2 is dropped in. See `public/fonts/general-sans/README.md`.
- **Theme values are first-pass**, tuned to pass AA but not yet eyeballed by the owner; Sandstone's bronze and Graphite's graphite-blue are the most likely to want tweaking. Tune only in `tokens.css`, then re-run `npm run check:contrast` and regenerate the tables in `design/tokens.md` (`--md`).
- **No ESLint config yet** — `npm run lint` will prompt interactively; typecheck + the two check scripts are the working gates. Add eslint config early in Stage 2.
- **No CI** — the check scripts exist but nothing runs them automatically.
- **Radix Select is not portalled** (deliberate, see DECISIONS.md) — if a future layout clips dropdowns with `overflow: hidden`, revisit.
- Modal/Toast animations were left out (no animation utilities in stock Tailwind v4; add `tw-animate-css` or CSS keyframes later if the static transitions feel abrupt).
- `themes` / `building_theme_assignments` tables (per-building theme picking) are Stage 2+ concerns; theme switching is currently client-side only on the preview page.
