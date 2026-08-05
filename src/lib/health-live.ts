"use client";

/**
 * System health (0018) — "is my database actually up to date?"
 *
 * This exists because of one specific bad afternoon: a project a few bundles
 * behind, screens that loaded forever, and no way to tell from inside the app
 * that anything was missing. Every failure here has a named file that fixes it,
 * so the job of this module is to get from a Postgres error code to that
 * filename without anybody reading a console.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const HEALTH_LIVE = isSupabaseConfigured;

export type Remedy = "none" | "repair" | "bundle" | "unreachable";

export interface Health {
  ok: boolean;
  signedIn: boolean;
  missingTables: string[];
  missingFunctions: string[];
  missingColumns: string[];
  counts: {
    organisations: number;
    buildings: number;
    staff: number;
    kiosks: number;
    people: number;
  };
  remedy: Remedy;
  /** set when we could not even ask */
  error?: string;
}

const EMPTY_COUNTS = { organisations: 0, buildings: 0, staff: 0, kiosks: 0, people: 0 };

/**
 * Never throws. A health check that fails the way everything else fails is
 * worthless — "could not reach the database" IS the diagnosis, and the screen
 * has to be able to render it.
 */
export async function fetchHealth(): Promise<Health> {
  try {
    const { data, error } = await getSupabase().rpc("app_health");
    if (error) {
      // 42883 / PGRST202: app_health itself is missing, which means the project
      // predates 0018 entirely. That is still an answer, and a useful one.
      const missingFn =
        /could not find the function|does not exist|42883|PGRST202/i.test(error.message);
      return {
        ok: false,
        signedIn: false,
        missingTables: [],
        missingFunctions: missingFn ? ["app_health"] : [],
        missingColumns: [],
        counts: EMPTY_COUNTS,
        remedy: missingFn ? "bundle" : "unreachable",
        error: error.message,
      };
    }
    const d = data as Record<string, unknown>;
    return {
      ok: Boolean(d.ok),
      signedIn: Boolean(d.signed_in),
      missingTables: (d.missing_tables as string[]) ?? [],
      missingFunctions: (d.missing_functions as string[]) ?? [],
      missingColumns: (d.missing_columns as string[]) ?? [],
      counts: { ...EMPTY_COUNTS, ...((d.counts as object) ?? {}) },
      remedy: (d.remedy as Remedy) ?? "none",
      error: d.error as string | undefined,
    };
  } catch (e) {
    return {
      ok: false,
      signedIn: false,
      missingTables: [],
      missingFunctions: [],
      missingColumns: [],
      counts: EMPTY_COUNTS,
      remedy: "unreachable",
      error: (e as Error).message,
    };
  }
}

export interface RemedyStep {
  title: string;
  detail: string;
  file?: string;
}

/** What to actually do, in order, in words a supervisor can follow. */
export function remedySteps(h: Health): RemedyStep[] {
  if (h.remedy === "unreachable") {
    return [
      {
        title: "The app can't reach your database",
        detail:
          "Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your hosting environment, then redeploy. Nothing below can be diagnosed until this is fixed.",
      },
    ];
  }

  const steps: RemedyStep[] = [];

  // ORDER MATTERS. The repair script adds columns an older project never got;
  // the bundle then creates whatever is still absent. Run the other way round
  // and the bundle appears to succeed while changing nothing, which is exactly
  // how a missing `buildings.slug` turns into a mystery.
  if (h.missingColumns.length > 0) {
    steps.push({
      title: "Add the columns your project is missing",
      detail: `Your database was created by an older version and never got ${listOut(
        h.missingColumns
      )}. This script adds them without touching your data.`,
      file: "supabase/REPAIR_SCHEMA.sql",
    });
  }

  if (h.missingTables.length > 0 || h.missingFunctions.length > 0) {
    const bits: string[] = [];
    if (h.missingTables.length) bits.push(`${h.missingTables.length} table(s)`);
    if (h.missingFunctions.length) bits.push(`${h.missingFunctions.length} function(s)`);
    steps.push({
      title: "Apply the rest of the release",
      detail: `${bits.join(" and ")} the app needs aren't there yet. Safe to run more than once.`,
      file: "supabase/APPLY_EVERYTHING.sql",
    });
  }

  if (steps.length > 0) {
    steps.push({
      title: "Reload this page",
      detail: "Everything should come back green. If it doesn't, the list above will have changed — run it again.",
    });
  }

  return steps;
}

/** "a, b and c" — up to three, then "and 4 more". */
export function listOut(items: string[]): string {
  if (items.length === 0) return "nothing";
  if (items.length === 1) return items[0]!;
  const head = items.slice(0, 3);
  const rest = items.length - head.length;
  const joined = `${head.slice(0, -1).join(", ")} and ${head[head.length - 1]}`;
  return rest > 0 ? `${joined} and ${rest} more` : joined;
}

/**
 * The one-line verdict for the top of the page.
 *
 * "Empty" is deliberately its own state and NOT a fault: a fresh project with
 * zero buildings is working perfectly, it just has no sites yet. Conflating
 * those two is what made the loading screens unreadable.
 */
export function verdict(h: Health): { tone: "success" | "warning" | "critical"; line: string } {
  if (h.remedy === "unreachable")
    return { tone: "critical", line: "The app can't reach your database." };
  if (!h.ok) return { tone: "critical", line: "Your database is behind the app." };
  if (h.counts.buildings === 0)
    return { tone: "warning", line: "Everything is installed — you just haven't added a site yet." };
  if (h.counts.staff === 0)
    return { tone: "warning", line: "Your site is set up. Add cleaners next so they can sign in." };
  return { tone: "success", line: "Everything is up to date." };
}
