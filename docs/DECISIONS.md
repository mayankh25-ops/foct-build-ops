# DECISIONS

> Any deviation from CLAUDE.md, and any significant technical choice, goes here with date and reason.

## 2026-07-02 — CLAUDE.md filename
Uploaded file was `claude.md.txt` wrapped in a markdown code fence with CRLF endings. Renamed to `CLAUDE.md`, stripped fence, normalised to LF. Content unchanged.

## 2026-07-02 — Tailwind v4 (CSS-first config)
Chose Tailwind v4 over v3. Its `@theme` layer maps semantic CSS variables straight into utilities (`bg-surface`, `text-fg`, `rounded-card`) with no colour duplication in a JS config. The stock palette and stock text sizes are disabled (`--color-*: initial`, `--text-*: initial` in `globals.css`), so raw colour utilities like `bg-blue-500` and ad-hoc sizes don't even exist — the no-raw-hex rule is structural, not just linted.

## 2026-07-02 — Radix UI primitives for interactive components
Select, Tabs, Modal (Dialog), Toast are built on unstyled Radix primitives for correct focus management, keyboard navigation, and ARIA. All visuals are ours via semantic tokens. Simpler components are hand-rolled. Note: the Select content is intentionally **not** portalled so it inherits the `data-theme` scope it was opened in (needed for the side-by-side preview and harmless in-app); Modal/Toast are portalled and accept `data-theme` pass-through when scoped theming is needed.

## 2026-07-02 — Fonts: self-hosted; General Sans is a drop-in slot
All fonts self-host (no CDN flicker, kiosk-friendly offline). Hanken Grotesk woff2 vendored from `@fontsource-variable/hanken-grotesk` into `src/fonts/`, loaded with `next/font/local`. Geist Mono via Vercel's `geist` package (bundles woff2). **General Sans could not be fetched this session**: it is not on npm, Fontshare/its CDN are blocked by the session network policy, and GitHub access is scoped to this repo only. It ships as a manual `@font-face` in `globals.css` pointing at `public/fonts/general-sans/GeneralSans-Variable.woff2` (see README there) so dropping the file in activates it with zero code change; until then headings use self-hosted Inter — CLAUDE.md's documented fallback ("Inter Display feel"). This is graceful: a missing font file 404s and falls back, whereas `next/font/local` would fail the build.

## 2026-07-02 — Semantic token set extended beyond CLAUDE.md's list
CLAUDE.md names 14 tokens; the shipped set adds: `--bg-hover`, `--border-strong` (inputs need a ≥3:1 boundary per WCAG 1.4.11; `--border-subtle` stays decorative), `--text-disabled` (explicitly non-AA, disabled controls only), `--text-on-accent`, `--accent-text` (links need ≥4.5:1, the solid accent is tuned for fills), `--*-subtle`/`--*-text` per status, `--overlay`, `--brand`, `--elevation-card/raised`, font/type-scale/radius primitives. Reasons: WCAG AA for every text/background pair forced the text/fill split; everything is documented in `design/tokens.md`.

## 2026-07-02 — Status text never sits on solid status colours
StatusPill/Badge use tinted `*-subtle` backgrounds with dark `*-text` — amber with white text can never reach 4.5:1, and the tinted style is calmer (Linear-like). Solid status colours are reserved for dots, icons, and the destructive button fill (`--critical` + white is verified AA).

## 2026-07-02 — Stage 1 scope: no backend wiring
Supabase, TanStack Query, Zustand, and Inngest are intentionally absent from `package.json`. Stage 1 is pure UI; adding them unconfigured would only create drift. They enter with Stage 2 (schema + RLS) per CLAUDE.md.

## 2026-07-02 — lucide-react for icons
One icon set, tree-shakeable, neutral style that suits the calm aesthetic. Icons always render with `aria-hidden` and inherit `currentColor` so they obey semantic tokens.

## 2026-07-02 — Contrast + raw-colour checks are scripts, not docs
`npm run check:contrast` parses `src/styles/tokens.css` (single source of truth) and fails below AA; its `--md` output is embedded in `design/tokens.md`, so the documented ratios are generated, never hand-typed. `npm run check:tokens` fails on any raw hex/rgb/hsl/oklch or stock Tailwind colour utility under `src/`. Both should run in CI when CI exists.

## 2026-07-02 (later) — "FOCT Premium Operations UI" visual upgrade (Stage 1.5)
Owner brief: the Stage 1 output read as a generic admin dashboard — too small, too text-heavy, not premium. Upgraded the visual system without changing the token architecture or the five CLAUDE.md themes:
- **Type scale up one notch across the board** (body 15→16, tables 13→14 minimum, page titles 24→36, plus a 72px `hero` size for the kiosk clock). All-caps micro-labels removed (table headers and eyebrows are now sentence case).
- **Deep sidebar rail** via a new `--sidebar-*` token family, tuned per theme (charcoal/navy/green-grey/umber), AA-verified like everything else. This is the single biggest "not-an-admin-template" move.
- **`--info` status family** (slate blue) added — the brief's status set needed an informational tone ("Ordered", "Requires Pro").
- **Radius/controls up**: cards 14→16px, controls 10→12px, buttons 36/44px, inputs 44px, table rows ~56px.
- The owner-supplied token names (background/foreground/card/muted/…, shadcn-style) were mapped onto the existing documented semantic set rather than renaming: same roles, and renaming would have destroyed the contrast-check/reference documentation for no visual gain. Mapping documented in design/tokens.md.

## 2026-07-02 (later) — Stage 1.5 demo screens ahead of Stage 2 backend
The visual brief required real screens (dashboard, kiosk, roster, timesheets, consumables, module access) to judge the design system operationally. Built them as static pages rendering exclusively from `src/lib/demo-data.ts` (Aurora on Collins cast) — no Supabase, no new modules beyond their packaging tiles. This front-runs Stage 3+ *layouts* only; every screen must be re-bound to real data and RLS in later stages. The kiosk PIN directory is an in-file demo map, clearly marked.

## 2026-07-02 (later) — Referenced design attachments not found
The brief referenced Figma/Octet/Google Stitch/Lovable design attachments "already provided in the project"; no such files exist in the repo. Direction was taken from CLAUDE.md's documented references (Apple HIG, Radix, Stripe/Linear calibre) and the brief's own style keywords. If those attachments exist elsewhere, add them to `design/` and we can tune against them.
