/**
 * What the health screen tells somebody to do.
 *
 * The whole value of this feature is getting from a Postgres error nobody can
 * read to a filename and an order. So the assertions that matter are about the
 * ORDER of the steps and the DISTINCTION between a database that is broken and
 * one that is merely empty — conflating those two is what produced four screens
 * that loaded forever.
 */
import { describe, expect, it } from "vitest";
import { listOut, remedySteps, verdict, type Health } from "@/lib/health-live";

function health(over: Partial<Health> = {}): Health {
  return {
    ok: true,
    signedIn: true,
    missingTables: [],
    missingFunctions: [],
    missingColumns: [],
    counts: { organisations: 1, buildings: 1, staff: 3, kiosks: 1, people: 4 },
    remedy: "none",
    ...over,
  };
}

describe("verdict", () => {
  it("is green when everything is applied and set up", () => {
    expect(verdict(health())).toEqual({ tone: "success", line: "Everything is up to date." });
  });

  it("separates EMPTY from BROKEN — a new project is not a fault", () => {
    // this is the distinction the loading screens could not make
    const empty = health({ counts: { organisations: 1, buildings: 0, staff: 0, kiosks: 0, people: 1 } });
    const v = verdict(empty);
    expect(v.tone).toBe("warning");
    expect(v.line).toMatch(/haven't added a site/);
    expect(v.line).not.toMatch(/behind|can't reach/);
  });

  it("nudges to cleaners once a site exists but nobody works there", () => {
    const noStaff = health({ counts: { organisations: 1, buildings: 1, staff: 0, kiosks: 0, people: 1 } });
    expect(verdict(noStaff).line).toMatch(/Add cleaners/);
  });

  it("is critical when the schema is behind, and when the database is unreachable", () => {
    expect(verdict(health({ ok: false, remedy: "bundle" })).tone).toBe("critical");
    expect(verdict(health({ ok: false, remedy: "unreachable" })).line).toMatch(/can't reach/);
  });
});

describe("remedySteps", () => {
  it("asks for nothing when nothing is wrong", () => {
    expect(remedySteps(health())).toEqual([]);
  });

  it("puts REPAIR_SCHEMA BEFORE APPLY_EVERYTHING", () => {
    // order is not cosmetic. The bundle uses `create table if not exists`, so
    // on a drifted project it applies cleanly and changes nothing — running it
    // first makes a missing column look like it has already been fixed.
    const steps = remedySteps(
      health({
        ok: false,
        remedy: "repair",
        missingColumns: ["buildings.slug"],
        missingTables: ["handover_notes"],
      })
    );
    const files = steps.map((s) => s.file).filter(Boolean);
    expect(files).toEqual(["supabase/REPAIR_SCHEMA.sql", "supabase/APPLY_EVERYTHING.sql"]);
  });

  it("names the missing column, because 'buildings.slug' is the whole clue", () => {
    const steps = remedySteps(health({ ok: false, remedy: "repair", missingColumns: ["buildings.slug"] }));
    expect(steps[0]!.detail).toContain("buildings.slug");
  });

  it("asks only for the bundle when whole tables or functions are absent", () => {
    const steps = remedySteps(
      health({ ok: false, remedy: "bundle", missingFunctions: ["site_create"] })
    );
    expect(steps.map((s) => s.file).filter(Boolean)).toEqual(["supabase/APPLY_EVERYTHING.sql"]);
  });

  it("ends by telling them to reload, so the loop closes", () => {
    const steps = remedySteps(health({ ok: false, remedy: "bundle", missingTables: ["staff"] }));
    expect(steps[steps.length - 1]!.title).toMatch(/[Rr]eload/);
  });

  it("says the env vars are wrong — and nothing else — when it can't connect", () => {
    // offering SQL to run against a database you cannot reach is noise
    const steps = remedySteps(health({ ok: false, remedy: "unreachable" }));
    expect(steps).toHaveLength(1);
    expect(steps[0]!.detail).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });
});

describe("listOut", () => {
  it("reads as a sentence, and stops before it becomes a dump", () => {
    expect(listOut([])).toBe("nothing");
    expect(listOut(["a"])).toBe("a");
    expect(listOut(["a", "b"])).toBe("a and b");
    expect(listOut(["a", "b", "c"])).toBe("a, b and c");
    expect(listOut(["a", "b", "c", "d", "e"])).toBe("a, b and c and 2 more");
  });
});
