#!/usr/bin/env node
/**
 * Generates supabase/REPAIR_SCHEMA.sql.
 *
 * THE PROBLEM IT SOLVES: `create table if not exists` does nothing to a table
 * that already exists — including one created by an older version of these
 * migrations. A project set up months ago therefore keeps its old columns, the
 * bundle applies "successfully", and the app fails at runtime with things like
 * `column buildings.slug does not exist`. That is exactly what happened on the
 * owner's project.
 *
 * This script reads every `create table if not exists public.X (...)` block in
 * the migrations and emits `alter table ... add column if not exists ...` for
 * each column, so an old project can be brought up to the current shape without
 * dropping anything. Columns that already exist are left completely alone.
 *
 * Regenerate with `npm run build:repair` after adding a table or column.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";
const OUT = "supabase/REPAIR_SCHEMA.sql";

/** Split a column list on top-level commas — a check(... , ...) must not split. */
function splitColumns(body) {
  const out = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current);
  return out.map((c) => c.trim()).filter(Boolean);
}

/** Everything that is a table CONSTRAINT rather than a column. */
const NOT_A_COLUMN =
  /^(primary\s+key|unique|check|foreign\s+key|constraint|exclude)\b/i;

/**
 * A column definition, reduced to what ADD COLUMN can accept.
 * `primary key`, `references`, `unique` and `not null` are all dropped:
 *   - the table already has its primary key;
 *   - a NOT NULL added to a table with rows fails without a default, and the
 *     rows in an old project are real data we must not reject;
 *   - a foreign key added blind can fail on legacy rows; the migrations
 *     recreate the important ones anyway.
 * What survives is the name, the type, and the default — which is all an old
 * project is missing.
 */
function reduceColumn(def) {
  const cleaned = def.replace(/--[^\n]*/g, " ").replace(/\s+/g, " ").trim();
  const match = /^([a-z_][a-z0-9_]*)\s+(.+)$/i.exec(cleaned);
  if (!match) return null;
  const name = match[1];
  let rest = match[2];

  const defaultMatch = /\bdefault\s+(.+?)(?=\s+(?:not null|null|references|check|unique|primary key)\b|$)/i.exec(rest);
  const dflt = defaultMatch ? defaultMatch[1].trim() : null;

  // The type is everything BEFORE the first modifier keyword. Matching the
  // type shape directly is what went wrong first: `text check (resolution in
  // (...))` parsed as the two-word type "text check" plus a paren group, and
  // the emitted SQL was truncated mid-clause. Cutting at the keyword cannot do
  // that.
  const cut = rest.search(
    /\s+(?:not\s+null|null\b|default\b|references\b|check\b|unique\b|primary\s+key|generated\b|collate\b)/i
  );
  let type = (cut === -1 ? rest : rest.slice(0, cut)).trim().replace(/,$/, "");
  if (!type) return null;

  // a plausible column and a plausible type, or nothing: a generator that
  // emits questionable SQL into a repair script is worse than one that skips
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) return null;
  if (!/^[a-z][a-z0-9_ ]*(\([^)]*\))?(\[\])?$/.test(type)) return null;
  if (/^(if|then|else|end|or|and|not|null|check|default)$/i.test(name)) return null;

  return { name, type, dflt };
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** table → ordered unique columns (a later migration wins on a redefinition) */
const tables = new Map();

for (const file of files) {
  // Comments FIRST, both kinds, across the WHOLE file. Twice bitten: a
  // `/** … or a finish */` doc comment parsed as a column called "or", and a
  // `-- clock_timestamp(), NOT now(): …` line comment split on its comma into
  // a column called "so two". Stripping per-column was too late — the split
  // had already happened.
  const sql = readFileSync(join(DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, "");

  // create table if not exists public.foo ( ... );
  const createRe = /create\s+table\s+if\s+not\s+exists\s+public\.([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = createRe.exec(sql))) {
    const table = m[1];
    const cols = tables.get(table) ?? new Map();
    for (const raw of splitColumns(m[2])) {
      if (NOT_A_COLUMN.test(raw.trim())) continue;
      const col = reduceColumn(raw);
      if (col) cols.set(col.name, col);
    }
    tables.set(table, cols);
  }

  // alter table public.foo add column if not exists bar type ...;
  const alterRe =
    /alter\s+table\s+public\.([a-z_][a-z0-9_]*)\s+add\s+column\s+if\s+not\s+exists\s+([a-z_][a-z0-9_]*)\s+([^;]+);/gi;
  while ((m = alterRe.exec(sql))) {
    const cols = tables.get(m[1]) ?? new Map();
    const col = reduceColumn(`${m[2]} ${m[3]}`);
    if (col) cols.set(col.name, col);
    tables.set(m[1], cols);
  }
}

const lines = [
  "-- =============================================================================",
  "-- REPAIR_SCHEMA.sql — GENERATED. Brings an OLDER project up to the current shape.",
  "--",
  "-- WHY THIS EXISTS: `create table if not exists` does nothing to a table that",
  "-- already exists, including one created by an older version of these",
  "-- migrations. The bundle then applies without error and the app fails at",
  "-- runtime with `column buildings.slug does not exist` (or similar).",
  "--",
  "-- This adds every column the current code expects, and only the ones that are",
  "-- missing. It NEVER drops or rewrites anything: existing columns, data and",
  "-- constraints are untouched.",
  "--",
  "-- HOW TO USE (safe to re-run, and safe on an up-to-date project — it is a",
  "-- no-op there):",
  "--   1. paste this file    → Run",
  "--   2. paste APPLY_EVERYTHING.sql → Run",
  "--   3. reload the app",
  "--",
  "-- Regenerate with: npm run build:repair",
  "-- =============================================================================",
  "",
];

for (const [table, cols] of [...tables.entries()].sort()) {
  lines.push(`-- ---- ${table} ${"-".repeat(Math.max(0, 66 - table.length))}`);
  lines.push(`do $$ begin`);
  lines.push(`  if to_regclass('public.${table}') is null then`);
  lines.push(`    raise notice 'repair: public.${table} does not exist yet — APPLY_EVERYTHING will create it';`);
  lines.push(`  end if;`);
  lines.push(`end $$;`);
  for (const c of cols.values()) {
    const dflt = c.dflt ? ` default ${c.dflt}` : "";
    lines.push(
      `do $$ begin\n` +
        `  if to_regclass('public.${table}') is not null then\n` +
        `    alter table public.${table} add column if not exists ${c.name} ${c.type}${dflt};\n` +
        `  end if;\n` +
        `exception when others then\n` +
        `  raise notice 'repair: public.${table}.${c.name} — %', sqlerrm;\n` +
        `end $$;`
    );
  }
  lines.push("");
}

// The one column that needs a value as well as a definition: a NOT NULL UNIQUE
// slug added to a table with rows in it would be rejected, so it arrives
// nullable and is filled from the name.
lines.push(`-- ---- backfills that a bare ADD COLUMN cannot do -------------------------`);
lines.push(`do $$ begin
  if to_regclass('public.buildings') is not null
     and exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'buildings'
                    and column_name = 'slug') then
    -- a slug from the name: "Aurora on Collins" -> "aurora-on-collins"
    update public.buildings
       set slug = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
     where slug is null or trim(slug) = '';
    -- and a suffix for any collision, so the unique index can be created
    update public.buildings b
       set slug = b.slug || '-' || left(b.id::text, 4)
      from (select slug from public.buildings group by slug having count(*) > 1) d
     where b.slug = d.slug;
    begin
      create unique index if not exists buildings_slug_key on public.buildings (slug);
    exception when others then
      raise notice 'repair: buildings.slug unique index — %', sqlerrm;
    end;
  end if;
end $$;`);

lines.push("");
lines.push(`do $$ begin raise notice 'repair: finished — now paste APPLY_EVERYTHING.sql'; end $$;`);

writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`${OUT}: ${tables.size} tables, ${[...tables.values()].reduce((n, c) => n + c.size, 0)} columns checked`);
