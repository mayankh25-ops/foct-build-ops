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
import { contrast } from "../src/lib/wcag.js";
import { PAIRS } from "../src/lib/wcag-pairs.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles/tokens.css"), "utf8");

// ---- parse theme blocks -------------------------------------------------
const THEMES = ["graphite", "harbour", "eucalypt", "sandstone", "ink", "option-analytics", "option-blush", "option-slate", "option-sunset", "option-nature", "support", "subzero", "option-halo"];
const themes = {};
const rootVars = {}; // :root-only defaults (structural hooks like --card-border)
const blockRe = /((?::root|\[data-theme="[a-z-]+"\])(?:\s*,\s*(?::root|\[data-theme="[a-z-]+"\]))*)\s*\{([^}]*)\}/g;

for (const m of css.matchAll(blockRe)) {
  const selectors = m[1];
  const body = m[2];
  const names = [...selectors.matchAll(/\[data-theme="([a-z-]+)"\]/g)].map((x) => x[1]);
  const vars = {};
  for (const v of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  if (names.length === 0) {
    Object.assign(rootVars, vars); // shared :root block (type scale, hooks)
    continue;
  }
  for (const n of names) themes[n] = { ...(themes[n] ?? {}), ...vars };
}

for (const t of THEMES) {
  if (!themes[t]) {
    console.error(`✗ theme "${t}" not found in tokens.css`);
    process.exit(1);
  }
  themes[t] = { ...rootVars, ...themes[t] }; // themes override root defaults, as in CSS
}

function resolve(theme, value, depth = 0) {
  if (depth > 5) throw new Error(`var() loop resolving ${value}`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref) return resolve(theme, themes[theme][ref[1]], depth + 1);
  return value;
}

// ---- WCAG math: shared with the Theme Builder UI (src/lib/wcag.js) ------

// ---- the pairs the system actually renders ------------------------------
// PAIRS shared with the Theme Builder validator: src/lib/wcag-pairs.js

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
