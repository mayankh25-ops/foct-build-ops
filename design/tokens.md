# FOCT BuildingOps — Design Tokens

Source of truth: `src/styles/tokens.css`. Themes are token sets applied via
`data-theme="<name>"` on any element; components consume semantic tokens only
(enforced by `npm run check:tokens`). Contrast is verified by
`npm run check:contrast`, which parses the CSS so this document and the code
cannot drift; the tables at the bottom are that script's output (`--md` flag).

## Themes

| Theme | Personality | Neutral reference | Accent |
| --- | --- | --- | --- |
| **Graphite** (default) | Apple HIG neutral discipline, warm off-white | Radix Sand | Deep graphite-blue `#45556d` |
| **Harbour** | Melbourne CBD commercial, ink-navy on light grey | Radix Slate | Deep teal `#0e7568` (FOCT `#00b4a6` desaturated) |
| **Eucalypt** | ESG / green-building clients | Radix Sage | Muted eucalyptus green `#3e7a52` |
| **Sandstone** | Heritage / premium strata | Radix Sand, warmed | Restrained bronze `#82653f` |
| **Ink** | Dark: concierge night mode, kiosks | Radix Slate Dark | Teal `#3ecbbb`, brightened for dark surfaces |

All five share identical token names, spacing, radius, type scale, and status
hues — only ramp values change. Ink is the only dark set and never uses pure
black (canvas `#141517`).

## Colour tokens

References: **Radix** = Radix Colors scale step the value is taken from or
tuned within; **HIG** = the Apple Human Interface Guidelines semantic colour
the token plays the role of; **Material** = Material Design tonal-ramp
equivalent where useful.

### Name mapping (shadcn-style aliases)

For anyone arriving with shadcn/Tailwind-preset vocabulary, the roles map 1:1
onto our token set — we kept the documented names rather than renaming:

`background`→`--bg-canvas` · `card`→`--bg-surface` · `foreground`/`card-foreground`→`--text-primary` ·
`muted`→`--bg-hover` · `muted-foreground`→`--text-muted` · `border`→`--border-subtle` ·
`input`→`--border-strong` · `primary`→`--accent` · `primary-foreground`→`--text-on-accent` ·
`secondary`→`--bg-surface`+`--border-subtle` (secondary button) · `destructive`→`--critical` ·
`ring`→`--focus-ring` · `sidebar`/`sidebar-foreground`→`--sidebar-bg`/`--sidebar-fg` ·
`success`/`warning`/`info`→ same names.

### Backgrounds

| Token | Role | Reference |
| --- | --- | --- |
| `--bg-canvas` | Page background | Radix step 2 of each theme's neutral scale · HIG systemGroupedBackground · Material surface-container-lowest+ |
| `--bg-surface` | Cards, panels, nav | White in light themes (HIG systemBackground); Radix Slate Dark 2-family in Ink |
| `--bg-raised` | Popovers, modals, toasts | Same as surface in light themes (elevation via `--elevation-raised`); one step lighter in Ink (dark themes elevate by lightening, per Material elevation overlays) |
| `--bg-hover` | Hover fills, table-row hover, avatar/icon wells | Radix step 3 |

### Borders

| Token | Role | Reference |
| --- | --- | --- |
| `--border-subtle` | Card and divider hairlines (decorative) | Radix step 4 — decorative, intentionally below 3:1 like HIG separator |
| `--border-strong` | Input/select boundaries | Radix step 9 — the first step ≥ 3:1 against white, meets WCAG 1.4.11 non-text contrast |

### Text

| Token | Role | Reference |
| --- | --- | --- |
| `--text-primary` | Headings, primary content | Radix step 12 · HIG label |
| `--text-secondary` | Supporting copy | Tuned between Radix 11–12 · HIG secondaryLabel |
| `--text-muted` | Captions, hints, table headers | Radix step 11 (the lowest step Radix guarantees ≥ 4.5:1) · HIG tertiaryLabel |
| `--text-disabled` | Disabled controls only | Radix step ~8 · HIG quaternaryLabel — **exempt from AA by design** (WCAG 1.4.3 exempts inactive UI); never used for readable content |
| `--text-on-accent` | Text on solid accent/critical fills | White in light themes; near-black `#0c1211` in Ink (bright accent + dark label, Material dark on-primary pattern) |

### Accent

| Token | Role | Reference |
| --- | --- | --- |
| `--accent` | Primary buttons, active tab underline, dots | Theme accent (table above); every value holds ≥ 4.5:1 under `--text-on-accent` so primary buttons pass AA |
| `--accent-hover` | Primary button hover | One tone darker (lighter in Ink) |
| `--accent-subtle` | Selected nav, subtle badges, icon wells | Radix step 3-equivalent tint of the accent |
| `--accent-text` | Links, selected-item text | Accent deepened until ≥ 4.5:1 on canvas/surface/subtle (Radix step 11 role) |
| `--brand` | FOCT signal teal `#00b4a6`, **brand moments only, never text** (logo dot, hero flourish). Aliases `--accent` outside Harbour/Ink | Brand palette |

### Status

Status text never sits on the solid status colour: pills use
`*-subtle` + `*-text` (calmer, and amber-with-white-text can never pass AA).
Solid values are for dots, icons, and the destructive button fill.

| Token | Role | Reference |
| --- | --- | --- |
| `--success` / `--success-subtle` / `--success-text` | Muted green | Radix Grass family, low chroma |
| `--warning` / `--warning-subtle` / `--warning-text` | Amber | Radix Amber family; solid is non-text-use only |
| `--critical` / `--critical-hover` / `--critical-subtle` / `--critical-text` | Restrained red; `--critical` doubles as destructive-button fill (AA with white, verified) | Radix Red family, desaturated |
| `--info` / `--info-subtle` / `--info-text` | Slate blue — informational status ("Ordered", packaging tiers) | Radix Blue family, desaturated |

### Sidebar (deep rail)

Every theme ships a deep-toned navigation rail (`--sidebar-*` family) so the
app shell reads premium-operations rather than light-admin. Values are tuned
per theme (graphite charcoal / harbour navy / eucalypt green-grey / sandstone
umber / ink one-step-off-canvas); all text pairs are AA-verified below.

| Token | Role |
| --- | --- |
| `--sidebar-bg` / `--sidebar-hover` | Rail background and hover/active fill |
| `--sidebar-fg` / `--sidebar-muted` | Item text; secondary/disabled item text (≥ 4.5:1 on the rail) |
| `--sidebar-active` | Active-item indicator bar and accent text, brightened for the dark rail |
| `--sidebar-border` | Footer hairline inside the rail |

### Other

| Token | Role | Reference |
| --- | --- | --- |
| `--focus-ring` | 2px offset outline on `:focus-visible` (global rule in `globals.css`) | Theme accent; ≥ 3:1 on canvas + surface per WCAG 1.4.11 |
| `--overlay` | Modal scrim | Neutral ink at 45 % (60 % black in Ink) |
| `--elevation-card` / `--elevation-raised` | Shadows: very soft for cards, fuller for popovers/modals | HIG-style soft shadows; heavier + darker in Ink |

## Typography

| Slot | Font | Loading |
| --- | --- | --- |
| Display / headings | **General Sans** | `@font-face` in `globals.css` from `/public/fonts/general-sans/` — drop-in slot (see README there; Fontshare unreachable from the build env). Falls back to self-hosted **Inter** (variable, `next/font/local`) until the files land — the documented "Inter Display feel" fallback. |
| Body / UI | **Hanken Grotesk** | Self-hosted variable woff2 (normal + italic), `next/font/local`, `--font-hanken` |
| Numerics, timestamps, IDs, table figures | **Geist Mono** | Vercel `geist` package (bundles woff2 locally), `--font-geist-mono`. **Only** for numeric/tabular data; `.font-mono` sets `font-variant-numeric: tabular-nums` |

### Type scale

No ad-hoc font sizes in components — only these utilities (Tailwind
`text-<name>` mapped in `globals.css`).

| Name | Size / line height | Tracking | Weight | Use |
| --- | --- | --- | --- | --- |
| `hero` | 72 px / 1 | −0.02em | 600 | Kiosk clock only |
| `display` | 36 / 44 px | −0.02em | 600 | Page titles (`PageHeader`), metric numbers |
| `title-1` | 28 / 36 px | −0.015em | 600 | Section titles, kiosk buttons |
| `title-2` | 22 / 30 px | −0.01em | 600 | Modal/drawer titles, `SectionHeader` |
| `title-3` | 17 / 25 px | −0.005em | 600 | Card titles |
| `body` | 16 / 24 px | 0 | 400 | Default UI text, inputs, buttons (md) |
| `body-sm` | 14 / 20 px | 0 | 400 | Tables (never smaller), secondary copy, buttons (sm) |
| `caption` | 13 / 18 px | +0.005em | 400–500 | Labels, hints, badges |

Table headers are sentence case (`text-body-sm font-medium text-fg-muted`) —
no all-caps tracking-wide micro-labels anywhere in the system.

## Spacing, radius, elevation

- **8px grid** via Tailwind's default 4px scale — components use even steps
  (`gap-2`, `p-4`, `p-6`…); 4px half-steps only for icon-to-label gaps.
- Radius: `--r-card` 16px (cards, modals, toasts, kiosk controls),
  `--r-control` 12px (buttons, inputs, nav items), `--r-sm` 8px (badges, menu
  items), `--r-pill` for StatusPill/avatars.
- Control heights: buttons 36px (sm) / 44px (md), inputs/selects 44px,
  kiosk touch targets ≥ 64px (keypad) and ≥ 88px (`KioskButton`).
- Table rows ≈ 56px (py-4 on 14px text); page padding 24–40px; card padding
  24px; dashboard grid gaps 16–24px.
- Max **2 accent-coloured elements per view** (design rule, reviewed at the
  preview gate — not machine-enforced).

## WCAG AA contrast — verified pairs

Generated by `node scripts/check-contrast.mjs --md`. Requirements: 4.5:1 for
text (WCAG 2.1 AA 1.4.3), 3:1 for non-text UI boundaries and focus indicators
(1.4.11). CI fails if any pair drops below its requirement.

<!-- BEGIN GENERATED CONTRAST TABLES -->
### Graphite

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #21201c | `--bg-canvas` #f9f9f8 | 15.48:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #21201c | `--bg-surface` #ffffff | 16.30:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #21201c | `--bg-raised` #ffffff | 16.30:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #21201c | `--bg-hover` #f1f0ef | 14.32:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #54534d | `--bg-canvas` #f9f9f8 | 7.32:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #54534d | `--bg-surface` #ffffff | 7.72:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #54534d | `--bg-raised` #ffffff | 7.72:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #54534d | `--bg-hover` #f1f0ef | 6.78:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #63635e | `--bg-canvas` #f9f9f8 | 5.73:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #63635e | `--bg-surface` #ffffff | 6.04:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #63635e | `--bg-raised` #ffffff | 6.04:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #63635e | `--bg-hover` #f1f0ef | 5.31:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #3e4e64 | `--bg-canvas` #f9f9f8 | 8.04:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #3e4e64 | `--bg-surface` #ffffff | 8.47:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #45556d | 7.57:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #3a4859 | 9.33:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #c24242 | 5.06:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #a93636 | 6.43:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #256b44 | `--success-subtle` #e7f3eb | 5.64:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #256b44 | `--bg-surface` #ffffff | 6.43:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #8a6002 | `--warning-subtle` #f9f0dc | 4.93:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #8a6002 | `--bg-surface` #ffffff | 5.59:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #b03030 | `--critical-subtle` #faeceb | 5.51:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #b03030 | `--bg-surface` #ffffff | 6.34:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #33608f | `--info-subtle` #e8eff7 | 5.64:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #33608f | `--bg-surface` #ffffff | 6.54:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #3e4e64 | `--accent-subtle` #edf1f5 | 7.46:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #eceef1 | `--sidebar-bg` #1f2227 | 13.72:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #eceef1 | `--sidebar-hover` #2b2f36 | 11.56:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #a2a9b3 | `--sidebar-bg` #1f2227 | 6.73:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #a3b8da | `--sidebar-bg` #1f2227 | 7.92:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #a3b8da | `--sidebar-hover` #2b2f36 | 6.67:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--border-strong` #8d8d86 | `--bg-surface` #ffffff | 3.34:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8d8d86 | `--bg-canvas` #f9f9f8 | 3.17:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #45556d | `--bg-canvas` #f9f9f8 | 7.19:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #45556d | `--bg-surface` #ffffff | 7.57:1 | 3:1 | ✅ | focus ring (non-text) |

### Harbour

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #1b2532 | `--bg-canvas` #f9f9fb | 14.71:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1b2532 | `--bg-surface` #ffffff | 15.47:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1b2532 | `--bg-raised` #ffffff | 15.47:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1b2532 | `--bg-hover` #f0f0f3 | 13.60:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #414d63 | `--bg-canvas` #f9f9fb | 8.10:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #414d63 | `--bg-surface` #ffffff | 8.51:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #414d63 | `--bg-raised` #ffffff | 8.51:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #414d63 | `--bg-hover` #f0f0f3 | 7.49:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #566276 | `--bg-canvas` #f9f9fb | 5.87:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #566276 | `--bg-surface` #ffffff | 6.17:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #566276 | `--bg-raised` #ffffff | 6.17:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #566276 | `--bg-hover` #f0f0f3 | 5.42:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #0b6357 | `--bg-canvas` #f9f9fb | 6.80:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #0b6357 | `--bg-surface` #ffffff | 7.15:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #0e7568 | 5.58:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #0b5f55 | 7.55:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #c24242 | 5.06:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #a93636 | 6.43:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #256b44 | `--success-subtle` #e7f3eb | 5.64:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #256b44 | `--bg-surface` #ffffff | 6.43:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #8a6002 | `--warning-subtle` #f9f0dc | 4.93:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #8a6002 | `--bg-surface` #ffffff | 5.59:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #b03030 | `--critical-subtle` #faeceb | 5.51:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #b03030 | `--bg-surface` #ffffff | 6.34:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #33608f | `--info-subtle` #e8eff7 | 5.64:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #33608f | `--bg-surface` #ffffff | 6.54:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #0b6357 | `--accent-subtle` #e4f2f0 | 6.22:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #eef2f3 | `--sidebar-bg` #12212b | 14.58:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #eef2f3 | `--sidebar-hover` #1e3140 | 11.88:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #9aacb5 | `--sidebar-bg` #12212b | 7.00:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #56c9ba | `--sidebar-bg` #12212b | 8.18:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #56c9ba | `--sidebar-hover` #1e3140 | 6.67:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--border-strong` #8b8d98 | `--bg-surface` #ffffff | 3.30:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8b8d98 | `--bg-canvas` #f9f9fb | 3.14:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #0e7568 | `--bg-canvas` #f9f9fb | 5.31:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #0e7568 | `--bg-surface` #ffffff | 5.58:1 | 3:1 | ✅ | focus ring (non-text) |

### Eucalypt

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #1a211e | `--bg-canvas` #f7f9f7 | 15.50:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1a211e | `--bg-surface` #ffffff | 16.40:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1a211e | `--bg-raised` #ffffff | 16.40:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #1a211e | `--bg-hover` #eef1ef | 14.42:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a544e | `--bg-canvas` #f7f9f7 | 7.44:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a544e | `--bg-surface` #ffffff | 7.87:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a544e | `--bg-raised` #ffffff | 7.87:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a544e | `--bg-hover` #eef1ef | 6.92:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f6563 | `--bg-canvas` #f7f9f7 | 5.63:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f6563 | `--bg-surface` #ffffff | 5.95:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f6563 | `--bg-raised` #ffffff | 5.95:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f6563 | `--bg-hover` #eef1ef | 5.23:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #356947 | `--bg-canvas` #f7f9f7 | 6.08:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #356947 | `--bg-surface` #ffffff | 6.44:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #3e7a52 | 5.11:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #336545 | 6.80:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #c24242 | 5.06:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #a93636 | 6.43:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #256b44 | `--success-subtle` #e7f3eb | 5.64:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #256b44 | `--bg-surface` #ffffff | 6.43:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #8a6002 | `--warning-subtle` #f9f0dc | 4.93:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #8a6002 | `--bg-surface` #ffffff | 5.59:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #b03030 | `--critical-subtle` #faeceb | 5.51:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #b03030 | `--bg-surface` #ffffff | 6.34:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #33608f | `--info-subtle` #e8eff7 | 5.64:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #33608f | `--bg-surface` #ffffff | 6.54:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #356947 | `--accent-subtle` #e9f2ec | 5.63:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #edf1ee | `--sidebar-bg` #1b231d | 14.12:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #edf1ee | `--sidebar-hover` #273329 | 11.57:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #a0ada3 | `--sidebar-bg` #1b231d | 6.90:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #8cc7a0 | `--sidebar-bg` #1b231d | 8.27:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #8cc7a0 | `--sidebar-hover` #273329 | 6.78:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--border-strong` #868e8b | `--bg-surface` #ffffff | 3.36:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #868e8b | `--bg-canvas` #f7f9f7 | 3.17:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #3e7a52 | `--bg-canvas` #f7f9f7 | 4.83:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #3e7a52 | `--bg-surface` #ffffff | 5.11:1 | 3:1 | ✅ | focus ring (non-text) |

### Sandstone

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #24211b | `--bg-canvas` #faf8f4 | 15.13:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #24211b | `--bg-surface` #ffffff | 16.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #24211b | `--bg-raised` #ffffff | 16.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #24211b | `--bg-hover` #f2efe9 | 13.99:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #565147 | `--bg-canvas` #faf8f4 | 7.43:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #565147 | `--bg-surface` #ffffff | 7.88:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #565147 | `--bg-raised` #ffffff | 7.88:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #565147 | `--bg-hover` #f2efe9 | 6.87:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #6a645a | `--bg-canvas` #faf8f4 | 5.53:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #6a645a | `--bg-surface` #ffffff | 5.86:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #6a645a | `--bg-raised` #ffffff | 5.86:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #6a645a | `--bg-hover` #f2efe9 | 5.11:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #755a33 | `--bg-canvas` #faf8f4 | 6.06:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #755a33 | `--bg-surface` #ffffff | 6.43:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #82653f | 5.41:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #6f5636 | 6.86:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #c24242 | 5.06:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #a93636 | 6.43:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #256b44 | `--success-subtle` #e7f3eb | 5.64:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #256b44 | `--bg-surface` #ffffff | 6.43:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #8a6002 | `--warning-subtle` #f9f0dc | 4.93:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #8a6002 | `--bg-surface` #ffffff | 5.59:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #b03030 | `--critical-subtle` #faeceb | 5.51:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #b03030 | `--bg-surface` #ffffff | 6.34:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #33608f | `--info-subtle` #e8eff7 | 5.64:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #33608f | `--bg-surface` #ffffff | 6.54:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #755a33 | `--accent-subtle` #f3ede2 | 5.52:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #f3efe8 | `--sidebar-bg` #251f17 | 14.24:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #f3efe8 | `--sidebar-hover` #332b20 | 12.16:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #aea391 | `--sidebar-bg` #251f17 | 6.56:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #d6ac6a | `--sidebar-bg` #251f17 | 7.75:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #d6ac6a | `--sidebar-hover` #332b20 | 6.61:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--border-strong` #8f8a7f | `--bg-surface` #ffffff | 3.44:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8f8a7f | `--bg-canvas` #faf8f4 | 3.24:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #82653f | `--bg-canvas` #faf8f4 | 5.10:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #82653f | `--bg-surface` #ffffff | 5.41:1 | 3:1 | ✅ | focus ring (non-text) |

### Ink

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #edeef0 | `--bg-canvas` #141517 | 15.74:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #edeef0 | `--bg-surface` #1c1e21 | 14.39:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #edeef0 | `--bg-raised` #24262a | 13.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #edeef0 | `--bg-hover` #2a2d31 | 11.92:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #c6cad1 | `--bg-canvas` #141517 | 11.11:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #c6cad1 | `--bg-surface` #1c1e21 | 10.16:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #c6cad1 | `--bg-raised` #24262a | 9.22:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #c6cad1 | `--bg-hover` #2a2d31 | 8.41:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #9ba1a9 | `--bg-canvas` #141517 | 7.02:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #9ba1a9 | `--bg-surface` #1c1e21 | 6.42:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #9ba1a9 | `--bg-raised` #24262a | 5.82:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #9ba1a9 | `--bg-hover` #2a2d31 | 5.31:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #4ccfc0 | `--bg-canvas` #141517 | 9.56:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #4ccfc0 | `--bg-surface` #1c1e21 | 8.75:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #0c1211 | `--accent` #3ecbbb | 9.43:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #0c1211 | `--accent-hover` #55d6c8 | 10.66:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #0c1211 | `--critical` #e5605c | 5.55:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #0c1211 | `--critical-hover` #ec7a77 | 6.86:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #7bd3a0 | `--success-subtle` #162b1f | 8.34:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #7bd3a0 | `--bg-surface` #1c1e21 | 9.28:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #e9b95c | `--warning-subtle` #33290f | 7.89:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #e9b95c | `--bg-surface` #1c1e21 | 9.20:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #f08c88 | `--critical-subtle` #3a1f1e | 6.32:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #f08c88 | `--bg-surface` #1c1e21 | 7.01:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #8ec4ec | `--info-subtle` #16293c | 7.95:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #8ec4ec | `--bg-surface` #1c1e21 | 8.96:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #4ccfc0 | `--accent-subtle` #14332f | 7.12:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #edeef0 | `--sidebar-bg` #17191c | 15.17:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #edeef0 | `--sidebar-hover` #24262a | 13.05:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #9ba1a9 | `--sidebar-bg` #17191c | 6.76:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #4ccfc0 | `--sidebar-bg` #17191c | 9.22:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #4ccfc0 | `--sidebar-hover` #24262a | 7.93:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--border-strong` #626a74 | `--bg-surface` #1c1e21 | 3.05:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #626a74 | `--bg-canvas` #141517 | 3.33:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #3ecbbb | `--bg-canvas` #141517 | 9.10:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #3ecbbb | `--bg-surface` #1c1e21 | 8.32:1 | 3:1 | ✅ | focus ring (non-text) |
<!-- END GENERATED CONTRAST TABLES -->
