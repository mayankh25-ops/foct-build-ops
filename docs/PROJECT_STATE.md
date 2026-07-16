# PROJECT_STATE

> Read this first, every session. Update it before ending any session.

## Current stage
**Stage 4 Integrations framework: SHIPPED (2026-07-14, branch `claude/integrations-framework-plan-fhmyij`).** Dynamic, GUI-configured providers exactly per CLAUDE.md — nothing third-party hardcoded:
- **DB (0005 + APPLY_STAGE4_INTEGRATIONS.sql, awaiting owner paste):** catalogue rows now carry per-brand JSON Schemas; `integration_credentials` is Vault-backed, replace-only (DB trigger), one-active-per-scope (partial unique index), fully audit-logged (trigger); new `notification_log`; SECURITY DEFINER RPCs save/activate/deactivate/record_test/reveal (reveal = service_role ONLY). Proven on the local PG16 mirror: full-chain replay, double-run idempotency, APPLY bundle on a live-state mirror, **23 + 15 + 19 isolation assertions green** (`tests/integrations_isolation_check.sql`).
- **Adapters (`src/lib/integrations/`):** `EmailProvider` (Resend, Postmark, SendGrid, AWS SES v2 with dependency-free SigV4) + `SmsProvider` (Twilio, MessageMedia, ClickSend) — plain fetch, zero brand SDKs; API versions in DECISIONS.md (2026-07-14 table).
- **`notify()` (`src/lib/server/notify.ts`):** single door for all app sends — resolves the active credential per org/building (building-scoped wins), reveals secrets server-side, dispatches via the registry, records the handling provider in notification_log. Server routes `/api/integrations/test` + `/send-test` are DB-authorised via `public.can`.
- **GUI:** `/settings/integrations` (category tabs → brand cards → form auto-rendered from the JSON Schema → Test connection → save masked/replace-only → activate keeps old credential inactive → audit feed; Storage/Accounting/Push shown coming-soon) and `/settings/integrations/test` (real email/SMS through the active provider, provider + message id displayed, masked send log). Demo store persists ONLY masked values; live mode = `NEXT_PUBLIC_INTEGRATIONS_LIVE=1` + `SUPABASE_SECRET_KEY` (see supabase/README.md Stage 4). **Verified: 17/17 Playwright e2e** (schema render, secret masking, pattern rejection, test gate, switch flow, persistence) + all four gates green (tokens · 37×13 contrast · tsc · build, 21 routes).
- **Owner action:** paste `APPLY_STAGE4_INTEGRATIONS.sql`, run `integrations_isolation_check.sql` (expect 19 ok), then add real provider keys via the GUI on your machine and use "Send a test".

**UX wave 2026-07-15 (owner tasks, same branch):** create forms now open as BIG centred modals (`ModalContent size="lg"`; calendar Add event + desk Raise ticket — /service-desk/new stays for QR links via the shared `RaiseTicketForm`); the calendar gained RECURRING events (daily/weekly/fortnightly/monthly + weekday picker + until), start/finish times, contact phone (tap-to-call), a maintenance category, role-scoped visibility (everyone/admin/BM/cleaning/concierge via "Viewing as" stand-in) and admin-LOCKED events others can't alter (store helpers mirror future RLS); `/support` now follows the portal's active theme instead of the pinned red `support` theme. 16/16 e2e + all gates green. Backend note: visibility/lock/recurrence columns join the calendar tables at the calendar backend stage.

## Previous stage
**Stage 1.5 Theme Builder: SHIPPED (2026-07-07).** Appearance settings (`/settings/appearance`): all 15 themes as live preview cards applyable per building; custom theme creator (8 hex tokens, rest derived + contrast-nudged, WCAG AA validation with warn-on-save via the SAME shared pair list as the build gate); typography slots + woff2 upload; persisted in `foct-theme-builder-v1` mirroring the authored-but-not-yet-run `supabase/migrations/0001_theme_engine.sql` (+pgTAP test). Variant status unchanged underneath: Nature & Glass finalists, other option-* frozen, final pick still open.
## Previous stage detail
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
**Stage 2: APPLIED to the owner's Supabase (confirmed "applied, 23 ok", 2026-07-07). Stage 3 part 1 SHIPPED: Service Desk backend (0002 + seed + intake RPC) authored + locally verified (15/15 sd isolation assertions); awaiting owner's APPLY_STAGE3 paste. App live-mode behind NEXT_PUBLIC_SD_LIVE=1 (+ /sign-in); local demo store remains default.** Plan confirmed; PWA-first kiosk locked in; Supabase project supplied (Sydney) but unreachable from this build env (proxy blocks *.supabase.co) → migrations validated on a local PG16 cluster (23/23 RLS isolation assertions pass). Owner applies `supabase/APPLY_STAGE2.sql` in the SQL editor then runs `supabase/tests/isolation_check.sql` (see supabase/README.md). Next: Stage 3 — Service Desk store→Supabase swap + public intake + notifications + PDF.
History: Stage 1 → 1.5 premium upgrade + screens → 1.6 TailAdmin restyle (indigo) → 1.7 owner-reference restyle (ink `#101828` buttons + teal `#0e7569` links, uppercase micro-labels, dashboard hero with LiveClock/weather/donut/activity feed/locked camera wall, per-shift timesheets, LIGHT Deputy-style kiosk) → 1.8 variant rounds (DECISIONS.md 2026-07-03 → 2026-07-06 entries): A Analytics, B Blush, C Slate, D Sunset (**current review default**), E Violet, G Nightfall, H Garden, and the three Google-Stitch-derived I Nature, J Cyber (mono display + neon glow), K Glass (violet mesh). F Cobalt deleted at owner direction. Fonts: Bricolage Grotesque + Onest + Roboto Mono. Live preview artifact with PALETTE switcher: https://claude.ai/code/artifact/ccade632-a546-4a3a-a90b-75d0039def15 (regenerate with scratchpad assemble script). **Gate: owner picks one variant → it folds into the permanent default, all other `option-*` blocks are deleted. Do not start Stage 2 until then.**

## What exists (sessions of 2026-07-02)

### Token system — `src/styles/tokens.css`
- Five themes (Graphite default, Harbour, Eucalypt, Sandstone, Ink) as `data-theme` sets; semantic tokens only, mapped to Tailwind v4 utilities in `src/app/globals.css` (stock palette/text sizes disabled).
- Stage 1.5/1.6 additions: `--sidebar-*` family (light rail in light themes, dark in Ink), `--info` status family, 72px `hero` type size; scale bumped (body 16, tables 14, page titles 36), radius 16/12/8, controls 44px. Graphite = cool gray ramp + indigo `#465fff` (TailAdmin reference), and is the app-shell theme.
- `design/tokens.md`: every token with reference, shadcn-name mapping, and **generated** WCAG tables — 37 pairs × 5 themes, 185 rows, all passing (`npm run check:contrast`, `--md` to regenerate).

### Fonts
**REWRITTEN 2026-07-10 (owner direction — Power BI / Zendesk / Freshdesk reference; see CLAUDE.md → Typography).** UI text (display + body) = the **native system font stack** (Zendesk's exact stack: SF on Mac, Segoe UI on Windows, Roboto on Android — zero webfont downloads for text). Numbers (metric values, clocks, callouts) = **Barlow 600–800** (free DIN-alike per Power BI's DIN data labels; `--font-stack-numeric` / `font-numeric` utility; "DIN Alternate" macOS fallback next in stack). Roboto Mono for timestamps/IDs only. Segoe UI / SF / DIN are proprietary — never bundle; the stack IS the implementation. Bricolage, Onest, Mona Sans, DM Sans, Inter, Roboto remain vendored in `src/fonts/` as Theme Builder alternates (preload:false). Theme Builder default slots: system-ui / system-ui / roboto-mono.

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
- `/scope` — **Scope (added 2026-07-10, owner's "Aurora Scope Explorer" upload) — PART OF THE SERVICE DESK SUITE (owner clarification same day): the Subzero phone screens = the phone app (`/support`), this explorer = the admin dashboard view; nav entry sits directly under Service desk.** Contract-scope analytics over `src/lib/scope-data.ts` (dataset reconciles to 393.0 h/wk, 222+16 items, 60.0/46.5 day totals; renamed to demo cast). Five tabs: Overview / Scope explorer (entity pills + frequency filter) / Weekly roster (expandable shift drawers) / Day gantt (weekday-weekend toggle, hover tooltips, night-security band) / Periodic planner (12-month due grid). Read-only; every colour is a theme token — the red frequency ramp is color-mix'd from `--critical` so it re-tints per theme.
- `/kiosk` — full-screen LIGHT kiosk (Deputy-style): live 72px clock, teal welcome pill, white keypad card, Welcome-by-name on known PIN (demo PINs 1234/2345/3456), huge check-in/out buttons, site note, success screen with auto-reset.
- `/design-preview` — Stage 1 acceptance page, now including the new operational components; theme switcher + compare-all mode.

### Verified this session
`check:tokens` ✓, `check:contrast` ✓ (37 pairs × 15 themes — 5 permanent + 10 review variants; checker now merges `:root` structural-hook defaults), `tsc` ✓, `next build` ✓, Nature + Glass finalist rebuilds screenshotted and visually verified (borderless sage tiles / frosted mesh glass, true ring donut). New structural hooks: `--card-border` (+ `border-cardline` on Card), `--sidebar-active-bg/fg` (active-nav pill) — defaults keep every other theme pixel-identical.

### Session 2026-07-10 (latest) — dashboard fully live + calendar reminders
- Dashboard: live Open-Meteo weather, due-today/this-week card from the calendar, Team handover notes (persisted, org-private), SD open-by-status chart. Calendar Add-job now takes an email reminder (queued visibly; sends via email adapter at backend stage).

### Session 2026-07-10 (later) — roadmap wave 1: five functional modules
- **Attendance flow LIVE end-to-end**: kiosk PIN check-in/out (demo PINs 1234/2345/3456/4567/5678/6789) → `attendance-store` events → roster statuses/timesheets/missed alerts/dashboard all derive. Approve week persists; CSV export real.
- **/portfolio** exception-first multi-building view (Aurora live, 7 seeded).
- **/calendar** periodic works from Scope data + Add job (persisted).
- **Scope → Quote studio** workloading/machines/award pricing calculator.
- **/concierge** raise-to-shared-desk tickets + parcels + private handover notes.
- Roadmap: docs/PRODUCT_ROADMAP.md. All e2e-verified via Playwright.

### Session 2026-07-10 — fonts overhaul + Scope module + Subzero theme
- Typography system swapped to system-stack UI text + Barlow DIN-style numerals (see Fonts section above; DECISIONS 2026-07-10).
- `subzero` theme added (12th tokens.css block, red-on-black from the owner's Scope design; in BUILTIN_THEMES, contrast gate now 37 pairs × 12 themes, all AA).
- `/scope` module shipped and screenshot-verified under Nature AND Subzero (whole portal re-tints; Nature remains default via theme-store).
- Gates all green: `check:tokens` ✓ · `check:contrast` (37×12) ✓ · `tsc` ✓ · `next build` ✓ (19 static routes). Preview artifact refreshed at the same URL (13 pages, Subzero in the palette switcher).

## Migrations applied
Authored + locally verified, pending owner's dashboard apply: `0000_platform_foundation.sql`, `0001_theme_engine.sql`, `seed.sql` (see supabase/README.md).

## Exact next steps
1. **Owner applies `supabase/APPLY_STAGE4_INTEGRATIONS.sql`** in the SQL editor + runs `tests/integrations_isolation_check.sql` (expect 19 ok-notices) — supabase/README.md Stage 4. Then add real provider keys via `/settings/integrations` on a machine with `.env.local` set (SUPABASE_SECRET_KEY + NEXT_PUBLIC_INTEGRATIONS_LIVE=1) and prove a real send on the test page.
2. Wire existing queued sends through `notify()`: calendar email reminders (currently a visible outbox), Service Desk follower emails + missed check-in alerts (Inngest stage).
3. Ticketing import step 2 (per TICKETING_IMPORT_PLAN): 0006 offline-ref renumber trigger + billing fields, PDF+email report port (email goes via notify()), billing lock screen, insights charts.
4. Kiosk PWA offline queue polish + minimal roster CRUD; then the owner's order: Tasks & incidents → Site audits → full Rosters → Contractors → Floor plans → Parcels → Automation.

## HANDOVER (half-finished / risky)
- **Service Desk is the ONLY functional module** (client-side store, `foct-sd-demo-v1` in localStorage — clears with browser data; notifications/PDF simulated). All other screens remain static demos.
- **All Stage 1.5 screens are static demos.** Buttons like "Approve", "Reassign zone", "Add shift" show toasts or nothing — no persistence. Kiosk PINs are a hardcoded demo map in `kiosk-screen.tsx`. Do not mistake these for working features.
- **Sidebar is desktop-only** (`hidden lg:flex`); no mobile nav drawer yet.
- **Roster week view fabricates non-today days** from today's data (visual demo of the board layout only).
- **Timesheets "Approve all ready" / per-row Approve don't change row state** — toast only.
- **No ESLint config, no CI** — `check:tokens` + `check:contrast` + `tsc` are the gates; wire into CI in Stage 2.
- **Drawer/Modal animations are minimal** (no enter/exit keyframes; Tailwind v4 has no stock animate utilities). Add `tw-animate-css` or keyframes if transitions feel abrupt.
- Design-preview's app-shell section still shows the old inline Sidebar usage (button items, no hrefs) — intentional for isolated preview, but it means the preview shell and the real `AppShell` are separate compositions.
- **Integrations (Stage 4) caveats:** live sends are UNTESTED against real provider accounts (this env can't reach the internet beyond the proxy, nor *.supabase.co) — the adapters follow the documented APIs (DECISIONS 2026-07-14 table) but the first real key + "Send a test" run happens on the owner's machine. The GUI's org context in demo/live mode is pinned to the seed Meridian org (`DEMO_ORG_ID` in integrations-store) until real session-org plumbing lands. `integration_credential_save` records the PRE-SAVE test result as client-asserted (see DECISIONS); post-save tests are stamped server-side.
