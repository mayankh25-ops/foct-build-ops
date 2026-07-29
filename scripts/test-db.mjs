#!/usr/bin/env node
/**
 * Database + RLS regression suite.  `npm run test:db`
 *
 * Builds a throwaway Postgres database, applies APPLY_EVERYTHING.sql exactly
 * as the owner would paste it, then runs every isolation check and asserts the
 * expected number of `ok` notices. This is the layer that proves multi-org
 * isolation still holds — the one defect class that would end this product.
 *
 * It deliberately tests the SHIPPED BUNDLE, not the individual migrations, so
 * a migration that is authored but forgotten in the bundle fails here.
 *
 * Needs `psql` + a running Postgres. Three ways to point it at one:
 *   PGTEST_URL=postgres://user:pass@host:5432/postgres  (a scratch server)
 *   PGTEST_SOCKET=/var/tmp/pgsock                       (local socket)
 *   nothing                                             (tries localhost:5432)
 *
 * Nothing here ever touches a real Supabase project.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

const DB = `foct_test_${Date.now().toString(36)}`;

/** file → how many `ok` notices a healthy run prints */
const SUITES = [
  { file: "supabase/tests/isolation_check.sql", expect: 23, name: "platform isolation" },
  { file: "supabase/tests/sd_isolation_check.sql", expect: 15, name: "service desk isolation" },
  { file: "supabase/tests/integrations_isolation_check.sql", expect: 19, name: "integrations secrets" },
  { file: "supabase/tests/session_profile_check.sql", expect: 5, name: "session profile" },
  { file: "supabase/tests/kiosk_isolation_check.sql", expect: 19, name: "kiosk + attendance" },
  { file: "supabase/tests/notices_isolation_check.sql", expect: 18, name: "notices + offline sync" },
  { file: "supabase/tests/timesheet_isolation_check.sql", expect: 20, name: "timesheets + approvals" },
];

const BOOTSTRAP = "supabase/tests/_mirror_bootstrap.sql";
const BUNDLE = "supabase/APPLY_EVERYTHING.sql";

function psqlArgs(db) {
  if (process.env.PGTEST_URL) {
    const url = new URL(process.env.PGTEST_URL);
    if (db) url.pathname = `/${db}`;
    return [url.toString()];
  }
  const base = process.env.PGTEST_SOCKET ? ["-h", process.env.PGTEST_SOCKET] : [];
  return db ? [...base, "-d", db] : [...base, "-d", "postgres"];
}

/** psql writes NOTICEs (where every `ok` lives) to stderr, so both streams
 *  are captured and merged. Throws with the merged text on a non-zero exit. */
function psql(db, args) {
  const r = spawnSync("psql", [...psqlArgs(db), "-q", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error) throw Object.assign(r.error, { output });
  if (r.status !== 0) throw Object.assign(new Error("psql failed"), { output });
  return output;
}

function have(cmd) {
  try {
    execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!have("psql")) {
    console.error(
      [
        "SKIPPED — psql is not installed.",
        "",
        "The database suite proves multi-org isolation; it needs a scratch Postgres.",
        "  macOS:   brew install postgresql@16 && brew services start postgresql@16",
        "  Windows: install PostgreSQL, then add its bin\\ folder to PATH",
        "  Docker:  docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=pg postgres:16",
        "           PGTEST_URL=postgres://postgres:pg@localhost:5432/postgres npm run test:db",
        "",
        "CI runs it on every push regardless, so a skip here is not a gap in the gate.",
      ].join("\n")
    );
    process.exitCode = 0; // a missing local Postgres is not a test failure
    return;
  }

  for (const f of [BOOTSTRAP, BUNDLE, ...SUITES.map((s) => s.file)]) {
    if (!existsSync(f)) {
      console.error(`MISSING ${f} — run \`npm run build:apply-everything\` first.`);
      process.exitCode = 1;
      return;
    }
  }

  let created = false;
  try {
    psql(null, ["-c", `create database ${DB}`]);
    created = true;
  } catch (e) {
    console.error("Could not create a scratch database. Is Postgres running and reachable?");
    console.error(String(e.output ?? e.message).trim().split("\n").slice(-3).join("\n"));
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  try {
    process.stdout.write("applying APPLY_EVERYTHING.sql … ");
    psql(DB, ["-v", "ON_ERROR_STOP=1", "-f", BOOTSTRAP, "-f", BUNDLE]);
    console.log("ok");


    // Re-applying must be a no-op: the owner re-pastes bundles routinely.
    process.stdout.write("re-applying (idempotency) … ");
    psql(DB, ["-v", "ON_ERROR_STOP=1", "-f", BUNDLE]);
    console.log("ok");

    for (const suite of SUITES) {
      process.stdout.write(`${suite.name} … `);
      let out;
      try {
        out = psql(DB, ["-v", "ON_ERROR_STOP=1", "-f", suite.file]);
      } catch (e) {
        const fail =
          (e.output ?? "").split("\n").find((l) => /FAIL|ERROR/.test(l)) ?? "unknown error";
        console.log(`FAILED\n    ${fail.trim()}`);
        failures++;
        continue;
      }
      const oks = (out.match(/NOTICE:\s+ok\b/gi) ?? []).length;
      if (oks === suite.expect) console.log(`${oks}/${suite.expect} ok`);
      else {
        console.log(`FAILED — ${oks} ok notices, expected ${suite.expect}`);
        failures++;
      }
    }
  } finally {
    if (created) {
      try {
        psql(null, ["-c", `drop database if exists ${DB}`]);
      } catch {
        console.error(`(left ${DB} behind — drop it manually)`);
      }
    }
  }

  console.log(failures === 0 ? "\nDatabase suite green." : `\n${failures} database suite(s) FAILED.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
