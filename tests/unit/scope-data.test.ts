/**
 * The Scope dataset is contract truth: every figure on /scope, the quote
 * studio and the periodic planner is derived from it. A stray edit to one
 * task line silently shifts a client-facing total, so the reconciliation the
 * file's own header promises is asserted here.
 */
import { describe, expect, it } from "vitest";
import { SCOPE_SEED } from "@/lib/scope-data";

const included = SCOPE_SEED.ocs.filter((o) => o.included);
const countTasks = (ocs: typeof SCOPE_SEED.ocs) =>
  ocs.reduce((n, o) => n + o.zones.reduce((m, z) => m + z.tasks.length, 0), 0);

describe("scope dataset reconciliation", () => {
  it("totals 393.0 contracted hours a week", () => {
    expect(included.reduce((n, o) => n + o.weeklyHours, 0)).toBeCloseTo(393, 1);
  });

  it("carries 222 active and 16 optional scope items", () => {
    expect(countTasks(included)).toBe(222);
    expect(countTasks(SCOPE_SEED.ocs.filter((o) => !o.included))).toBe(16);
  });

  it("rosters 60.0 weekday and 46.5 weekend hours a day", () => {
    const wk = SCOPE_SEED.positions.reduce((n, p) => n + (p.wk?.h ?? 0), 0);
    const we = SCOPE_SEED.positions.reduce((n, p) => n + (p.we?.h ?? 0), 0);
    expect(wk).toBeCloseTo(60, 1);
    expect(we).toBeCloseTo(46.5, 1);
  });

  it("keeps night security's 56 h/week separate from the cleaning contract", () => {
    expect(SCOPE_SEED.security.weeklyHours).toBe(56);
  });
});

describe("scope dataset shape", () => {
  it("gives every entity a unique id and at least one zone", () => {
    const ids = SCOPE_SEED.ocs.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of SCOPE_SEED.ocs) expect(o.zones.length, o.name).toBeGreaterThan(0);
  });

  it("labels every task with a frequency the legend can colour", () => {
    const known = new Set(SCOPE_SEED.frequencies.map((f) => f.key));
    for (const o of SCOPE_SEED.ocs) {
      for (const z of o.zones) {
        for (const t of z.tasks) {
          expect(known.has(t.f), `${o.name} / ${z.name}: unknown frequency "${t.f}"`).toBe(true);
        }
      }
    }
  });

  it("gives every shift paid hours within its span, less at most a 30-min break", () => {
    // Paid hours are never MORE than the clock span, and the only permitted
    // shortfall is the unpaid half-hour break the agreement allows. Anything
    // else is a data-entry slip that would misprice a quote.
    for (const p of SCOPE_SEED.positions) {
      for (const s of [p.wk, p.we]) {
        if (!s) continue;
        const span = s.e >= s.s ? s.e - s.s : 24 - s.s + s.e; // overnight shifts wrap
        const unpaid = span - s.h;
        expect(unpaid, `${p.code} ${s.s}–${s.e} pays ${s.h}h`).toBeGreaterThanOrEqual(0);
        expect(unpaid, `${p.code} ${s.s}–${s.e} pays ${s.h}h`).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("uses no real client names (CLAUDE.md seed rule)", () => {
    const text = JSON.stringify(SCOPE_SEED).toLowerCase();
    expect(text).toContain("aurora on collins");
    for (const banned of ["pty ltd", "strata plan sp"]) expect(text).not.toContain(banned);
  });
});
