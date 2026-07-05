# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage
**Stage 1.7 — v3 restyle to the owner's reference build (ink+teal, light kiosk): BUILT, awaiting visual approval.**
History: Stage 1 → 1.5 premium upgrade + screens → 1.6 TailAdmin restyle (indigo) → 1.7 owner-reference restyle (see DECISIONS.md 2026-07-03 later entry): ink `#101828` primary buttons + teal `#0e7569` links, uppercase micro-labels, dashboard hero (LiveClock/weather/progress donut/activity feed/locked camera wall), per-shift timesheets with hours bars, LIGHT Deputy-style kiosk, sidebar regrouped Core/Cleaning/Concierge/Automation, org+building top-bar switchers. Live preview artifact: https://claude.ai/code/artifact/ccade632-a546-4a3a-a90b-75d0039def15 (regenerate with scratchpad assemble script). Review order: `/dashboard` → `/kiosk` → `/roster` → `/timesheets` → `/consumables` → `/modules`. Do **not** start Stage 2 until the owner approves.

## What exists (sessions of 2026-07-02)

### Token system — `src/styles/tokens.css`
- Five themes (Graphite default, Harbour, Eucalypt, Sandstone, Ink) as `data-theme` sets; semantic tokens only, mapped to Tailwind v4 utilities in `src/app/globals.css` (stock palette/text sizes disabled).
- Stage 1.5/1.6 additions: `--sidebar-*` family (light rail in light themes, dark in Ink), `--info` status family, 72px `hero` type size; scale bumped (body 16, tables 14, page titles 36), radius 16/12/8, controls 44px. Graphite = cool gray ramp + indigo `#465fff` (TailAdmin reference), and is the app-shell theme.
- `design/tokens.md`: every token with reference, shadcn-name mapping, and **generated** WCAG tables — 37 pairs × 5 themes, 185 rows, all passing (`npm run check:contrast`, `--md` to regenerate).

### Fonts
**Owner-approved library only** (CLAUDE.md → Typography, 2026-07-05). Shipping: Mona Sans (headings + big-and-thick display numerals, 600–700), DM Sans (body 400/500, line height 1.4–1.6), Roboto Mono (numerics; "SF Mono" fallback for Apple devices). All self-hosted in `src/fonts/`. Approved alternates on npm: Finlandica, Radio Canada, Hubot Sans, Manrope. Retired faces (Roboto sans, Hanken, Inter, Geist) still in repo/deps — safe to prune.

### Components — `src/components/ui/`
Stage 1: button, input, select, badge (Badge + StatusPill), card, table, tabs, modal, toast, empty-state, coming-soon-state, sidebar, top-bar, page-header.
Stage 1.5/1.6: metric-card (TailAdmin arrangement: icon well + trend chip + bold display value), section-header, icon-button, search-input, filter-bar (FilterBar + SegmentedControl), drawer, kiosk-button, module-card, attendance-timeline, mini-bar-chart (dependency-free, sr-only data table). Plus `src/components/app-shell.tsx` (client shell; renders Graphite — switch its data-theme to preview building-assigned themes).
All consume semantic tokens only (`npm run check:tokens` enforces).

### Screens (static, demo data from `src/lib/demo-data.ts` only)
- `/` — review hub linking every screen.
- `/dashboard` — greeting header, 6 metric cards with trend chips, live attendance timeline, weekly hours bar chart (actual vs rostered), today's shifts table, needs-attention list, low stock, audit score, recent tasks.
- `/roster` — Day/Week/Timeline segmented views, status/search filters, shift detail Drawer, filtered empty state.
- `/timesheets` — summary metrics, variance badges, approve actions (toast feedback), supervisor notes card.
- `/consumables` — metrics, approval-queue order cards, category chip filter, stock table with level meters.
- `/modules` — access-separation explainer + ModuleCard grid (Enabled / Not enabled / Coming soon / Requires Pro tiers).
- `/kiosk` — full-screen LIGHT kiosk (Deputy-style): live 72px clock, teal welcome pill, white keypad card, Welcome-by-name on known PIN (demo PINs 1234/2345/3456), huge check-in/out buttons, site note, success screen with auto-reset.
- `/design-preview` — Stage 1 acceptance page, now including the new operational components; theme switcher + compare-all mode.

### Verified this session
`check:tokens` ✓, `check:contrast` ✓ (185 rows), `tsc` ✓, `next build` ✓ (11 static routes), screens re-screenshotted after the restyle (dashboard incl. chart, roster, timesheets, consumables, modules).

## Migrations applied
None. No Supabase yet by design (DECISIONS.md) — first migration lands in Stage 2.

## Exact next steps
1. Owner reviews the screens (`npm install && npm run dev`, start at `/`). **Gate.**
2. On approval: Stage 2 — Supabase (Sydney), core tables + RLS + pgTAP isolation tests, seed Aurora on Collins; then re-bind these screens to real data.
3. Drop `GeneralSans-Variable.woff2` into `public/fonts/general-sans/` when obtainable (no code change).

## HANDOVER (half-finished / risky)
- **All Stage 1.5 screens are static demos.** Buttons like "Approve", "Reassign zone", "Add shift" show toasts or nothing — no persistence. Kiosk PINs are a hardcoded demo map in `kiosk-screen.tsx`. Do not mistake these for working features.
- **Sidebar is desktop-only** (`hidden lg:flex`); no mobile nav drawer yet.
- **Roster week view fabricates non-today days** from today's data (visual demo of the board layout only).
- **Timesheets "Approve all ready" / per-row Approve don't change row state** — toast only.
- **No ESLint config, no CI** — `check:tokens` + `check:contrast` + `tsc` are the gates; wire into CI in Stage 2.
- **Drawer/Modal animations are minimal** (no enter/exit keyframes; Tailwind v4 has no stock animate utilities). Add `tw-animate-css` or keyframes if transitions feel abrupt.
- Design-preview's app-shell section still shows the old inline Sidebar usage (button items, no hrefs) — intentional for isolated preview, but it means the preview shell and the real `AppShell` are separate compositions.
