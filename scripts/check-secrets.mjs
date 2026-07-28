#!/usr/bin/env node
/**
 * Secret scanner.  `npm run check:secrets`
 *
 * Greps every git-TRACKED file for credential shapes. Tracked-only is the
 * point: `.env.local` is ignored and must stay that way, and the failure this
 * catches is a key pasted into a component, a doc, or a migration "just to
 * test it" and then committed.
 *
 * A finding is a hard failure. If a match is genuinely a placeholder, make it
 * obviously fake (`sb_secret_REPLACE_ME`) rather than adding an exception.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const RULES = [
  { name: "Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{10,}/g },
  { name: "Supabase service_role JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g },
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}/g },
  { name: "SendGrid API key", re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g },
  { name: "Twilio auth token", re: /\bSK[0-9a-f]{32}\b/g },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g },
];

/** obviously-fake values used in docs, tests and examples */
const PLACEHOLDER = /(REPLACE|PLACEHOLDER|EXAMPLE|YOUR_|xxxx|\.\.\.|PROBE|fake|dummy|<[^>]+>)/i;

const SKIP_PATHS = [
  /^package-lock\.json$/,
  /^public\/fonts\//,
  /\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|pdf|zip|tgz)$/i,
];

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !SKIP_PATHS.some((re) => re.test(f)));

const findings = [];
for (const file of files) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue; // deleted but still indexed
  }
  if (size > 2_000_000) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // binary
  }

  for (const rule of RULES) {
    for (const match of text.matchAll(rule.re)) {
      const value = match[0];
      if (PLACEHOLDER.test(value)) continue;
      // a JWT-shaped string in a doc explaining JWTs is not a leak
      const line = text.slice(0, match.index).split("\n").length;
      const lineText = text.split("\n")[line - 1] ?? "";
      if (PLACEHOLDER.test(lineText)) continue;
      findings.push({ file, line, rule: rule.name, value });
    }
  }
}

// .env files must never be tracked at all
for (const file of files) {
  if (/^\.env($|\.)/.test(file) && !file.endsWith(".example")) {
    findings.push({ file, line: 1, rule: "tracked .env file", value: file });
  }
}

if (findings.length === 0) {
  console.log(`✓ no credentials found in ${files.length} tracked files.`);
  process.exitCode = 0;
} else {
  console.error(`✗ ${findings.length} possible credential(s) committed:\n`);
  for (const f of findings) {
    const shown = f.value.length > 18 ? `${f.value.slice(0, 12)}…${f.value.slice(-4)}` : f.value;
    console.error(`  ${f.file}:${f.line}  ${f.rule}  ${shown}`);
  }
  console.error(
    [
      "",
      "If this is real: rotate the key at the provider FIRST — it is in git history,",
      "and removing the line does not un-leak it.",
      "If it is an example, make it obviously fake (sb_secret_REPLACE_ME).",
    ].join("\n")
  );
  process.exitCode = 1;
}
