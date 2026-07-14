/**
 * The text/background pairs the design system actually renders — THE single
 * definition, consumed by BOTH scripts/check-contrast.mjs (build gate over
 * tokens.css) and the Theme Builder's save-time validator, so a custom theme
 * is held to exactly the same standard as the built-ins.
 * fg/bg are token names WITHOUT the leading "--".
 */
import { AA_NON_TEXT, AA_TEXT } from "./wcag.js";

const TEXT_BGS = ["bg-canvas", "bg-surface", "bg-raised", "bg-hover"];

export const PAIRS = [
  // body text on every background it can sit on
  ...["text-primary", "text-secondary", "text-muted"].flatMap((fg) =>
    TEXT_BGS.map((bg) => ({ fg, bg, min: AA_TEXT, use: "body text" }))
  ),
  // accent-coloured text (links, active nav) on page backgrounds
  ...["bg-canvas", "bg-surface"].map((bg) => ({ fg: "accent-text", bg, min: AA_TEXT, use: "link text" })),
  // text on solid accent (primary button) incl. hover
  { fg: "text-on-accent", bg: "accent", min: AA_TEXT, use: "primary button" },
  { fg: "text-on-accent", bg: "accent-hover", min: AA_TEXT, use: "primary button :hover" },
  // destructive button
  { fg: "text-on-accent", bg: "critical", min: AA_TEXT, use: "destructive button" },
  { fg: "text-on-accent", bg: "critical-hover", min: AA_TEXT, use: "destructive button :hover" },
  // status pill text on its tinted background, and on plain surface
  ...["success", "warning", "critical", "info"].flatMap((s) => [
    { fg: `${s}-text`, bg: `${s}-subtle`, min: AA_TEXT, use: `${s} pill` },
    { fg: `${s}-text`, bg: "bg-surface", min: AA_TEXT, use: `${s} inline text` },
  ]),
  // accent text on accent-subtle (selected nav item, subtle badges)
  { fg: "accent-text", bg: "accent-subtle", min: AA_TEXT, use: "selected/subtle accent" },
  // sidebar rail
  { fg: "sidebar-fg", bg: "sidebar-bg", min: AA_TEXT, use: "sidebar item text" },
  { fg: "sidebar-fg", bg: "sidebar-hover", min: AA_TEXT, use: "sidebar item :hover/active" },
  { fg: "sidebar-muted", bg: "sidebar-bg", min: AA_TEXT, use: "sidebar secondary text" },
  { fg: "sidebar-active", bg: "sidebar-bg", min: AA_TEXT, use: "sidebar active accent text" },
  { fg: "sidebar-active", bg: "sidebar-hover", min: AA_TEXT, use: "sidebar active accent on fill" },
  { fg: "sidebar-active-fg", bg: "sidebar-active-bg", min: AA_TEXT, use: "sidebar active pill" },
  // non-text UI: input borders and focus rings (WCAG 1.4.11, 3:1)
  { fg: "border-strong", bg: "bg-surface", min: AA_NON_TEXT, use: "input border (non-text)" },
  { fg: "border-strong", bg: "bg-canvas", min: AA_NON_TEXT, use: "input border (non-text)" },
  { fg: "focus-ring", bg: "bg-canvas", min: AA_NON_TEXT, use: "focus ring (non-text)" },
  { fg: "focus-ring", bg: "bg-surface", min: AA_NON_TEXT, use: "focus ring (non-text)" },
];
