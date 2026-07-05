#!/usr/bin/env node
/**
 * Parses src/styles/tokens.css, computes WCAG contrast ratios for every
 * text/background pair the design system uses, and fails (exit 1) if any
 * pair is below its requirement:
 *   - normal text: 4.5:1 (WCAG 2.1 AA, 1.4.3)
 *   - UI component boundaries / focus indicators: 3:1 (1.4.11)
 *
 * Usage:
 *   node scripts/check-contrast.mjs          # check, exit non-zero on failure
 *   node scripts/check-contrast.mjs --md     # also print markdown tables for design/tokens.md
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles/tokens.css"), "utf8");

// ---- parse theme blocks -------------------------------------------------
const THEMES = ["graphite", "harbour", "eucalypt", "sandstone", "ink", "option-analytics", "option-blush", "option-slate", "option-sunset", "option-violet", "option-nightfall", "option-garden", "option-nature", "option-cyber", "option-glass"];
const themes = {};
const blockRe = /((?::root|\[data-theme="[a-z-]+"\])(?:\s*,\s*(?::root|\[data-theme="[a-z-]+"\]))*)\s*\{([^}]*)\}/g;

for (const m of css.matchAll(blockRe)) {
  const selectors = m[1];
  const body = m[2];
  const names = [...selectors.matchAll(/\[data-theme="([a-z-]+)"\]/g)].map((x) => x[1]);
  if (names.length === 0) continue; // shared :root block (type scale etc.)
  const vars = {};
  for (const v of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  for (const n of names) themes[n] = { ...(themes[n] ?? {}), ...vars };
}

for (const t of THEMES) {
  if (!themes[t]) {
    console.error(`✗ theme "${t}" not found in tokens.css`);
    process.exit(1);
  }
}

function resolve(theme, value, depth = 0) {
  if (depth > 5) throw new Error(`var() loop resolving ${value}`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref) return resolve(theme, themes[theme][ref[1]], depth + 1);
  return value;
}

// ---- WCAG math ----------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---- the pairs the system actually renders ------------------------------
const TEXT_BGS = ["bg-canvas", "bg-surface", "bg-raised", "bg-hover"];
const PAIRS = [
  // body text on every background it can sit on
  ...["text-primary", "text-secondary", "text-muted"].flatMap((fg) =>
    TEXT_BGS.map((bg) => ({ fg, bg, min: 4.5, use: "body text" }))
  ),
  // accent-coloured text (links, active nav) on page backgrounds
  ...["bg-canvas", "bg-surface"].map((bg) => ({ fg: "accent-text", bg, min: 4.5, use: "link text" })),
  // text on solid accent (primary button) incl. hover
  { fg: "text-on-accent", bg: "accent", min: 4.5, use: "primary button" },
  { fg: "text-on-accent", bg: "accent-hover", min: 4.5, use: "primary button :hover" },
  // destructive button
  { fg: "text-on-accent", bg: "critical", min: 4.5, use: "destructive button" },
  { fg: "text-on-accent", bg: "critical-hover", min: 4.5, use: "destructive button :hover" },
  // status pill text on its tinted background, and on plain surface
  ...["success", "warning", "critical", "info"].flatMap((s) => [
    { fg: `${s}-text`, bg: `${s}-subtle`, min: 4.5, use: `${s} pill` },
    { fg: `${s}-text`, bg: "bg-surface", min: 4.5, use: `${s} inline text` },
  ]),
  // accent text on accent-subtle (selected nav item, subtle badges)
  { fg: "accent-text", bg: "accent-subtle", min: 4.5, use: "selected/subtle accent" },
  // sidebar rail (dark in every theme)
  { fg: "sidebar-fg", bg: "sidebar-bg", min: 4.5, use: "sidebar item text" },
  { fg: "sidebar-fg", bg: "sidebar-hover", min: 4.5, use: "sidebar item :hover/active" },
  { fg: "sidebar-muted", bg: "sidebar-bg", min: 4.5, use: "sidebar secondary text" },
  { fg: "sidebar-active", bg: "sidebar-bg", min: 4.5, use: "sidebar active accent text" },
  { fg: "sidebar-active", bg: "sidebar-hover", min: 4.5, use: "sidebar active accent on fill" },
  { fg: "sidebar-active", bg: "accent-subtle", min: 4.5, use: "sidebar active pill" },
  // non-text UI: input borders and focus rings (WCAG 1.4.11, 3:1)
  { fg: "border-strong", bg: "bg-surface", min: 3.0, use: "input border (non-text)" },
  { fg: "border-strong", bg: "bg-canvas", min: 3.0, use: "input border (non-text)" },
  { fg: "focus-ring", bg: "bg-canvas", min: 3.0, use: "focus ring (non-text)" },
  { fg: "focus-ring", bg: "bg-surface", min: 3.0, use: "focus ring (non-text)" },
];

const md = process.argv.includes("--md");
let failures = 0;
const tables = [];

for (const theme of THEMES) {
  const rows = [];
  for (const { fg, bg, min, use } of PAIRS) {
    const fgHex = resolve(theme, themes[theme][fg]);
    const bgHex = resolve(theme, themes[theme][bg]);
    const ratio = contrast(fgHex, bgHex);
    const pass = ratio >= min;
    if (!pass) {
      failures++;
      console.error(
        `✗ [${theme}] --${fg} (${fgHex}) on --${bg} (${bgHex}) = ${ratio.toFixed(2)}:1 < ${min}:1 (${use})`
      );
    }
    rows.push({ fg, fgHex, bg, bgHex, ratio, min, pass, use });
  }
  tables.push({ theme, rows });
}

if (md) {
  for (const { theme, rows } of tables) {
    console.log(`\n### ${theme.charAt(0).toUpperCase() + theme.slice(1)}\n`);
    console.log("| Foreground | Background | Ratio | Requirement | Result | Used for |");
    console.log("| --- | --- | --- | --- | --- | --- |");
    for (const r of rows) {
      console.log(
        `| \`--${r.fg}\` ${r.fgHex} | \`--${r.bg}\` ${r.bgHex} | ${r.ratio.toFixed(2)}:1 | ${r.min}:1 | ${r.pass ? "✅" : "❌"} | ${r.use} |`
      );
    }
  }
}

if (failures) {
  console.error(`\n${failures} contrast pair(s) below requirement.`);
  process.exit(1);
}
console.log(`✓ all ${PAIRS.length} pairs × ${THEMES.length} themes meet WCAG AA requirements.`);
