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

## 2026-07-03 — TailAdmin-inspired restyle (owner reference)
Owner rejected the Stage 1.5 look and pointed at the TailAdmin Figma community file as the direction. The Figma link and TailAdmin's demo sites are unreachable from this environment's network policy, so the restyle works from TailAdmin's well-known visual system (Untitled-UI-style gray ramp, white sidebar, vivid indigo `#465FFF`, bold stat numbers with trend chips, soft pill badges):
- **Graphite retuned** from warm-sand/graphite-blue to cool gray-50 canvas + indigo `#465fff` accent, and made the app-shell theme for the design review. Note: CLAUDE.md forbids "harsh admin-template blue"; the owner's explicit reference overrides — the indigo passes AA with white (4.8:1) and `--accent-text` uses the deeper `#3641f5` for small text. CLAUDE.md's Graphite description ("warm off-white… graphite-blue") is superseded by this entry.
- **Light sidebar rail in all light themes** (white, hairline border, `--accent-subtle` active pill); Ink keeps its dark rail for kiosks/night mode. The dark-rail experiment from earlier today is retired.
- **MetricCard restructured to the TailAdmin arrangement** (icon well top-left, trend chip top-right, label + big value below). Metric values now use the display face with `tabular-nums` instead of Geist Mono — mono stays for tables, timestamps and IDs per CLAUDE.md; large stat numbers read as data-display, not tabular data.
- **MiniBarChart** added (dependency-free, tokens-only, sr-only table for a11y) — dashboard now shows actual-vs-rostered hours for the week, a genuinely useful chart, not decoration.
- Contrast suite extended to 37 pairs × 5 themes (adds the active-pill pair); all pass.

## 2026-07-03 (later) — v3 "reference build" restyle: ink + teal, uppercase labels, light kiosk
Owner shared screenshots of their preferred FOCT build (plus Deputy references) and asked to change the design again. Applied:
- **Graphite accent split**: `--accent` is now ink `#101828` (primary buttons, e.g. "Approve week"), `--accent-text` is FOCT-family teal `#0e7569` (links, live signals, focus ring). Active nav pill is a neutral `--accent-subtle` well with dark text. Indigo `#465fff` retired.
- **Uppercase micro-labels return** (stat-card labels, page eyebrows, table headers, sidebar group titles with 0.06–0.08em tracking) — matches the reference; supersedes the earlier "fewer all-caps" call.
- **Dashboard rebuilt to the reference composition**: hero card (building + LIVE + ticking LiveClock + on-site/open/late chips + kiosk CTA), weather card (static sample data until an integration exists), cleaning-progress donut (CSS conic-gradient), uppercase stat row, live activity feed, camera wall as a **locked Automation Pro card** (dark tiles, no functionality — CLAUDE.md forbids building camera analytics beyond a shell).
- **Timesheets rebuilt per reference**: per-shift rows with avatar chips, scheduled date/time, check in/out, hours progress bar (x/y h), variance pills (Missing red / ±h amber / On time green), status chips; "Approve week" ink button.
- **Kiosk is now light** (Deputy-style): default light theme, white keypad card, teal "Clock in and out with ease" pill, "Welcome, {name}" once a known PIN is entered. Ink theme remains available for night mode but is no longer the kiosk default.
- Sidebar regrouped into Core / Cleaning / Concierge / Automation with locked items per module packaging; top bar now has org + building switchers, a "Preview build" chip, and identity. New components: Avatar, LiveClock.

## 2026-07-03 (later) — Three palette variants for owner selection
Owner supplied three colour-palette references and asked for quick variants to choose from. Added three temporary review-only theme blocks to tokens.css (`option-analytics`, `option-blush`, `option-slate`), all AA-verified (37 pairs × 8 themes pass). The live preview artifact has a PALETTE switcher (Current / A / B / C). Once one is chosen it gets folded into Graphite as the default skin and all `option-*` blocks are deleted — they must not ship.

## 2026-07-03 (later) — Typography switched to the Roboto family
Owner direction: "Roboto family — light, ultralight, dark by category, or SF Mono." Implemented:
- **Roboto variable (100–900)** self-hosted for both display and body; hierarchy now comes from weight, not family: hero 200, display/title-1 300, title-2 400, title-3/labels/buttons 500, body 400. Semibold usages retuned to medium (Roboto 600+ reads heavy).
- **Roboto Mono variable** for all numerics/timestamps/IDs; `"SF Mono"` is next in the fallback stack so Apple hardware uses it natively — SF Mono itself is Apple-proprietary and cannot legally be bundled.
- Hanken Grotesk, Inter, and the Geist Mono package usage are retired from the stacks; the General Sans `@font-face` drop-in slot is removed (README left in `public/fonts/general-sans/` as history). CLAUDE.md's typography section (General Sans/Hanken/Geist) is superseded by this entry at owner direction.

## 2026-07-05 — Owner-approved font library + Mona Sans / DM Sans / Roboto Mono pairing
Owner supplied an approved font library (Finlandica, Mona Sans, Roboto, Radio Canada, Hubot Sans; reference set DM Sans, Satoshi, Inter, Manrope, General Sans) with standing rules: fonts only from this list for ALL work, big numbers big & thick, body line height 1.4–1.6. Written into CLAUDE.md → Typography (supersedes both the original spec and the Roboto-only pass from 2026-07-03). Shipping pairing: Mona Sans (headings + display numerals, 600–700 — the previous light-numeral ramp is inverted per the rule), DM Sans (body, 400/500), Roboto Mono (numerics, SF Mono fallback). Caption line height 18→19px to stay inside the band. Satoshi/General Sans remain unbundleable (Fontshare blocked); Finlandica/Radio Canada/Hubot Sans/Manrope are approved alternates available on npm.

## 2026-07-05 — Five more palette variants (D–H) from owner references
Owner found A/B/C (and the ink+teal default) "robotic, no human touch" and supplied five new references (Mangeo sunset brand, Booster violet+amber, Datify cobalt+blush, a navy/sky/gold scheme board, and a natural-greens CRM palette). Added five review-only themes, each with a warm/tinted canvas rather than sterile grey: `option-sunset` (cream + plum ink + burnt orange), `option-violet` (lilac + deep violet), `option-cobalt` (cool white + cobalt + blush wells), `option-nightfall` (navy ink + sky wells), `option-garden` (warm paper + charcoal + leaf green). All AA-verified (37 pairs × 13 themes). Same rule as A–C: the chosen one folds into the default, all other `option-*` blocks get deleted before Stage 2.

## 2026-07-06 — Bricolage Grotesque + Onest; Sunset becomes the review default
Owner: fonts still "automated machine fonts" — wants bold, big, clean, designer-recommended, and colours changed too. Actions:
- **Bricolage Grotesque** (display, weights to 800) added to the approved library and shipped for headings + all big numbers, including the kiosk clock (mono demoted to table timestamps/durations/IDs only). It is the closest free-font spirit to the Halvar Breitschrift energy in the owner's Mangeo reference.
- **Onest** (body) added and shipped — it appears by name in the owner's own Datify reference. Weight ramp now hero/display 800, title-1 700, title-2 700, title-3 650→600s, body 400/500.
- **Default theme for the review build switched from grey Graphite to `option-sunset`** (layout + AppShell) so the app no longer opens in the cool-grey look the owner reads as robotic. Final default still awaits the owner's A–H pick; graphite tokens remain untouched underneath.
- Mona Sans and DM Sans stay in the approved library as alternates; their font files remain vendored.

## 2026-07-06 (later) — Variant F (Cobalt) eliminated
Owner: "Delete F." `option-cobalt` removed from tokens.css, the contrast suite (now 37 pairs × 12 themes, all passing) and the preview switcher. Remaining candidates: A Analytics, B Blush, C Slate, D Sunset (current review default), E Violet, G Nightfall, H Garden.

## 2026-07-06 (later) — Three Google Stitch designs fitted as variants I / J / K
Owner supplied three complete Google Stitch HTML designs (Vibrant Glassmorphism, Soft Nature, Cyberpunk Dark) and asked to fit our software into them as closely as possible. Because every visual property in this system is a token, each design became a switchable theme block rather than a fork of the UI:
- **`option-nature` (I · Nature)** ← "Soft Nature": warm paper canvas `#f9f7f2`, sage/olive accent ramp (`#55684b` buttons, `#7d9070` brand), terracotta critical (`#b1502f`), and per-theme radius overrides (`--r-card: 1.75rem`, `--r-control: 1.25rem`) for the source's pillowy, extra-round look; soft green-tinted card shadow.
- **`option-cyber` (J · Cyber)** ← "Cyberpunk Dark": near-black canvas `#0a0a0c`, neon cyan accent `#00f2ff` with dark text-on-accent, purple `#bc13fe`-family brand/info, glow-style `--elevation-*` (cyan ring + bloom instead of drop shadow), a theme-scoped fixed radial cyan aurora on the canvas, and a per-theme `--font-stack-display` override to **Roboto Mono** — proving font voice is themeable per data-theme without touching components.
- **`option-glass` (K · Glass)** ← "Vibrant Glassmorphism": deep violet canvas `#241b3e` with a scoped 4-stop fixed mesh gradient (purple/pink/blue radials), tonal frosted-look surfaces, white primary buttons (`--accent: #f5f2ff`, dark text) and lavender link text.
Translation compromises (logged honestly): real `backdrop-filter` translucency is replaced by solid tonal equivalents so the WCAG checker's hex math stays valid; the sources' Quicksand/Poppins are not in the owner's approved library, so Nature/Glass keep Bricolage + Onest and Cyber uses Roboto Mono display via the token override. All AA-verified: 37 pairs × 15 themes pass. Same disposal rule as A–H: these are review-only and get deleted once the owner picks a winner. Candidate list is now A–E, G–K (ten).
