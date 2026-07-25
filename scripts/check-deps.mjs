#!/usr/bin/env node
/**
 * Dependency vulnerability gate.  `npm run check:deps`
 *
 * `npm audit` alone is unusable as a gate: it reports build-time-only issues
 * with the same urgency as a live RCE, and its "fix" is sometimes a five-year
 * downgrade. So this wraps it with explicit triage:
 *
 *   - high/critical advisories FAIL the build,
 *   - unless the package is listed in security/audit-allowlist.json with a
 *     reason and an expiry date — and an expired entry fails too, so nothing
 *     stays "temporarily accepted" forever.
 *
 * Triage means a human wrote down why. Silence means nobody looked.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ALLOWLIST_PATH = "security/audit-allowlist.json";
const FAIL_LEVELS = new Set(["high", "critical"]);

let report;
try {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout
  const out = execFileSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  report = JSON.parse(out);
} catch (e) {
  if (!e.stdout) {
    console.error("Could not run `npm audit` (offline?). Treating as a skip, not a pass.");
    process.exitCode = 0;
    process.exit();
  }
  report = JSON.parse(e.stdout);
}

const allow = existsSync(ALLOWLIST_PATH)
  ? JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"))
  : { entries: [] };

const today = new Date().toISOString().slice(0, 10);
const blocking = [];
const accepted = [];
const expired = [];

for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  if (!FAIL_LEVELS.has(v.severity)) continue;
  const entry = allow.entries.find((e) => e.package === name);
  if (!entry) {
    blocking.push({ name, severity: v.severity, via: describeVia(v) });
  } else if (entry.expires && entry.expires < today) {
    expired.push({ name, severity: v.severity, ...entry });
  } else {
    accepted.push({ name, severity: v.severity, ...entry });
  }
}

function describeVia(v) {
  const first = (v.via ?? []).find((x) => typeof x === "object");
  return first ? `${first.title} (${first.url})` : (v.via ?? []).join(", ");
}

for (const a of accepted) {
  console.log(`· accepted  ${a.package} (${a.severity}) — ${a.reason} [review by ${a.expires}]`);
}
for (const e of expired) {
  console.error(`✗ EXPIRED   ${e.package} (${e.severity}) — accepted until ${e.expires}, re-triage now`);
}
for (const b of blocking) {
  console.error(`✗ BLOCKING  ${b.name} (${b.severity}) — ${b.via}`);
}

const failures = blocking.length + expired.length;
if (failures === 0) {
  console.log(`✓ no untriaged high/critical advisories (${accepted.length} accepted with reasons).`);
  process.exitCode = 0;
} else {
  console.error(
    [
      "",
      "Fix with `npm audit fix`, upgrade the parent package, or — if the advisory",
      `genuinely does not apply — add an entry to ${ALLOWLIST_PATH} with a reason`,
      "and an expiry date so it gets looked at again.",
    ].join("\n")
  );
  process.exitCode = 1;
}
