/**
 * Attendance maths — the layer payroll depends on.
 *
 * These are the calculations a manager cannot eyeball: late-vs-on-site,
 * missed-after-grace, paired hours, per-shift corrections. A regression here
 * is money, so each case below is a rule someone could get wrong in a refactor.
 */
import { describe, expect, it } from "vitest";
import {
  dateKey,
  deriveMissedAlerts,
  deriveShift,
  deriveTimesheets,
  LATE_AFTER_MIN,
  MISSED_GRACE_MIN,
  patternOccurrencesForWeek,
  REVIEW_VARIANCE_H,
  type AttendanceEvent,
  type RosterShift,
  type ShiftPattern,
} from "@/lib/attendance-store";

/** a fixed Tuesday so nothing depends on the day the suite happens to run */
const TUE = new Date("2026-07-21T12:00:00");
const day = dateKey(TUE);

function shift(over: Partial<RosterShift> = {}): RosterShift {
  return { id: "s1", staffId: "marcus", date: day, start: 6, end: 10, zone: "Lobby", ...over };
}

function at(hours: number, minutes = 0): string {
  const d = new Date(`${day}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function ev(kind: "in" | "out", hours: number, minutes = 0, staffId = "marcus"): AttendanceEvent {
  return { id: `${kind}-${hours}-${minutes}`, staffId, kind, at: at(hours, minutes), source: "kiosk" };
}

describe("deriveShift", () => {
  it("is rostered before the start, and still rostered inside the grace window", () => {
    const beforeStart = new Date(`${day}T05:30:00`);
    expect(deriveShift(shift(), [], beforeStart).status).toBe("rostered");

    const insideGrace = new Date(`${day}T06:00:00`);
    insideGrace.setMinutes(MISSED_GRACE_MIN - 1);
    expect(deriveShift(shift(), [], insideGrace).status).toBe("rostered");
  });

  it("is missed once the grace window has passed with no check-in", () => {
    const afterGrace = new Date(`${day}T06:00:00`);
    afterGrace.setMinutes(MISSED_GRACE_MIN + 1);
    expect(deriveShift(shift(), [], afterGrace).status).toBe("missed");
  });

  it("is on-site for a punctual check-in and late past the threshold", () => {
    const onTime = deriveShift(shift(), [ev("in", 6, LATE_AFTER_MIN - 1)], TUE);
    expect(onTime.status).toBe("on-site");

    const late = deriveShift(shift(), [ev("in", 6, LATE_AFTER_MIN + 1)], TUE);
    expect(late.status).toBe("late");
  });

  it("is completed once a check-out follows the check-in", () => {
    const v = deriveShift(shift(), [ev("in", 6), ev("out", 10)], TUE);
    expect(v.status).toBe("completed");
    expect(v.checkIn?.getHours()).toBe(6);
    expect(v.checkOut?.getHours()).toBe(10);
  });

  it("ignores another cleaner's punches", () => {
    const v = deriveShift(shift(), [ev("in", 6, 0, "leila"), ev("out", 10, 0, "leila")], TUE);
    expect(v.status).not.toBe("completed");
  });
});

describe("deriveMissedAlerts", () => {
  it("raises one alert per overdue shift, with minutes overdue", () => {
    const now = new Date(`${day}T07:00:00`);
    const alerts = deriveMissedAlerts([shift()], [], now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.overdueMin).toBe(60);
  });

  it("does not alert once the cleaner has checked in", () => {
    const now = new Date(`${day}T07:00:00`);
    expect(deriveMissedAlerts([shift()], [ev("in", 6)], now)).toHaveLength(0);
  });

  it("only considers today", () => {
    const now = new Date(`${day}T07:00:00`);
    expect(deriveMissedAlerts([shift({ date: "2026-07-20" })], [], now)).toHaveLength(0);
  });
});

describe("deriveTimesheets", () => {
  const rows = (events: AttendanceEvent[], corrections = {}) =>
    deriveTimesheets([shift()], events, {}, TUE, {}, corrections);

  it("pairs in/out into worked hours and computes variance against the roster", () => {
    const row = rows([ev("in", 6), ev("out", 9)]).find((r) => r.staff.id === "marcus")!;
    expect(row.actual).toBe(3);
    expect(row.rostered).toBe(4);
    expect(row.variance).toBe(-1);
  });

  it("flags a row for review when variance exceeds the threshold", () => {
    const within = rows([ev("in", 6), ev("out", 10)]).find((r) => r.staff.id === "marcus")!;
    expect(within.needsReview).toBe(false);

    const over = rows([
      ev("in", 6),
      ev("out", 10, Math.round(REVIEW_VARIANCE_H * 60) + 5),
    ]).find((r) => r.staff.id === "marcus")!;
    expect(over.needsReview).toBe(true);
  });

  it("flags a missed shift for review even with zero variance elsewhere", () => {
    const row = rows([]).find((r) => r.staff.id === "marcus")!;
    expect(row.entries[0]!.status).toBe("missed");
    expect(row.needsReview).toBe(true);
  });

  it("excludes an in-progress shift from the week's totals", () => {
    const row = rows([ev("in", 6)]).find((r) => r.staff.id === "marcus")!;
    expect(row.entries[0]!.inProgress).toBe(true);
    expect(row.actual).toBe(0);
    expect(row.rostered).toBe(0);
  });

  it("applies a manager's per-shift correction to the paid figure, never below zero", () => {
    const plus = rows([ev("in", 6), ev("out", 9)], {
      s1: { delta: 0.5, note: "stayed to finish the lobby" },
    }).find((r) => r.staff.id === "marcus")!;
    expect(plus.actual).toBe(3);
    expect(plus.corrected).toBe(3.5);

    const floored = rows([ev("in", 6), ev("out", 9)], { s1: { delta: -10 } }).find(
      (r) => r.staff.id === "marcus"
    )!;
    expect(floored.corrected).toBe(0);
  });
});

describe("patternOccurrencesForWeek", () => {
  const base: ShiftPattern = {
    id: "p1",
    staffId: "marcus",
    zone: "Lobby",
    start: 6,
    end: 10,
    kind: "ongoing",
    startDate: "2026-01-01",
    weekdays: [0, 1, 2, 3, 4], // Mon–Fri
  };

  it("expands weekdays inside the week containing `now`", () => {
    const out = patternOccurrencesForWeek(base, TUE);
    expect(out).toHaveLength(5);
    expect(out[0]!.date).toBe("2026-07-20"); // Monday
    expect(out[4]!.date).toBe("2026-07-24"); // Friday
  });

  it("never starts before the pattern's own start date", () => {
    const out = patternOccurrencesForWeek({ ...base, startDate: "2026-07-22" }, TUE);
    expect(out.map((s) => s.date)).toEqual(["2026-07-22", "2026-07-23", "2026-07-24"]);
  });

  it("stops a temporary pattern at its end date", () => {
    const out = patternOccurrencesForWeek(
      { ...base, kind: "temporary", endDate: "2026-07-21" },
      TUE
    );
    expect(out.map((s) => s.date)).toEqual(["2026-07-20", "2026-07-21"]);
  });

  it("tags each occurrence with its pattern so edits stay traceable", () => {
    expect(patternOccurrencesForWeek(base, TUE).every((s) => s.patternId === "p1")).toBe(true);
  });
});
