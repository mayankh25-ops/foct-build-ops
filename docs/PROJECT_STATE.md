# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage
**Stage 1.5 Theme Builder: SHIPPED (2026-07-07).** Appearance settings (`/settings/appearance`): all 15 themes as live preview cards applyable per building; custom theme creator (8 hex tokens, rest derived + contrast-nudged, WCAG AA validation with warn-on-save via the SAME shared pair list as the build gate); typography slots + woff2 upload; persisted in `foct-theme-builder-v1` mirroring the authored-but-not-yet-run `supabase/migrations/0001_theme_engine.sql` (+pgTAP test). Variant status unchanged underneath: Nature & Glass finalists, other option-* frozen, final pick still open.
**OWNER MODULE PRIORITY ORDER (recorded 2026-07-07, verbatim intent):**
1. **Service Desk + Kiosk sign-in (Expo app or React, Android, QR sign-in) + Timesheets** — "most important is complete flow for ticket system and cleaners kiosk sign in and timesheet making automatic"
2. Concierge Desk — for raising tickets
3. Calendar
4. Tasks & incidents — cleaners work them, concierge can also assign
5. Site audits
6. Rosters (full management UX; minimal roster data lands earlier because automatic timesheets need rostered hours for variance)
7. Contractors
8. Floor plans
9. Parcels
10. Automation set
**Stage 2 platform foundation: AUTHORED + LOCALLY VERIFIED (2026-07-07); awaiting the owner's one-paste apply.** Plan confirmed; PWA-first kiosk locked in; Supabase project supplied (Sydney) but unreachable from this build env (proxy blocks *.supabase.co) → migrations validated on a local PG16 cluster (23/23 RLS isolation assertions pass). Owner applies `supabase/APPLY_STAGE2.sql` in the SQL editor then runs `supabase/tests/isolation_check.sql` (see supabase/README.md). Next: Stage 3 — Service Desk store→Supabase swap + public intake + notifications + PDF.
History: Stage 1 → 1.5 premium upgrade + screens → 1.6 TailAdmin restyle (indigo) → 1.7 owner-reference restyle (ink `#101828` buttons + teal `#0e7569` links, uppercase micro-labels, dashboard hero with LiveClock/weather/donut/activity feed/locked camera wall, per-shift timesheets, LIGHT Deputy-style kiosk) → 1.8 variant rounds (DECISIONS.md 2026-07-03 → 2026-07-06 entries): A Analytics, B Blush, C Slate, D Sunset (**current review default**), E Violet, G Nightfall, H Garden, and the three Google-Stitch-derived I Nature, J Cyber (mono display + neon glow), K Glass (violet mesh). F Cobalt deleted at owner direction. Fonts: Bricolage Grotesque + Onest + Roboto Mono. Live preview artifact with PALETTE switcher: https://claude.ai/code/artifact/ccade632-a546-4a3a-a90b-75d0039def15 (regenerate with scratchpad assemble script). **Gate: owner picks one variant → it folds into the permanent default, all other `option-*` blocks are deleted. Do not start Stage 2 until then.**

## What exists (sessions of 2026-07-02)

### Token system — `src/styles/tokens.css`
- Five themes (Graphite default, Harbour, Eucalypt, Sandstone, Ink) as `data-theme` sets; semantic tokens only, mapped to Tailwind v4 utilities in `src/app/globals.css` (stock palette/text sizes disabled).
- Stage 1.5/1.6 additions: `--sidebar-*` family (light rail in light themes, dark in Ink), `--info` status family, 72px `hero` type size; scale bumped (body 16, tables 14, page titles 36), radius 16/12/8, controls 44px. Graphite = cool gray ramp + indigo `#465fff` (TailAdmin reference), and is the app-shell theme.
- `design/tokens.md`: every token with reference, shadcn-name mapping, and **generated** WCAG tables — 37 pairs × 5 themes, 185 rows, all passing (`npm run check:contrast`, `--md` to regenerate).

### Fonts
**Owner-approved library only** (CLAUDE.md → Typography, updated 2026-07-06). Shipping: **Bricolage Grotesque** (headings + big bold numerals incl. kiosk clock, 700–800), **Onest** (body 400/500, from the owner's Datify reference), Roboto Mono (table timestamps/IDs only; "SF Mono" Apple fallback). All self-hosted in `src/fonts/`. Review build opens in `option-sunset` (warm) instead of grey graphite. Alternates on npm: Mona Sans, DM Sans, Finlandica, Radio Canada, Hubot Sans, Manrope. Retired font files still in repo — safe to prune.

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
- `/service-desk` + `/service-desk/new` — Service Desk ticketing, **FUNCTIONAL client-side** (Zustand store + localStorage; full lifecycle create→assign→attend→close-with-proof-photos→reopen→CSAT, internal notes, live follower emails, real photo compression + thumbnails, live saved-view counts, reset-demo; e2e-verified with Playwright incl. reload persistence). Notifications/PDF are simulated timeline events until backend stages. PRD + gating: `docs/modules/SERVICE_DESK_PRD.md`.
- `/support` + `/support/new` + `/support/jobs` — Service Desk MOBILE surface (owner's Claude Design handoff; own `support` theme, red/ink). FUNCTIONAL: same Zustand store as the desktop queue — phone-created tickets appear on `/service-desk` (e2e-proven). Tap-only 2-step create with camera photos; cleaner attend/complete with after-photo gate.
- `/kiosk` — full-screen LIGHT kiosk (Deputy-style): live 72px clock, teal welcome pill, white keypad card, Welcome-by-name on known PIN (demo PINs 1234/2345/3456), huge check-in/out buttons, site note, success screen with auto-reset.
- `/design-preview` — Stage 1 acceptance page, now including the new operational components; theme switcher + compare-all mode.

### Verified this session
`check:tokens` ✓, `check:contrast` ✓ (37 pairs × 15 themes — 5 permanent + 10 review variants; checker now merges `:root` structural-hook defaults), `tsc` ✓, `next build` ✓, Nature + Glass finalist rebuilds screenshotted and visually verified (borderless sage tiles / frosted mesh glass, true ring donut). New structural hooks: `--card-border` (+ `border-cardline` on Card), `--sidebar-active-bg/fg` (active-nav pill) — defaults keep every other theme pixel-identical.

## Migrations applied
Authored + locally verified, pending owner's dashboard apply: `0000_platform_foundation.sql`, `0001_theme_engine.sql`, `seed.sql` (see supabase/README.md).

## Exact next steps
1. **Owner applies `supabase/APPLY_STAGE2.sql`** in the SQL editor + runs `tests/isolation_check.sql` (expect 23 ok-notices) — supabase/README.md. **Gate for anything that touches live data.**
2. Stage 3 (Service Desk end-to-end): swap the Service Desk store internals to Supabase (screens unchanged), public QR intake route, Storage photos, Realtime, Resend email adapter, PDF job, concierge ticket surface.
3. Stage 4: kiosk PWA (offline queue) + automatic timesheets + minimal roster CRUD + missed check-in alerts.
4. Then the owner's order: Calendar → Tasks & incidents → Site audits → full Rosters → Contractors → Floor plans → Parcels → Automation.

## HANDOVER (half-finished / risky)
- **Service Desk is the ONLY functional module** (client-side store, `foct-sd-demo-v1` in localStorage — clears with browser data; notifications/PDF simulated). All other screens remain static demos.
- **All Stage 1.5 screens are static demos.** Buttons like "Approve", "Reassign zone", "Add shift" show toasts or nothing — no persistence. Kiosk PINs are a hardcoded demo map in `kiosk-screen.tsx`. Do not mistake these for working features.
- **Sidebar is desktop-only** (`hidden lg:flex`); no mobile nav drawer yet.
- **Roster week view fabricates non-today days** from today's data (visual demo of the board layout only).
- **Timesheets "Approve all ready" / per-row Approve don't change row state** — toast only.
- **No ESLint config, no CI** — `check:tokens` + `check:contrast` + `tsc` are the gates; wire into CI in Stage 2.
- **Drawer/Modal animations are minimal** (no enter/exit keyframes; Tailwind v4 has no stock animate utilities). Add `tw-animate-css` or keyframes if transitions feel abrupt.
- Design-preview's app-shell section still shows the old inline Sidebar usage (button items, no hrefs) — intentional for isolated preview, but it means the preview shell and the real `AppShell` are separate compositions.
