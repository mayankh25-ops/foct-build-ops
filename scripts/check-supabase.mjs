#!/usr/bin/env node
/**
 * Supabase connection doctor — `npm run check:supabase`.
 *
 * Answers, in plain English, why sign-in is failing. The two errors people
 * hit look similar but mean opposite things:
 *   "Invalid API key"          → the KEY was rejected (project mismatch,
 *                                mangled paste, disabled legacy key). The
 *                                password was never even checked.
 *   "Invalid login credentials"→ the key is FINE; that email/password pair
 *                                doesn't exist in this project.
 * Reads .env.local, decodes what it can offline, then probes the project.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env.local");
const line = (s = "") => console.log(s);
const ok = (s) => line(`  ✓ ${s}`);
const bad = (s) => line(`  ✗ ${s}`);
const warn = (s) => line(`  ! ${s}`);

function readEnv() {
  if (!existsSync(ENV_PATH)) return null;
  const out = {};
  for (const raw of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    // strip surrounding quotes the way dotenv does, then trailing CR/space
    v = v.replace(/^(['"])(.*)\1$/, "$2").replace(/[\s\r]+$/, "");
    out[m[1]] = { value: v, raw: m[2] };
  }
  return out;
}

/** project ref out of https://<ref>.supabase.co */
const refFromUrl = (u) => (u.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i) || [])[1];

/** legacy anon keys are JWTs carrying their project ref — decode offline */
function refFromLegacyKey(key) {
  if (!key.startsWith("eyJ")) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString("utf8"));
    return payload.ref;
  } catch {
    return undefined;
  }
}

function describeKey(key) {
  if (key.startsWith("sb_publishable_")) return "publishable (current format)";
  if (key.startsWith("sb_secret_")) return "SECRET key — wrong one, never put this in a NEXT_PUBLIC_ var";
  if (key.startsWith("eyJ")) return "legacy anon JWT";
  return "unrecognised format";
}

async function main() {
  line("\nFOCT BuildingOps — Supabase connection doctor");
  line("=============================================\n");

  const env = readEnv();
  if (!env) {
    bad(`No .env.local found at ${ENV_PATH}`);
    line("\n  The app runs in DEMO mode without it (no sign-in needed).");
    line("  To enable live sign-in, create .env.local with two lines:");
    line("    NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co");
    line("    NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...\n");
    return 1;
  }

  const urlEntry = env.NEXT_PUBLIC_SUPABASE_URL;
  const keyEntry = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let fatal = false;

  line("1. File contents");
  if (!urlEntry) { bad("NEXT_PUBLIC_SUPABASE_URL is missing"); fatal = true; }
  if (!keyEntry) { bad("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing"); fatal = true; }
  if (fatal) { line(""); return 1; }

  const url = urlEntry.value;
  const key = keyEntry.value;

  // character-level sanity — the classic paste injuries
  for (const [name, entry] of [["URL", urlEntry], ["KEY", keyEntry]]) {
    const v = entry.value;
    if (/[<>]/.test(v)) { bad(`${name} contains < or > — placeholder brackets were left in`); fatal = true; }
    else if (v.includes("PASTE") || v.includes("YOUR_")) { bad(`${name} is still the placeholder text`); fatal = true; }
    else if (/\s/.test(v)) { bad(`${name} contains a space — it was pasted with a line break`); fatal = true; }
    else if (entry.raw !== v) warn(`${name} had surrounding quotes/whitespace (handled, but tidy the file)`);
  }
  if (!fatal) ok(`URL and key present · key looks like: ${describeKey(key)} · length ${key.length}`);
  if (key.startsWith("sb_secret_")) fatal = true;
  if (fatal) { line("\n  Fix the file, then run this again.\n"); return 1; }

  line("\n2. Do the URL and key belong to the SAME project?");
  const urlRef = refFromUrl(url);
  if (!urlRef) {
    bad(`URL is not in the form https://<project-ref>.supabase.co — got "${url}"`);
    return 1;
  }
  ok(`App is configured for project: ${urlRef}`);
  const keyRef = refFromLegacyKey(key);
  if (keyRef && keyRef !== urlRef) {
    bad(`But the key belongs to project: ${keyRef}  ← THIS IS THE PROBLEM`);
    line("");
    line(`  You have two Supabase projects. Copy the key from THIS page:`);
    line(`    https://supabase.com/dashboard/project/${urlRef}/settings/api`);
    line("");
    return 1;
  } else if (keyRef) {
    ok(`Key's embedded project ref matches: ${keyRef}`);
  } else {
    line("  · Publishable keys don't carry the ref — the live probe below settles it.");
  }

  line("\n3. Live probe (asks the project directly)");
  const probe = async (path) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`${url}${path}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
      });
      const body = await res.text();
      return { status: res.status, body };
    } catch (e) {
      return { status: 0, body: String(e?.message ?? e) };
    } finally {
      clearTimeout(t);
    }
  };

  const health = await probe("/auth/v1/health");
  if (health.status === 0) {
    bad(`Could not reach ${url} — ${health.body}`);
    line("  (DNS failure, no internet, or the project no longer exists.)");
    line("\n  Check the project isn't PAUSED (free projects pause when idle):");
    line(`    https://supabase.com/dashboard/project/${urlRef}\n`);
    return 1;
  }

  const settings = await probe("/auth/v1/settings");

  // A reply only counts as "from Supabase" if it is 200 with JSON. Anything
  // else (proxy blocks, captive portals, WAFs) must NOT be read as success —
  // a false all-clear is worse than no check at all.
  const looksLikeSupabase = (r) => {
    if (r.status !== 200) return false;
    try {
      const j = JSON.parse(r.body);
      return j && typeof j === "object";
    } catch {
      return false;
    }
  };
  if (settings.status === 403 && /allowlist|egress|blocked|forbidden by/i.test(settings.body)) {
    bad("A network policy is blocking this machine from reaching Supabase.");
    line(`  ${settings.body.slice(0, 160)}`);
    line("\n  This is a network/firewall issue, not a key issue. Try another");
    line("  network, or run the app somewhere with open outbound HTTPS.\n");
    return 1;
  }
  if (settings.status === 401 || /Invalid API key/i.test(settings.body)) {
    bad("The project REJECTED this key (401 Invalid API key).");
    line("");
    line("  The key is wrong for this project. Most likely it was copied from");
    line("  your other project's settings page. Copy it from exactly here:");
    line(`    https://supabase.com/dashboard/project/${urlRef}/settings/api`);
    line("  Use the copy button next to the PUBLISHABLE key (sb_publishable_…).");
    if (key.startsWith("eyJ")) {
      line("");
      line("  Note: you're using a LEGACY anon key. If legacy keys are disabled");
      line("  on this project, switch to the publishable key.");
    }
    line("");
    return 1;
  }
  if (!looksLikeSupabase(settings)) {
    bad(`Unexpected reply from ${url} (HTTP ${settings.status}).`);
    line(`  ${settings.body.slice(0, 200)}`);
    line("\n  That did not come from Supabase's auth service. Check the URL is");
    line(`  exactly your project's URL, and that the project isn't paused:`);
    line(`    https://supabase.com/dashboard/project/${urlRef}\n`);
    return 1;
  }
  ok(`Key accepted by project ${urlRef} (auth settings responded 200)`);

  // 4. optional credential test
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    line("\n✓ VERDICT: the app's connection to Supabase is CORRECT.");
    line("  Any sign-in failure now is the email/password itself.");
    line(`  Manage users: https://supabase.com/dashboard/project/${urlRef}/auth/users`);
    line("\n  To test a specific login, run:");
    line("    npm run check:supabase -- you@example.com yourpassword\n");
    return 0;
  }

  line("\n4. Sign-in test for " + email);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  let res, body;
  try {
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: ctrl.signal,
    });
    body = await res.text();
  } catch (e) {
    bad(`Request failed: ${e?.message ?? e}`);
    return 1;
  } finally {
    clearTimeout(t);
  }

  if (body.includes("access_token")) {
    ok("SIGNED IN — this email and password work.");
    line("\n✓ VERDICT: everything is correct. If the browser still fails,");
    line("  hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) and restart the dev server.\n");
    return 0;
  }
  if (/invalid_credentials|Invalid login credentials/i.test(body)) {
    bad("Key is fine, but this email + password pair does not exist in this project.");
    line("");
    line(`  Create or reset the user HERE (not in your other project):`);
    line(`    https://supabase.com/dashboard/project/${urlRef}/auth/users`);
    line("  Use: Add user → Create new user → tick Auto Confirm User.\n");
    return 1;
  }
  if (/email_not_confirmed/i.test(body)) {
    bad("The account exists but is not confirmed.");
    line(`  Fix: https://supabase.com/dashboard/project/${urlRef}/auth/users → ⋯ → Confirm email\n`);
    return 1;
  }
  bad(`Unexpected response (${res.status}): ${body.slice(0, 300)}`);
  line("");
  return 1;

  return 0;
}

process.exitCode = await main();
