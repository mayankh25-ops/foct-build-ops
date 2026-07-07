#!/usr/bin/env node
/**
 * Exports every theme's resolved colour tokens from src/styles/tokens.css to
 * src/lib/theme-tokens.json — the Theme Builder's duplication baselines.
 * Re-run whenever tokens.css changes: `npm run export:themes`.
 * Non-colour tokens (radius, fonts, elevation, gradients) are excluded; the
 * builder edits colours only and inherits the rest from the base theme.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles/tokens.css"), "utf8");

const themes = {};
const rootVars = {};
const blockRe = /((?::root|\[data-theme="[a-z-]+"\])(?:\s*,\s*(?::root|\[data-theme="[a-z-]+"\]))*)\s*\{([^}]*)\}/g;

for (const m of css.matchAll(blockRe)) {
  const names = [...m[1].matchAll(/\[data-theme="([a-z-]+)"\]/g)].map((x) => x[1]);
  const vars = {};
  for (const v of m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  if (names.length === 0) {
    Object.assign(rootVars, vars);
    continue;
  }
  for (const n of names) themes[n] = { ...(themes[n] ?? {}), ...vars };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const out = {};
for (const [name, vars] of Object.entries(themes)) {
  const merged = { ...rootVars, ...vars };
  const resolve = (value, depth = 0) => {
    if (depth > 5) return value;
    const ref = value.match(/^var\(--([\w-]+)\)$/);
    return ref && merged[ref[1]] ? resolve(merged[ref[1]], depth + 1) : value;
  };
  const colors = {};
  for (const [k, v] of Object.entries(merged)) {
    const r = resolve(v);
    if (HEX.test(r)) colors[k] = r.toLowerCase();
  }
  out[name] = colors;
}

writeFileSync(join(root, "src/lib/theme-tokens.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`✓ exported ${Object.keys(out).length} themes → src/lib/theme-tokens.json`);
