# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage
**Stage 1.5 — "FOCT Premium Operations UI" visual upgrade: BUILT, awaiting visual approval.**
Stage 1 (token system, 5 themes, base components, `/design-preview`) was built earlier the same day; the owner then requested a premium visual upgrade + operational demo screens before any backend work. Review order: `/dashboard` → `/kiosk` → `/roster` → `/timesheets` → `/consumables` → `/modules` → `/design-preview`. Do **not** start Stage 2 until the owner approves.

## What exists (sessions of 2026-07-02)

### Token system — `src/styles/tokens.css`
- Five themes (Graphite default, Harbour, Eucalypt, Sandstone, Ink) as `data-theme` sets; semantic tokens only, mapped to Tailwind v4 utilities in `src/app/globals.css` (stock palette/text sizes disabled).
- Stage 1.5 additions: `--sidebar-*` family (deep rail, per-theme), `--info` status family, 72px `hero` type size; scale bumped (body 16, tables 14, page titles 36), radius 16/12/8, controls 44px.
- `design/tokens.md`: every token with Radix/HIG/Material reference, shadcn-name mapping, and **generated** WCAG tables — 36 pairs × 5 themes, 180 rows, all passing (`npm run check:contrast`, `--md` to regenerate).

### Fonts
Hanken Grotesk (body, self-hosted `src/fonts/`), Inter (interim display, self-hosted), Geist Mono (numerics only, `geist` package). General Sans = drop-in slot at `public/fonts/general-sans/` (see README; network policy blocked Fontshare).

### Components — `src/components/ui/`
Stage 1: button, input, select, badge (Badge + StatusPill), card, table, tabs, modal, toast, empty-state, coming-soon-state, sidebar, top-bar, page-header.
Stage 1.5: metric-card, section-header, icon-button, search-input, filter-bar (FilterBar + SegmentedControl), drawer, kiosk-button, module-card, attendance-timeline. Plus `src/components/app-shell.tsx` (client shell: dark Sidebar + TopBar + ToastProvider; renders Harbour — Aurora's assigned theme).
All consume semantic tokens only (`npm run check:tokens` enforces).

### Screens (static, demo data from `src/lib/demo-data.ts` only)
- `/` — review hub linking every screen.
- `/dashboard` — greeting header, 6 metric cards, live attendance timeline, today's shifts table, needs-attention list, low stock, audit score, recent tasks.
- `/roster` — Day/Week/Timeline segmented views, status/search filters, shift detail Drawer, filtered empty state.
- `/timesheets` — summary metrics, variance badges, approve actions (toast feedback), supervisor notes card.
- `/consumables` — metrics, approval-queue order cards, category chip filter, stock table with level meters.
- `/modules` — access-separation explainer + ModuleCard grid (Enabled / Not enabled / Coming soon / Requires Pro tiers).
- `/kiosk` — full-screen Ink theme: live 72px clock, PIN pad (demo PINs 1234/2345/3456), huge check-in/out buttons, site note, success screen with auto-reset. No sidebar, no admin chrome.
- `/design-preview` — Stage 1 acceptance page, now including the new operational components; theme switcher + compare-all mode.

### Verified this session
`check:tokens` ✓, `check:contrast` ✓ (180 rows), `tsc` ✓, `next build` ✓ (11 static routes), every screen screenshotted via Playwright incl. kiosk success flow, roster week view and drawer.

## Migrations applied
None. No Supabase yet by design (DECISIONS.md) — first migration lands in Stage 2.

## Exact next steps
1. Owner reviews the screens (`npm install && npm run dev`, start at `/`). **Gate.**
2. On approval: Stage 2 — Supabase (Sydney), core tables + RLS + pgTAP isolation tests, seed Aurora on Collins; then re-bind these screens to real data.
3. Drop `GeneralSans-Variable.woff2` into `public/fonts/general-sans/` when obtainable (no code change).

## HANDOVER (half-finished / risky)
- **All Stage 1.5 screens are static demos.** Buttons like "Approve", "Reassign zone", "Add shift" show toasts or nothing — no persistence. Kiosk PINs are a hardcoded demo map in `kiosk-screen.tsx`. Do not mistake these for working features.
- **General Sans still not loading** — headings render in Inter until the woff2 is dropped in.
- **Sidebar is desktop-only** (`hidden lg:flex`); no mobile nav drawer yet.
- **Roster week view fabricates non-today days** from today's data (visual demo of the board layout only).
- **Timesheets "Approve all ready" / per-row Approve don't change row state** — toast only.
- **No ESLint config, no CI** — `check:tokens` + `check:contrast` + `tsc` are the gates; wire into CI in Stage 2.
- **Drawer/Modal animations are minimal** (no enter/exit keyframes; Tailwind v4 has no stock animate utilities). Add `tw-animate-css` or keyframes if transitions feel abrupt.
- Design-preview's app-shell section still shows the old inline Sidebar usage (button items, no hrefs) — intentional for isolated preview, but it means the preview shell and the real `AppShell` are separate compositions.
