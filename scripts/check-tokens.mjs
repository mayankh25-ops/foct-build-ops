#!/usr/bin/env node
/**
 * Guardrail: no raw colours in components or app code.
 * Scans src/components and src/app (excluding the token/theme CSS itself)
 * for hex colours, rgb()/hsl()/oklch() literals, and Tailwind stock colour
 * utilities (bg-red-500 etc.). Fails with exit 1 on any hit.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = [join(root, "src/components"), join(root, "src/app"), join(root, "src/lib")];
const ALLOW = new Set(["src/app/globals.css"]); // token mapping layer only

const RULES = [
  { name: "raw hex colour", re: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "raw rgb()/rgba()", re: /\brgba?\(/ },
  { name: "raw hsl()/oklch()", re: /\b(?:hsla?|oklch|oklab)\(/ },
  {
    name: "Tailwind stock colour utility",
    re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css|mjs|jsx?)$/.test(entry)) yield p;
  }
}

let failures = 0;
for (const target of TARGETS) {
  for (const file of walk(target)) {
    const rel = relative(root, file);
    if (ALLOW.has(rel)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const { name, re } of RULES) {
        const m = line.match(re);
        if (m) {
          failures++;
          console.error(`✗ ${rel}:${i + 1} ${name}: ${m[0]}  →  ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }
}

if (failures) {
  console.error(`\n${failures} raw colour usage(s) found. Components must use semantic tokens only.`);
  process.exit(1);
}
console.log("✓ no raw colours in components or app code.");
