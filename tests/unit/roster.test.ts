/**
 * Roster time arithmetic and the clash check.
 *
 * A roster that lies costs somebody a shift or pays for two at once, so the
 * cases here are the ways it lies: a time parsed loosely, a week that skips a
 * day across a month or daylight-saving boundary, and an overlap the form lets
 * through because it only compared start times.
 */
import { describe, expect, it } from "vitest";
import {
  clashesWith,
  hm,
  minToTime,
  timeToMin,
  weekDays,
  type RosterShift,
} from "@/lib/roster-live";

function shift(over: Partial<RosterShift> = {}): RosterShift {
  return {
    id: "sh1",
    staff_id: "s1",
    staff_name: "Alice Ng",
    work_date: "2026-07-27",
    start_min: 6 * 60,
    end_min: 14 * 60,
    minutes: 480,
    zone: "Lobby",
    note: "",
    ...over,
  };
}

describe("minToTime / timeToMin", () => {
  it("round-trips a time of day", () => {
    expect(minToTime(390)).toBe("06:30");
    expect(minToTime(0)).toBe("00:00");
    expect(minToTime(1439)).toBe("23:59");
    expect(timeToMin("06:30")).toBe(390);
    expect(timeToMin("00:00")).toBe(0);
    expect(timeToMin("6:05")).toBe(365); // a single-digit hour is still a time
  });

  it("refuses anything it cannot read rather than guessing", () => {
    // Guessing here would silently roster the wrong hours.
    for (const bad of ["", "6", "6.30", "0630", "25:00", "06:60", "half six", "06:3"]) {
      expect(timeToMin(bad)).toBeNull();
    }
  });

  it("tolerates surrounding whitespace, since a keyboard adds it", () => {
    expect(timeToMin("  14:00 ")).toBe(840);
  });
});

describe("hm", () => {
  it("reads like hours, not minutes", () => {
    expect(hm(480)).toBe("8h");
    expect(hm(510)).toBe("8h 30m");
    expect(hm(45)).toBe("45m");
    expect(hm(0)).toBe("0m");
  });

  it("marks a negative figure with a real minus sign, not a hyphen", () => {
    expect(hm(-90)).toBe("−1h 30m");
  });
});

describe("weekDays", () => {
  it("returns seven consecutive dates from the Monday", () => {
    expect(weekDays("2026-07-27")).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("crosses a month and a year end without dropping a day", () => {
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("survives a daylight-saving change", () => {
    // Melbourne moves to AEDT on the first Sunday of October: a naive
    // midnight + 24h walk repeats or skips that date.
    const days = weekDays("2026-09-28");
    expect(days).toHaveLength(7);
    expect(new Set(days).size).toBe(7);
    expect(days[6]).toBe("2026-10-04");
  });
});

describe("clashesWith", () => {
  const board = [
    shift({ id: "a", start_min: 6 * 60, end_min: 14 * 60 }),
    shift({ id: "b", staff_id: "s2", start_min: 6 * 60, end_min: 14 * 60 }),
  ];

  it("catches an overlap for the same person on the same day", () => {
    expect(
      clashesWith(board, { staffId: "s1", date: "2026-07-27", startMin: 13 * 60, endMin: 18 * 60 })
        ?.id
    ).toBe("a");
  });

  it("catches a shift wholly INSIDE another — a start-time comparison misses this", () => {
    expect(
      clashesWith(board, { staffId: "s1", date: "2026-07-27", startMin: 8 * 60, endMin: 9 * 60 })
        ?.id
    ).toBe("a");
  });

  it("catches one that SWALLOWS an existing shift", () => {
    expect(
      clashesWith(board, { staffId: "s1", date: "2026-07-27", startMin: 5 * 60, endMin: 20 * 60 })
        ?.id
    ).toBe("a");
  });

  it("allows back-to-back shifts — a 14:00 finish and a 14:00 start", () => {
    expect(
      clashesWith(board, { staffId: "s1", date: "2026-07-27", startMin: 14 * 60, endMin: 18 * 60 })
    ).toBeUndefined();
  });

  it("allows two different people over the same hours", () => {
    expect(
      clashesWith([board[0]!], { staffId: "s9", date: "2026-07-27", startMin: 6 * 60, endMin: 14 * 60 })
    ).toBeUndefined();
  });

  it("allows the same hours on another day", () => {
    expect(
      clashesWith(board, { staffId: "s1", date: "2026-07-28", startMin: 6 * 60, endMin: 14 * 60 })
    ).toBeUndefined();
  });

  it("does not report a shift clashing with itself when it is being edited", () => {
    expect(
      clashesWith(board, {
        staffId: "s1",
        date: "2026-07-27",
        startMin: 5 * 60,
        endMin: 13 * 60,
        ignoreId: "a",
      })
    ).toBeUndefined();
  });
});
