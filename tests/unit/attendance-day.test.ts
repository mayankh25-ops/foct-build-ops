/**
 * The sentence a supervisor reads next to each person, and the date maths behind
 * the day picker.
 *
 * The states themselves are the database's job (0013 + its 16 SQL assertions).
 * What is tested here is the part that could quietly mislead: a note that says
 * "late" when someone never arrived, or a day picker that skips a date.
 */
import { describe, expect, it } from "vitest";
import { dayNote, shiftDay, stateMeta, todayIso, type DayRow } from "@/lib/attendance-live";
import { minToTime } from "@/lib/roster-live";

function row(over: Partial<DayRow> = {}): DayRow {
  return {
    staff_id: "s1",
    staff_name: "Alice Ng",
    role: "Cleaner",
    active: true,
    shifts: [{ id: "sh1", start_min: 360, end_min: 840, zone: "Lobby", note: "" }],
    rostered_minutes: 480,
    expected_start_min: 360,
    expected_end_min: 840,
    first_in: "2026-07-30T06:00:00+10:00",
    last_out: null,
    open_since: "2026-07-30T06:00:00+10:00",
    worked_minutes: 0,
    sessions: 1,
    open_sessions: 1,
    recorded_offline: false,
    on_site: true,
    unrostered: false,
    late_minutes: 0,
    overdue_minutes: 0,
    state: "on_site",
    ...over,
  };
}

describe("dayNote", () => {
  it("names the time a missing person was due", () => {
    expect(dayNote(row({ state: "missed", first_in: null, sessions: 0 }), minToTime)).toBe(
      "No check-in for a 06:00 start"
    );
  });

  it("puts the missing shift ahead of anything else it could say", () => {
    // a no-show with a stale late figure must not read as "arrived late"
    const r = row({ state: "missed", first_in: null, sessions: 0, late_minutes: 90 });
    expect(dayNote(r, minToTime)).toMatch(/No check-in/);
  });

  it("says how late, in hours and minutes", () => {
    expect(dayNote(row({ late_minutes: 45 }), minToTime)).toBe("Arrived 45m late");
    expect(dayNote(row({ late_minutes: 95 }), minToTime)).toBe("Arrived 1h 35m late");
    expect(dayNote(row({ late_minutes: 120 }), minToTime)).toBe("Arrived 2h late");
  });

  it("flags someone still signed in long after their finish, ahead of lateness", () => {
    // forgetting to sign out costs them the hours, so it outranks "late"
    expect(dayNote(row({ overdue_minutes: 190, late_minutes: 20 }), minToTime)).toBe(
      "Still signed in 3h 10m past the finish"
    );
  });

  it("names an unexpected extra", () => {
    expect(
      dayNote(
        row({ unrostered: true, shifts: [], rostered_minutes: 0, expected_start_min: null }),
        minToTime
      )
    ).toBe("Here today, not on the roster");
  });

  it("tells you when a later shift is due", () => {
    expect(
      dayNote(
        row({ state: "upcoming", first_in: null, sessions: 0, open_sessions: 0, on_site: false }),
        minToTime
      )
    ).toBe("Due at 06:00");
  });

  it("says nothing when there is nothing to say", () => {
    expect(dayNote(row({ state: "finished", on_site: false, open_sessions: 0 }), minToTime)).toBe("");
  });
});

describe("stateMeta", () => {
  it("makes a no-show loud and a finished shift quiet", () => {
    expect(stateMeta.missed.tone).toBe("critical");
    expect(stateMeta.on_site.tone).toBe("success");
    expect(stateMeta.finished.tone).toBe("neutral");
  });

  it("never calls a missed shift 'missed' to a user — it says what happened", () => {
    // "No check-in" is a fact; "missed" sounds like an accusation before anyone
    // has spoken to the person
    expect(stateMeta.missed.label).toBe("No check-in");
  });
});

describe("todayIso / shiftDay", () => {
  it("formats the LOCAL date, not a UTC-shifted one", () => {
    // 23:30 local on the 30th is still the 30th, whatever UTC thinks
    expect(todayIso(new Date(2026, 6, 30, 23, 30))).toBe("2026-07-30");
    expect(todayIso(new Date(2026, 0, 1, 0, 15))).toBe("2026-01-01");
  });

  it("steps days across months and years", () => {
    expect(shiftDay("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("survives a daylight-saving change", () => {
    // Melbourne moves to AEDT on the first Sunday of October
    expect(shiftDay("2026-10-03", 1)).toBe("2026-10-04");
    expect(shiftDay("2026-10-04", 1)).toBe("2026-10-05");
  });
});
