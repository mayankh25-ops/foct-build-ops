/**
 * The handover timeline's display rules.
 *
 * A handover is read twice: once during the shift ("3h ago" is what you want)
 * and once weeks later in an argument about what happened ("18:40 on the 3rd"
 * is the only thing that helps). It has to carry both, and it has to file a
 * late-night note under the right DAY.
 */
import { describe, expect, it } from "vitest";
import {
  dayHeading,
  groupByDay,
  noteTime,
  relative,
  type HandoverNote,
} from "@/lib/handover-live";

function note(over: Partial<HandoverNote> = {}): HandoverNote {
  return {
    id: "n1",
    body: "Loading dock closed until 06:30.",
    kind: "info",
    created_at: "2026-08-04T08:40:00+10:00",
    work_date: "2026-08-04",
    author_id: "u1",
    author: "Priya Sharma",
    deleted: false,
    deleted_at: null,
    mine: false,
    can_delete: false,
    ...over,
  };
}

describe("relative", () => {
  const now = new Date("2026-08-04T12:00:00+10:00");

  it("reads the way somebody would say it", () => {
    expect(relative("2026-08-04T11:59:40+10:00", now)).toBe("just now");
    expect(relative("2026-08-04T11:30:00+10:00", now)).toBe("30m ago");
    expect(relative("2026-08-04T09:00:00+10:00", now)).toBe("3h ago");
    expect(relative("2026-08-03T12:00:00+10:00", now)).toBe("yesterday");
    expect(relative("2026-07-30T12:00:00+10:00", now)).toBe("5d ago");
  });
});

describe("noteTime", () => {
  it("is a 24-hour clock, zero-padded — the thing you quote later", () => {
    expect(noteTime("2026-08-04T06:05:00+10:00", "Australia/Melbourne")).toBe("06:05");
    expect(noteTime("2026-08-04T18:40:00+10:00", "Australia/Melbourne")).toBe("18:40");
  });

  it("shows the BUILDING's time, not the reader's", () => {
    // a manager reading Melbourne's log from Perth must still see 18:40, or
    // every time they quote back is wrong by the offset
    const iso = "2026-08-04T18:40:00+10:00";
    expect(noteTime(iso, "Australia/Melbourne")).toBe("18:40");
    expect(noteTime(iso, "Australia/Perth")).toBe("16:40");
  });
});

describe("dayHeading", () => {
  const today = new Date(2026, 7, 4); // 4 Aug 2026, local

  it("names today and yesterday, and dates everything else", () => {
    expect(dayHeading("2026-08-04", today)).toMatch(/^Today · /);
    expect(dayHeading("2026-08-03", today)).toMatch(/^Yesterday · /);
    expect(dayHeading("2026-07-28", today)).not.toMatch(/Today|Yesterday/);
  });

  it("still says 'yesterday' across a month boundary", () => {
    expect(dayHeading("2026-07-31", new Date(2026, 7, 1))).toMatch(/^Yesterday · /);
  });

  it("uses the SITE's today: 08:00 in Melbourne is still yesterday in London", () => {
    const moment = new Date("2026-08-04T08:00:00+10:00"); // 22:00 on the 3rd, UTC
    expect(dayHeading("2026-08-04", moment, "Australia/Melbourne")).toMatch(/^Today · /);
    expect(dayHeading("2026-08-04", moment, "Europe/London")).not.toMatch(/^Today/);
  });
});

describe("groupByDay", () => {
  it("keeps the newest-first order and groups runs of the same day", () => {
    const groups = groupByDay([
      note({ id: "a", work_date: "2026-08-04" }),
      note({ id: "b", work_date: "2026-08-04" }),
      note({ id: "c", work_date: "2026-08-03" }),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-04", "2026-08-03"]);
    expect(groups[0]!.notes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("trusts the server's work_date rather than re-deriving a day from the timestamp", () => {
    // 23:40 in Melbourne is 13:40 UTC the same day, but a naive
    // `new Date(...).getDate()` in another timezone would file it under
    // tomorrow. The grouping uses what the database said.
    const groups = groupByDay([
      note({ id: "late", created_at: "2026-08-04T23:40:00+10:00", work_date: "2026-08-04" }),
    ]);
    expect(groups[0]!.date).toBe("2026-08-04");
  });

  it("returns nothing for nothing", () => {
    expect(groupByDay([])).toEqual([]);
  });
});
