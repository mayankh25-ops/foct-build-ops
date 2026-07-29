/**
 * Timesheet arithmetic and the payroll export.
 *
 * Everything here decides what someone is paid, so the cases are the ways a
 * week gets it wrong: a manager's override ignored, an unclosed shift silently
 * counted, a variance with the wrong sign, or a CSV that Excel mangles.
 */
import { describe, expect, it } from "vitest";
import {
  payableMinutes,
  shiftWeek,
  varianceMinutes,
  weekStart,
  weekToCsv,
  type LiveWeek,
  type LiveWeekRow,
} from "@/lib/timesheets-live";

function row(over: Partial<LiveWeekRow> = {}): LiveWeekRow {
  return {
    staff_id: "s1",
    staff_name: "Alice Ng",
    role: "Cleaner",
    active: true,
    rostered_minutes: 480,
    worked_minutes: 450,
    adjustment_minutes: 0,
    open_sessions: 0,
    status: "pending",
    approved_minutes: null,
    note: "",
    decided_at: null,
    decided_by: null,
    sessions: [],
    ...over,
  };
}

describe("weekStart", () => {
  it("returns the Monday of the week, whatever day you ask on", () => {
    // 2026-07-29 is a Wednesday; its Monday is the 27th
    expect(weekStart(new Date("2026-07-29T09:00:00"))).toBe("2026-07-27");
    expect(weekStart(new Date("2026-07-27T23:30:00"))).toBe("2026-07-27");
    // Sunday belongs to the week that started six days earlier, not the next one
    expect(weekStart(new Date("2026-08-02T06:00:00"))).toBe("2026-07-27");
  });

  it("steps a week at a time in both directions", () => {
    expect(shiftWeek("2026-07-27", -1)).toBe("2026-07-20");
    expect(shiftWeek("2026-07-27", 1)).toBe("2026-08-03");
    // and across a month boundary without drifting
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  });
});

describe("payableMinutes", () => {
  it("pays worked hours plus corrections while pending", () => {
    expect(payableMinutes(row({ worked_minutes: 450, adjustment_minutes: 30 }))).toBe(480);
    expect(payableMinutes(row({ worked_minutes: 450, adjustment_minutes: -60 }))).toBe(390);
  });

  it("never pays a negative number, however large the correction", () => {
    expect(payableMinutes(row({ worked_minutes: 60, adjustment_minutes: -600 }))).toBe(0);
  });

  it("honours a manager's override once approved", () => {
    const r = row({ status: "approved", worked_minutes: 450, adjustment_minutes: 30, approved_minutes: 300 });
    expect(payableMinutes(r)).toBe(300);
  });

  it("ignores a stale override while the week is pending", () => {
    // reopening clears approved_minutes server-side, but a cached row must not
    // quietly keep paying the old figure
    const r = row({ status: "pending", approved_minutes: 300, worked_minutes: 450 });
    expect(payableMinutes(r)).toBe(450);
  });
});

describe("varianceMinutes", () => {
  it("is negative when someone worked less than rostered", () => {
    expect(varianceMinutes(row({ rostered_minutes: 480, worked_minutes: 450 }))).toBe(-30);
  });

  it("is positive when they worked more", () => {
    expect(varianceMinutes(row({ rostered_minutes: 480, worked_minutes: 540 }))).toBe(60);
  });

  it("measures against what is PAID, not what was punched", () => {
    const r = row({ rostered_minutes: 480, worked_minutes: 400, adjustment_minutes: 80 });
    expect(varianceMinutes(r)).toBe(0);
  });
});

describe("weekToCsv", () => {
  const week: LiveWeek = {
    week_start: "2026-07-27",
    timezone: "Australia/Melbourne",
    rows: [
      row({
        staff_name: "Alice Ng",
        worked_minutes: 330,
        adjustment_minutes: 45,
        sessions: [
          {
            session_event_id: "e1",
            work_date: "2026-07-27",
            in_at: "2026-07-27T06:00:00+10:00",
            out_at: "2026-07-27T08:00:00+10:00",
            minutes: 120,
            recorded_offline: false,
            selfie_path: null,
            adjustment_minutes: 45,
            adjustment_note: "stayed to finish the lobby",
          },
          {
            session_event_id: "e2",
            work_date: "2026-07-28",
            in_at: "2026-07-28T06:00:00+10:00",
            out_at: null,
            minutes: null,
            recorded_offline: true,
            selfie_path: null,
            adjustment_minutes: 0,
            adjustment_note: "",
          },
        ],
      }),
    ],
  };

  const csv = weekToCsv(week, "Aurora on Collins");
  const lines = csv.split("\n");

  it("writes one row per session, not one per person", () => {
    expect(lines).toHaveLength(3); // header + two sessions
  });

  it("names the site and the week on every row, so merged exports stay readable", () => {
    expect(lines[1]).toContain("Aurora on Collins");
    expect(lines[1]).toContain("2026-07-27");
    expect(lines[2]).toContain("Aurora on Collins");
  });

  it("carries the correction and its reason", () => {
    expect(lines[1]).toContain("45");
    expect(lines[1]).toContain("stayed to finish the lobby");
  });

  it("says STILL ON SITE rather than leaving a sign-out blank", () => {
    expect(lines[2]).toContain("STILL ON SITE");
  });

  it("flags what was recorded offline", () => {
    expect(lines[2]).toContain("yes");
  });

  it("includes decimal hours, because payroll systems import those", () => {
    expect(lines[1]).toContain("6.25"); // 330 + 45 = 375 minutes
  });

  it("quotes a reason containing a comma instead of breaking the columns", () => {
    const tricky = weekToCsv(
      {
        ...week,
        rows: [
          row({
            sessions: [
              {
                ...week.rows[0]!.sessions[0]!,
                adjustment_note: 'ran over, agreed with "the site"',
              },
            ],
          }),
        ],
      },
      "Aurora"
    );
    expect(tricky).toContain('"ran over, agreed with ""the site"""');
    expect(tricky.split("\n")).toHaveLength(2);
  });

  it("neutralises a note that Excel would treat as a formula", () => {
    const dangerous = weekToCsv(
      {
        ...week,
        rows: [
          row({
            sessions: [{ ...week.rows[0]!.sessions[0]!, adjustment_note: "=1+1" }],
          }),
        ],
      },
      "Aurora"
    );
    expect(dangerous).toContain("'=1+1");
  });

  it("still exports someone with no sessions, rather than dropping them", () => {
    const empty = weekToCsv({ ...week, rows: [row({ sessions: [], worked_minutes: 0 })] }, "Aurora");
    expect(empty.split("\n")).toHaveLength(2);
    expect(empty).toContain("Alice Ng");
  });
});
