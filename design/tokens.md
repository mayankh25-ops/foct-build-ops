# Design tokens (stub — values tuned in Stage 1)

Source of truth for token **names and references**. Values live in
`app/globals.css`; components never use raw hex, only semantic utilities /
`var(--token)`.

## Semantic tokens

| Token | Role | Reference (to document in Stage 1) |
| --- | --- | --- |
| `--bg-canvas` | Page background | Radix Sand 1–2 / Apple systemGroupedBackground |
| `--bg-surface` | Cards, panels | Apple systemBackground |
| `--bg-raised` | Nested/raised surfaces | Radix Sand 3 |
| `--border-subtle` | 1px card borders, dividers | Radix scale step 6 |
| `--text-primary` | Headings, body | Radix Slate 12 / Apple label |
| `--text-secondary` | Supporting text | Radix Slate 11 / Apple secondaryLabel |
| `--text-muted` | Hints, timestamps | Radix Slate 9–10 / Apple tertiaryLabel |
| `--accent` | Primary actions, active nav | Per theme |
| `--accent-hover` | Accent hover state | Per theme |
| `--accent-subtle` | Accent tints (selected rows, badges) | Per theme |
| `--success` | Positive status | Muted green, shared across themes |
| `--warning` | Caution status | Amber, shared across themes |
| `--critical` | Errors, destructive | Restrained red, shared across themes |
| `--focus-ring` | Keyboard focus outline | Per theme, WCAG-visible |

## Themes (token sets via `data-theme`)

`graphite` (default, placeholder values shipped in Stage 0) · `harbour` ·
`eucalypt` · `sandstone` · `ink` (dark). All five share identical token names,
spacing, radius, and status colours — only ramp values change. Full ramps and
per-value references land here in Stage 1.

## Typography (Stage 1)

- Display/headings: General Sans (fallback Inter Display)
- Body/UI: Hanken Grotesk (fallback Inter)
- Numeric/tabular only: Geist Mono
- Type scale documented here when wired; no ad-hoc font sizes in components.

## Layout constants

8px spacing grid · card radius 12–16px · 1px subtle border + very soft shadow
· max 2 accent-coloured elements per view.
