# FOCT BuildingOps — Design Tokens

Source of truth: `src/styles/tokens.css`. Themes are token sets applied via
`data-theme="<name>"` on any element; components consume semantic tokens only
(enforced by `npm run check:tokens`). Contrast is verified by
`npm run check:contrast`, which parses the CSS so this document and the code
cannot drift; the tables at the bottom are that script's output (`--md` flag).

## Themes

| Theme | Personality | Neutral reference | Accent |
| --- | --- | --- | --- |
| **Graphite** (default) | Cool light-grey, ink primary buttons, teal links (owner reference build) | Untitled UI Gray (gray-50…900) | Ink `#101828` buttons · teal `#0e7569` links |
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

### Sidebar rail

The navigation rail has its own token family (`--sidebar-*`) so its treatment
can differ from content surfaces per theme. Light themes ship a **light rail**
(white, hairline border, accent-subtle active pill — TailAdmin style, owner
reference 2026-07-03); Ink keeps a dark rail one step off its canvas. All text
pairs are AA-verified below.

| Token | Role |
| --- | --- |
| `--sidebar-bg` / `--sidebar-hover` | Rail background and hover fill |
| `--sidebar-fg` / `--sidebar-muted` | Item text; secondary/disabled item text (≥ 4.5:1 on the rail) |
| `--sidebar-active` | Active-item accent text (default source for `--sidebar-active-fg`) |
| `--sidebar-active-bg` / `--sidebar-active-fg` | The active-item pill fill + label. Defaults (in `:root`) alias `--accent-subtle` / `--sidebar-active`, so classic themes are unchanged; a theme can override both for a solid pill (Nature: sage fill + white label; Glass: frosted white/10 fill + white label) |
| `--sidebar-border` | Rail edge + footer hairline |

### Other

| Token | Role | Reference |
| --- | --- | --- |
| `--focus-ring` | 2px offset outline on `:focus-visible` (global rule in `globals.css`) | Theme accent; ≥ 3:1 on canvas + surface per WCAG 1.4.11 |
| `--overlay` | Modal scrim | Neutral ink at 45 % (60 % black in Ink) |
| `--elevation-card` / `--elevation-raised` | Shadows: very soft for cards, fuller for popovers/modals | HIG-style soft shadows; heavier + darker in Ink |
| `--chart-1` / `--chart-2` / `--chart-3` | Data-viz palette (donut ring, chart series/track). `:root` defaults derive from the theme accent family (`--accent` / `--warning` / `--bg-hover`) so every theme colours its charts in its own voice; Nature overrides to its sage ramp, Glass to the source's blue/amber/track | Structural hook 2026-07-06; decorative graphics, not held to text AA |
| `--card-border` | Card outline colour (`border-cardline` on the Card primitive only). Defaults to `--border-subtle`; Nature sets it `transparent` (borderless floating tiles), Glass sets a white/10 equivalent | Structural hook, `:root` default 2026-07-06 |

## Typography

Fonts come ONLY from the owner-approved library in CLAUDE.md (Finlandica,
Mona Sans, Roboto/Roboto Mono, Radio Canada, Hubot Sans + DM Sans, Satoshi,
Inter, Manrope, General Sans). Shipping trio:

| Slot | Font | Loading |
| --- | --- | --- |
| Headings + **big numbers** (incl. kiosk clock) | **Bricolage Grotesque** (variable 200–800) | Self-hosted woff2 (`src/fonts/bricolage/`), `--font-bricolage`. Owner rule: **big numbers are big & thick** — display numerals run 700–800 in the display face, not mono. |
| Body / UI | **Onest** (variable) | Self-hosted woff2 (`src/fonts/onest/`), `--font-onest` — from the owner's Datify reference. Line height held to the 1.4–1.6 band. |
| Table timestamps, durations, IDs only | **Roboto Mono** (variable) | Self-hosted woff2, `--font-roboto-mono`; `"SF Mono"` next in the stack for Apple devices (SF Mono is not redistributable). `.font-mono` sets `font-variant-numeric: tabular-nums`. |

Finlandica, Radio Canada, Hubot Sans and Manrope are approved alternates
(available on npm, not currently loaded); Satoshi and General Sans are
Fontshare-hosted and cannot be bundled from this environment.

### Type scale

No ad-hoc font sizes in components — only these utilities (Tailwind
`text-<name>` mapped in `globals.css`).

| Name | Size / line height | Tracking | Weight | Use |
| --- | --- | --- | --- | --- |
| `hero` | 72 px / 1 | −0.02em | 800 | Kiosk clock (display face) |
| `display` | 36 / 44 px | −0.02em | 800 | Page titles, metric numbers — big & thick |
| `title-1` | 28 / 36 px | −0.015em | 700 | Section titles, hero stats |
| `title-2` | 22 / 30 px | −0.01em | 600 | Modal/drawer titles, `SectionHeader` |
| `title-3` | 17 / 25 px | −0.005em | 600 | Card titles |
| `body` | 16 / 24 px (1.5) | 0 | 400 | Default UI text, inputs, buttons (md) |
| `body-sm` | 14 / 20 px (1.43) | 0 | 400 | Tables (never smaller), secondary copy, buttons (sm) |
| `caption` | 13 / 19 px (1.46) | +0.005em | 400–500 | Labels, hints, badges |

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
| `--text-primary` #101828 | `--bg-canvas` #f9fafb | 16.98:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101828 | `--bg-surface` #ffffff | 17.75:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101828 | `--bg-raised` #ffffff | 17.75:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101828 | `--bg-hover` #f2f4f7 | 16.11:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #344054 | `--bg-canvas` #f9fafb | 10.01:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #344054 | `--bg-surface` #ffffff | 10.46:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #344054 | `--bg-raised` #ffffff | 10.46:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #344054 | `--bg-hover` #f2f4f7 | 9.49:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5a6779 | `--bg-canvas` #f9fafb | 5.50:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5a6779 | `--bg-surface` #ffffff | 5.75:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5a6779 | `--bg-raised` #ffffff | 5.75:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5a6779 | `--bg-hover` #f2f4f7 | 5.22:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #0e7569 | `--bg-canvas` #f9fafb | 5.33:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #0e7569 | `--bg-surface` #ffffff | 5.57:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #101828 | 17.75:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #253041 | 13.31:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #0e7569 | `--accent-subtle` #e9eef0 | 4.77:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #344054 | `--sidebar-bg` #ffffff | 10.46:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #344054 | `--sidebar-hover` #f2f4f7 | 9.49:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5a6779 | `--sidebar-bg` #ffffff | 5.75:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #101828 | `--sidebar-bg` #ffffff | 17.75:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #101828 | `--sidebar-hover` #f2f4f7 | 16.11:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #101828 | `--sidebar-active-bg` #e9eef0 | 15.17:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #85909f | `--bg-surface` #ffffff | 3.24:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #85909f | `--bg-canvas` #f9fafb | 3.10:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #0e7569 | `--bg-canvas` #f9fafb | 5.33:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #0e7569 | `--bg-surface` #ffffff | 5.57:1 | 3:1 | ✅ | focus ring (non-text) |

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
| `--sidebar-fg` #414d63 | `--sidebar-bg` #ffffff | 8.51:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #414d63 | `--sidebar-hover` #f0f0f3 | 7.49:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #566276 | `--sidebar-bg` #ffffff | 6.17:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #0b6357 | `--sidebar-bg` #ffffff | 7.15:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #0b6357 | `--sidebar-hover` #f0f0f3 | 6.29:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #0b6357 | `--sidebar-active-bg` #e4f2f0 | 6.22:1 | 4.5:1 | ✅ | sidebar active pill |
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
| `--sidebar-fg` #4a544e | `--sidebar-bg` #ffffff | 7.87:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #4a544e | `--sidebar-hover` #eef1ef | 6.92:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5f6563 | `--sidebar-bg` #ffffff | 5.95:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #356947 | `--sidebar-bg` #ffffff | 6.44:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #356947 | `--sidebar-hover` #eef1ef | 5.66:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #356947 | `--sidebar-active-bg` #e9f2ec | 5.63:1 | 4.5:1 | ✅ | sidebar active pill |
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
| `--sidebar-fg` #565147 | `--sidebar-bg` #ffffff | 7.88:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #565147 | `--sidebar-hover` #f2efe9 | 6.87:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #6a645a | `--sidebar-bg` #ffffff | 5.86:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #755a33 | `--sidebar-bg` #ffffff | 6.43:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #755a33 | `--sidebar-hover` #f2efe9 | 5.60:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #755a33 | `--sidebar-active-bg` #f3ede2 | 5.52:1 | 4.5:1 | ✅ | sidebar active pill |
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
| `--sidebar-active-fg` #4ccfc0 | `--sidebar-active-bg` #14332f | 7.12:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #626a74 | `--bg-surface` #1c1e21 | 3.05:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #626a74 | `--bg-canvas` #141517 | 3.33:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #3ecbbb | `--bg-canvas` #141517 | 9.10:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #3ecbbb | `--bg-surface` #1c1e21 | 8.32:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-analytics

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #26292f | `--bg-canvas` #f2f4f6 | 13.22:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #26292f | `--bg-surface` #ffffff | 14.58:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #26292f | `--bg-raised` #ffffff | 14.58:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #26292f | `--bg-hover` #e8ebee | 12.18:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #494f58 | `--bg-canvas` #f2f4f6 | 7.49:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #494f58 | `--bg-surface` #ffffff | 8.26:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #494f58 | `--bg-raised` #ffffff | 8.26:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #494f58 | `--bg-hover` #e8ebee | 6.90:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d636c | `--bg-canvas` #f2f4f6 | 5.49:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d636c | `--bg-surface` #ffffff | 6.06:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d636c | `--bg-raised` #ffffff | 6.06:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d636c | `--bg-hover` #e8ebee | 5.06:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #14724d | `--bg-canvas` #f2f4f6 | 5.37:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #14724d | `--bg-surface` #ffffff | 5.93:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #42454b | 9.61:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #33363c | 12.11:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #14724d | `--accent-subtle` #e5f2ec | 5.15:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #494f58 | `--sidebar-bg` #ffffff | 8.26:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #494f58 | `--sidebar-hover` #eceef0 | 7.10:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5d636c | `--sidebar-bg` #ffffff | 6.06:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #14724d | `--sidebar-bg` #ffffff | 5.93:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #14724d | `--sidebar-hover` #eceef0 | 5.09:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #14724d | `--sidebar-active-bg` #e5f2ec | 5.15:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #7f8a95 | `--bg-surface` #ffffff | 3.52:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #7f8a95 | `--bg-canvas` #f2f4f6 | 3.19:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #14724d | `--bg-canvas` #f2f4f6 | 5.37:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #14724d | `--bg-surface` #ffffff | 5.93:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-blush

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #29332f | `--bg-canvas` #fbf5f1 | 12.08:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #29332f | `--bg-surface` #ffffff | 13.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #29332f | `--bg-raised` #ffffff | 13.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #29332f | `--bg-hover` #f8ede7 | 11.35:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #48544f | `--bg-canvas` #fbf5f1 | 7.32:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #48544f | `--bg-surface` #ffffff | 7.90:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #48544f | `--bg-raised` #ffffff | 7.90:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #48544f | `--bg-hover` #f8ede7 | 6.87:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6a64 | `--bg-canvas` #fbf5f1 | 5.24:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6a64 | `--bg-surface` #ffffff | 5.66:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6a64 | `--bg-raised` #ffffff | 5.66:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6a64 | `--bg-hover` #f8ede7 | 4.92:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #416a55 | `--bg-canvas` #fbf5f1 | 5.69:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #416a55 | `--bg-surface` #ffffff | 6.14:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #394541 | 9.99:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #2c3633 | 12.48:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #416a55 | `--accent-subtle` #fde4e2 | 5.08:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #48544f | `--sidebar-bg` #ffffff | 7.90:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #48544f | `--sidebar-hover` #f8ede7 | 6.87:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5d6a64 | `--sidebar-bg` #ffffff | 5.66:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #394541 | `--sidebar-bg` #ffffff | 9.99:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #394541 | `--sidebar-hover` #f8ede7 | 8.69:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #394541 | `--sidebar-active-bg` #fde4e2 | 8.27:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #92857b | `--bg-surface` #ffffff | 3.58:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #92857b | `--bg-canvas` #fbf5f1 | 3.31:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #416a55 | `--bg-canvas` #fbf5f1 | 5.69:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #416a55 | `--bg-surface` #ffffff | 6.14:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-slate

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #20242e | `--bg-canvas` #edeff3 | 13.48:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #20242e | `--bg-surface` #ffffff | 15.52:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #20242e | `--bg-raised` #ffffff | 15.52:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #20242e | `--bg-hover` #e1e4ea | 12.18:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #434b5c | `--bg-canvas` #edeff3 | 7.60:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #434b5c | `--bg-surface` #ffffff | 8.75:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #434b5c | `--bg-raised` #ffffff | 8.75:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #434b5c | `--bg-hover` #e1e4ea | 6.87:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5b6373 | `--bg-canvas` #edeff3 | 5.25:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5b6373 | `--bg-surface` #ffffff | 6.04:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5b6373 | `--bg-raised` #ffffff | 6.04:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5b6373 | `--bg-hover` #e1e4ea | 4.74:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #845c58 | `--bg-canvas` #edeff3 | 4.99:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #845c58 | `--bg-surface` #ffffff | 5.75:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #2c3444 | 12.49:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #1f2531 | 15.36:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #845c58 | `--accent-subtle` #f4eae8 | 4.87:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #434b5c | `--sidebar-bg` #ffffff | 8.75:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #434b5c | `--sidebar-hover` #e8eaec | 7.26:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5b6373 | `--sidebar-bg` #ffffff | 6.04:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #845c58 | `--sidebar-bg` #ffffff | 5.75:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #845c58 | `--sidebar-hover` #e8eaec | 4.77:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #845c58 | `--sidebar-active-bg` #f4eae8 | 4.87:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #7f8aa2 | `--bg-surface` #ffffff | 3.47:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #7f8aa2 | `--bg-canvas` #edeff3 | 3.01:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #845c58 | `--bg-canvas` #edeff3 | 4.99:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #845c58 | `--bg-surface` #ffffff | 5.75:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-sunset

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #251c17 | `--bg-canvas` #fbf5ef | 15.44:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #251c17 | `--bg-surface` #ffffff | 16.70:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #251c17 | `--bg-raised` #ffffff | 16.70:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #251c17 | `--bg-hover` #f6ece2 | 14.33:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #52463f | `--bg-canvas` #fbf5ef | 8.41:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #52463f | `--bg-surface` #ffffff | 9.10:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #52463f | `--bg-raised` #ffffff | 9.10:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #52463f | `--bg-hover` #f6ece2 | 7.81:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #675a52 | `--bg-canvas` #fbf5ef | 6.14:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #675a52 | `--bg-surface` #ffffff | 6.64:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #675a52 | `--bg-raised` #ffffff | 6.64:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #675a52 | `--bg-hover` #f6ece2 | 5.70:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #9a3412 | `--bg-canvas` #fbf5ef | 6.75:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #9a3412 | `--bg-surface` #ffffff | 7.31:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #c2410c | 5.18:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #9a3412 | 7.31:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #9a3412 | `--accent-subtle` #fdead9 | 6.24:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #52463f | `--sidebar-bg` #ffffff | 9.10:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #52463f | `--sidebar-hover` #f6ece2 | 7.81:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #675a52 | `--sidebar-bg` #ffffff | 6.64:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #9a3412 | `--sidebar-bg` #ffffff | 7.31:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #9a3412 | `--sidebar-hover` #f6ece2 | 6.27:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #9a3412 | `--sidebar-active-bg` #fdead9 | 6.24:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #96887c | `--bg-surface` #ffffff | 3.44:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #96887c | `--bg-canvas` #fbf5ef | 3.18:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #c2410c | `--bg-canvas` #fbf5ef | 4.79:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #c2410c | `--bg-surface` #ffffff | 5.18:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-violet

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #201a33 | `--bg-canvas` #f7f6fc | 15.55:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #201a33 | `--bg-surface` #ffffff | 16.71:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #201a33 | `--bg-raised` #ffffff | 16.71:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #201a33 | `--bg-hover` #efedf8 | 14.43:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a4468 | `--bg-canvas` #f7f6fc | 8.43:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a4468 | `--bg-surface` #ffffff | 9.06:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a4468 | `--bg-raised` #ffffff | 9.06:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4a4468 | `--bg-hover` #efedf8 | 7.83:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f5980 | `--bg-canvas` #f7f6fc | 6.06:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f5980 | `--bg-surface` #ffffff | 6.51:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f5980 | `--bg-raised` #ffffff | 6.51:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5f5980 | `--bg-hover` #efedf8 | 5.62:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #5b4bc4 | `--bg-canvas` #f7f6fc | 6.02:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #5b4bc4 | `--bg-surface` #ffffff | 6.46:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #372a7a | 11.83:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #46368f | 9.61:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #5b4bc4 | `--accent-subtle` #edeaf9 | 5.46:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #4a4468 | `--sidebar-bg` #ffffff | 9.06:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #4a4468 | `--sidebar-hover` #efedf8 | 7.83:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5f5980 | `--sidebar-bg` #ffffff | 6.51:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #4b3da9 | `--sidebar-bg` #ffffff | 8.27:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #4b3da9 | `--sidebar-hover` #efedf8 | 7.14:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #4b3da9 | `--sidebar-active-bg` #edeaf9 | 6.98:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #8b87a6 | `--bg-surface` #ffffff | 3.43:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8b87a6 | `--bg-canvas` #f7f6fc | 3.20:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #5b4bc4 | `--bg-canvas` #f7f6fc | 6.02:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #5b4bc4 | `--bg-surface` #ffffff | 6.46:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-nightfall

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #101728 | `--bg-canvas` #f3f6fa | 16.48:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101728 | `--bg-surface` #ffffff | 17.87:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101728 | `--bg-raised` #ffffff | 17.87:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #101728 | `--bg-hover` #e9eef5 | 15.33:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #3a4763 | `--bg-canvas` #f3f6fa | 8.57:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #3a4763 | `--bg-surface` #ffffff | 9.29:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #3a4763 | `--bg-raised` #ffffff | 9.29:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #3a4763 | `--bg-hover` #e9eef5 | 7.97:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #51607c | `--bg-canvas` #f3f6fa | 5.85:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #51607c | `--bg-surface` #ffffff | 6.34:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #51607c | `--bg-raised` #ffffff | 6.34:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #51607c | `--bg-hover` #e9eef5 | 5.44:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #2e5291 | `--bg-canvas` #f3f6fa | 7.09:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #2e5291 | `--bg-surface` #ffffff | 7.69:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #31569a | 7.17:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #274572 | 9.63:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #2e5291 | `--accent-subtle` #e3f0fb | 6.63:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #3a4763 | `--sidebar-bg` #ffffff | 9.29:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #3a4763 | `--sidebar-hover` #e9eef5 | 7.97:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #51607c | `--sidebar-bg` #ffffff | 6.34:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #2e5291 | `--sidebar-bg` #ffffff | 7.69:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #2e5291 | `--sidebar-hover` #e9eef5 | 6.59:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #2e5291 | `--sidebar-active-bg` #e3f0fb | 6.63:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #7f8ea3 | `--bg-surface` #ffffff | 3.33:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #7f8ea3 | `--bg-canvas` #f3f6fa | 3.07:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #31569a | `--bg-canvas` #f3f6fa | 6.62:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #31569a | `--bg-surface` #ffffff | 7.17:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-garden

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #242424 | `--bg-canvas` #f8f7f2 | 14.47:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #242424 | `--bg-surface` #ffffff | 15.52:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #242424 | `--bg-raised` #ffffff | 15.52:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #242424 | `--bg-hover` #efeee6 | 13.34:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4c4c48 | `--bg-canvas` #f8f7f2 | 8.04:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4c4c48 | `--bg-surface` #ffffff | 8.63:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4c4c48 | `--bg-raised` #ffffff | 8.63:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4c4c48 | `--bg-hover` #efeee6 | 7.41:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #62625c | `--bg-canvas` #f8f7f2 | 5.72:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #62625c | `--bg-surface` #ffffff | 6.14:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #62625c | `--bg-raised` #ffffff | 6.14:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #62625c | `--bg-hover` #efeee6 | 5.27:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #3d6136 | `--bg-canvas` #f8f7f2 | 6.61:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #3d6136 | `--bg-surface` #ffffff | 7.09:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #48713f | 5.66:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #3a5c33 | 7.61:1 | 4.5:1 | ✅ | primary button :hover |
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
| `--accent-text` #3d6136 | `--accent-subtle` #eaf2e4 | 6.19:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #4c4c48 | `--sidebar-bg` #ffffff | 8.63:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #4c4c48 | `--sidebar-hover` #efeee6 | 7.41:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #62625c | `--sidebar-bg` #ffffff | 6.14:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #3d6136 | `--sidebar-bg` #ffffff | 7.09:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #3d6136 | `--sidebar-hover` #efeee6 | 6.09:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #3d6136 | `--sidebar-active-bg` #eaf2e4 | 6.19:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #8b8878 | `--bg-surface` #ffffff | 3.56:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8b8878 | `--bg-canvas` #f8f7f2 | 3.32:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #48713f | `--bg-canvas` #f8f7f2 | 5.28:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #48713f | `--bg-surface` #ffffff | 5.66:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-nature

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #262a22 | `--bg-canvas` #f9f7f2 | 13.65:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #262a22 | `--bg-surface` #ffffff | 14.62:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #262a22 | `--bg-raised` #ffffff | 14.62:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #262a22 | `--bg-hover` #f1ede4 | 12.51:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4d5347 | `--bg-canvas` #f9f7f2 | 7.42:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4d5347 | `--bg-surface` #ffffff | 7.94:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4d5347 | `--bg-raised` #ffffff | 7.94:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #4d5347 | `--bg-hover` #f1ede4 | 6.80:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6656 | `--bg-canvas` #f9f7f2 | 5.60:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6656 | `--bg-surface` #ffffff | 6.00:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6656 | `--bg-raised` #ffffff | 6.00:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #5d6656 | `--bg-hover` #f1ede4 | 5.13:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #596b4f | `--bg-canvas` #f9f7f2 | 5.39:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #596b4f | `--bg-surface` #ffffff | 5.77:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #657a59 | 4.69:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #55684b | 6.06:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #b1502f | 5.18:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #96431f | 6.73:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #596b4f | `--success-subtle` #eaf0e2 | 4.96:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #596b4f | `--bg-surface` #ffffff | 5.77:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #8a6002 | `--warning-subtle` #f9f0dc | 4.93:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #8a6002 | `--bg-surface` #ffffff | 5.59:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #a44526 | `--critical-subtle` #f9e7de | 5.06:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #a44526 | `--bg-surface` #ffffff | 6.07:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #3e685f | `--info-subtle` #e4efec | 5.33:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #3e685f | `--bg-surface` #ffffff | 6.27:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #596b4f | `--accent-subtle` #eaf0e2 | 4.96:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #4d5347 | `--sidebar-bg` #f9f7f2 | 7.42:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #4d5347 | `--sidebar-hover` #efeadf | 6.62:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #5d6656 | `--sidebar-bg` #f9f7f2 | 5.60:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #4c5f43 | `--sidebar-bg` #f9f7f2 | 6.48:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #4c5f43 | `--sidebar-hover` #efeadf | 5.79:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #ffffff | `--sidebar-active-bg` #657a59 | 4.69:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #8f887a | `--bg-surface` #ffffff | 3.52:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8f887a | `--bg-canvas` #f9f7f2 | 3.29:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #55684b | `--bg-canvas` #f9f7f2 | 5.66:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #55684b | `--bg-surface` #ffffff | 6.06:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-cyber

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #e2e8f0 | `--bg-canvas` #0a0a0c | 16.05:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #e2e8f0 | `--bg-surface` #111116 | 15.27:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #e2e8f0 | `--bg-raised` #17171d | 14.48:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #e2e8f0 | `--bg-hover` #1c1c24 | 13.73:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #b5bfce | `--bg-canvas` #0a0a0c | 10.65:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #b5bfce | `--bg-surface` #111116 | 10.14:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #b5bfce | `--bg-raised` #17171d | 9.61:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #b5bfce | `--bg-hover` #1c1c24 | 9.11:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #8e99a9 | `--bg-canvas` #0a0a0c | 6.86:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #8e99a9 | `--bg-surface` #111116 | 6.53:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #8e99a9 | `--bg-raised` #17171d | 6.19:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #8e99a9 | `--bg-hover` #1c1c24 | 5.87:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #2ee2f0 | `--bg-canvas` #0a0a0c | 12.48:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #2ee2f0 | `--bg-surface` #111116 | 11.88:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #0a0a0c | `--accent` #00f2ff | 14.27:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #0a0a0c | `--accent-hover` #66f7ff | 15.37:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #0a0a0c | `--critical` #e5605c | 5.80:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #0a0a0c | `--critical-hover` #ec7a77 | 7.17:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #7bd3a0 | `--success-subtle` #12291c | 8.58:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #7bd3a0 | `--bg-surface` #111116 | 10.46:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #e9b95c | `--warning-subtle` #2e2510 | 8.33:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #e9b95c | `--bg-surface` #111116 | 10.36:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #f08c88 | `--critical-subtle` #351a1c | 6.70:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #f08c88 | `--bg-surface` #111116 | 7.90:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #d16bff | `--info-subtle` #2c0f3d | 5.84:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #d16bff | `--bg-surface` #111116 | 6.51:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #2ee2f0 | `--accent-subtle` #0b2f33 | 9.02:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #cfd6e0 | `--sidebar-bg` #0d0d11 | 13.25:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #cfd6e0 | `--sidebar-hover` #1a1a22 | 11.81:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #8e99a9 | `--sidebar-bg` #0d0d11 | 6.72:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #2ee2f0 | `--sidebar-bg` #0d0d11 | 12.24:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #2ee2f0 | `--sidebar-hover` #1a1a22 | 10.91:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #2ee2f0 | `--sidebar-active-bg` #0b2f33 | 9.02:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #5c6b78 | `--bg-surface` #111116 | 3.43:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #5c6b78 | `--bg-canvas` #0a0a0c | 3.61:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #00f2ff | `--bg-canvas` #0a0a0c | 14.27:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #00f2ff | `--bg-surface` #111116 | 13.58:1 | 3:1 | ✅ | focus ring (non-text) |

### Option-glass

| Foreground | Background | Ratio | Requirement | Result | Used for |
| --- | --- | --- | --- | --- | --- |
| `--text-primary` #f2effc | `--bg-canvas` #241b3e | 14.24:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #f2effc | `--bg-surface` #322a4e | 11.75:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #f2effc | `--bg-raised` #3a3159 | 10.51:1 | 4.5:1 | ✅ | body text |
| `--text-primary` #f2effc | `--bg-hover` #413767 | 9.42:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #cdc5e8 | `--bg-canvas` #241b3e | 9.80:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #cdc5e8 | `--bg-surface` #322a4e | 8.08:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #cdc5e8 | `--bg-raised` #3a3159 | 7.23:1 | 4.5:1 | ✅ | body text |
| `--text-secondary` #cdc5e8 | `--bg-hover` #413767 | 6.48:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #b5acd9 | `--bg-canvas` #241b3e | 7.58:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #b5acd9 | `--bg-surface` #322a4e | 6.26:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #b5acd9 | `--bg-raised` #3a3159 | 5.60:1 | 4.5:1 | ✅ | body text |
| `--text-muted` #b5acd9 | `--bg-hover` #413767 | 5.02:1 | 4.5:1 | ✅ | body text |
| `--accent-text` #cabcff | `--bg-canvas` #241b3e | 9.34:1 | 4.5:1 | ✅ | link text |
| `--accent-text` #cabcff | `--bg-surface` #322a4e | 7.70:1 | 4.5:1 | ✅ | link text |
| `--text-on-accent` #ffffff | `--accent` #4d4470 | 8.84:1 | 4.5:1 | ✅ | primary button |
| `--text-on-accent` #ffffff | `--accent-hover` #574e7c | 7.54:1 | 4.5:1 | ✅ | primary button :hover |
| `--text-on-accent` #ffffff | `--critical` #d12f4f | 4.96:1 | 4.5:1 | ✅ | destructive button |
| `--text-on-accent` #ffffff | `--critical-hover` #c9304c | 5.24:1 | 4.5:1 | ✅ | destructive button :hover |
| `--success-text` #7be3b4 | `--success-subtle` #1c3630 | 8.33:1 | 4.5:1 | ✅ | success pill |
| `--success-text` #7be3b4 | `--bg-surface` #322a4e | 8.55:1 | 4.5:1 | ✅ | success inline text |
| `--warning-text` #fcd34d | `--warning-subtle` #3b3018 | 8.98:1 | 4.5:1 | ✅ | warning pill |
| `--warning-text` #fcd34d | `--bg-surface` #322a4e | 9.24:1 | 4.5:1 | ✅ | warning inline text |
| `--critical-text` #fda4af | `--critical-subtle` #43222b | 7.39:1 | 4.5:1 | ✅ | critical pill |
| `--critical-text` #fda4af | `--bg-surface` #322a4e | 7.04:1 | 4.5:1 | ✅ | critical inline text |
| `--info-text` #93c5fd | `--info-subtle` #223052 | 7.22:1 | 4.5:1 | ✅ | info pill |
| `--info-text` #93c5fd | `--bg-surface` #322a4e | 7.39:1 | 4.5:1 | ✅ | info inline text |
| `--accent-text` #cabcff | `--accent-subtle` #3f3566 | 6.35:1 | 4.5:1 | ✅ | selected/subtle accent |
| `--sidebar-fg` #d9d2ee | `--sidebar-bg` #2a2148 | 10.22:1 | 4.5:1 | ✅ | sidebar item text |
| `--sidebar-fg` #d9d2ee | `--sidebar-hover` #3a3161 | 8.04:1 | 4.5:1 | ✅ | sidebar item :hover/active |
| `--sidebar-muted` #b5acd9 | `--sidebar-bg` #2a2148 | 7.00:1 | 4.5:1 | ✅ | sidebar secondary text |
| `--sidebar-active` #cabcff | `--sidebar-bg` #2a2148 | 8.62:1 | 4.5:1 | ✅ | sidebar active accent text |
| `--sidebar-active` #cabcff | `--sidebar-hover` #3a3161 | 6.78:1 | 4.5:1 | ✅ | sidebar active accent on fill |
| `--sidebar-active-fg` #ffffff | `--sidebar-active-bg` #453b6a | 10.06:1 | 4.5:1 | ✅ | sidebar active pill |
| `--border-strong` #8d82b8 | `--bg-surface` #322a4e | 3.82:1 | 3:1 | ✅ | input border (non-text) |
| `--border-strong` #8d82b8 | `--bg-canvas` #241b3e | 4.62:1 | 3:1 | ✅ | input border (non-text) |
| `--focus-ring` #cabcff | `--bg-canvas` #241b3e | 9.34:1 | 3:1 | ✅ | focus ring (non-text) |
| `--focus-ring` #cabcff | `--bg-surface` #322a4e | 7.70:1 | 3:1 | ✅ | focus ring (non-text) |
<!-- END GENERATED CONTRAST TABLES -->
