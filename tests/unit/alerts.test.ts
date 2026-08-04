/**
 * The words an alert uses, and the recipient list behind it.
 *
 * The sentence matters more than it looks: it appears on screen AND in the
 * email, and a supervisor acts on it without opening anything else. It has to
 * name the person and the time, and it must never claim a send that did not
 * happen.
 */
import { describe, expect, it } from "vitest";
import { alertLine, deliveryNote, parseEmails, type OpenAlert } from "@/lib/alerts-live";

function alert(over: Partial<OpenAlert> = {}): OpenAlert {
  return {
    id: "a1",
    kind: "missed",
    staff_id: "s1",
    staff_name: "Alice Ng",
    work_date: "2026-07-30",
    due_min: 360,
    raised_at: "2026-07-30T06:15:00+10:00",
    notified_at: null,
    notify_error: null,
    ...over,
  };
}

describe("alertLine", () => {
  it("names the person and the time they were due", () => {
    expect(alertLine(alert())).toBe("Alice Ng has not checked in for a 06:00 start");
  });

  it("still says something useful without a rostered time", () => {
    expect(alertLine(alert({ due_min: null }))).toBe("Alice Ng has not checked in");
  });

  it("describes a forgotten sign-out as exactly that, not as a no-show", () => {
    // the two are opposite problems — one person is missing, the other is
    // (probably) long gone but still on the clock
    expect(alertLine(alert({ kind: "overdue", due_min: 840 }))).toBe(
      "Alice Ng is still signed in — the shift ended at 14:00"
    );
  });

  it("pads the clock so 06:05 never reads as 6:5", () => {
    expect(alertLine(alert({ due_min: 365 }))).toContain("06:05");
    expect(alertLine(alert({ due_min: 0 }))).toContain("00:00");
  });
});

describe("deliveryNote", () => {
  it("never claims a send that has not happened", () => {
    expect(deliveryNote(alert(), true)).toBe("Email queued");
  });

  it("says plainly when nobody is listening", () => {
    expect(deliveryNote(alert(), false)).toBe("On screen only — no recipients set");
  });

  it("surfaces a failed send instead of swallowing it", () => {
    // silence about a failed alert is the worst outcome this feature can have
    expect(deliveryNote(alert({ notify_error: "provider rejected" }), true)).toBe(
      "Email failed: provider rejected"
    );
  });

  it("a failure outranks a stale success stamp", () => {
    expect(
      deliveryNote(alert({ notified_at: "2026-07-30T06:20:00+10:00", notify_error: "bounced" }), true)
    ).toMatch(/failed/);
  });
});

describe("parseEmails", () => {
  it("splits on commas, semicolons and newlines, and trims", () => {
    expect(parseEmails("a@b.com, c@d.com;e@f.com\n g@h.com ")).toEqual([
      "a@b.com",
      "c@d.com",
      "e@f.com",
      "g@h.com",
    ]);
  });

  it("drops empties rather than sending to an empty address", () => {
    expect(parseEmails("a@b.com,,  ,")).toEqual(["a@b.com"]);
    expect(parseEmails("   ")).toEqual([]);
  });
});
