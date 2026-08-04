/**
 * Changing an event after it has been added: who may, and what happens to the
 * ones already on the calendar.
 *
 * The cases that matter are the ones where a change quietly misleads somebody:
 * an admin-locked event edited by a contractor, a recurring job "stopped" in a
 * way that also erases the dates it already ran, and a cancellation that just
 * deletes the entry so nobody can tell whether it was moved or forgotten.
 */
import { describe, expect, it } from "vitest";
import {
  canModify,
  seriesEventsForMonth,
  manualEventsForMonth,
  type CalEvent,
  type CalSeries,
} from "@/lib/calendar-store";

const base: CalEvent = {
  id: "e1",
  title: "Window clean — north face",
  date: "2026-08-12",
  category: "contractor",
  source: "manual",
  visibility: "everyone",
  createdBy: "cleaning",
};

describe("canModify", () => {
  it("lets whoever can see a normal manual event change it", () => {
    expect(canModify(base, "cleaning")).toBe(true);
    expect(canModify(base, "concierge")).toBe(true);
    expect(canModify(base, "admin")).toBe(true);
  });

  it("reserves an ADMIN-LOCKED event to the building admin", () => {
    const locked = { ...base, locked: true };
    expect(canModify(locked, "admin")).toBe(true);
    expect(canModify(locked, "cleaning")).toBe(false);
    expect(canModify(locked, "concierge")).toBe(false);
  });

  it("never lets anybody edit what came from the agreement or the seed", () => {
    // those are derived from the contract; editing them here would put the
    // calendar and the scope document out of step
    expect(canModify({ ...base, source: "scope" }, "admin")).toBe(false);
    expect(canModify({ ...base, source: "seed" }, "admin")).toBe(false);
  });
});

describe("ending a recurring event", () => {
  const series: CalSeries = {
    id: "s1",
    title: "Bin room wash-down",
    startDate: "2026-08-03",
    repeat: "weekly",
    category: "maintenance",
    visibility: "everyone",
    createdBy: "cleaning",
  };

  it("runs every week while it is open", () => {
    const august = seriesEventsForMonth([series], 2026, 7); // 7 = August
    expect(august.length).toBeGreaterThanOrEqual(4);
  });

  it("STOPS after the end date, and keeps everything before it", () => {
    // "end after this date" is not "delete": the two occurrences that already
    // happened stay on the calendar, and nothing new appears
    const ended = { ...series, until: "2026-08-10" };
    const august = seriesEventsForMonth([ended], 2026, 7).map((e) => e.date);
    expect(august).toContain("2026-08-03");
    expect(august).toContain("2026-08-10");
    expect(august.some((d) => d > "2026-08-10")).toBe(false);
  });

  it("carries a cancellation onto every occurrence, rather than hiding them", () => {
    const off = { ...series, status: "cancelled" as const, cancelReason: "contractor unavailable" };
    const august = seriesEventsForMonth([off], 2026, 7);
    expect(august.length).toBeGreaterThan(0);
    expect(august.every((e) => e.status === "cancelled")).toBe(true);
    expect(august[0]!.cancelReason).toBe("contractor unavailable");
  });
});

describe("a cancelled one-off", () => {
  it("stays on the calendar so nobody turns up to a locked door", () => {
    const cancelled: CalEvent = {
      ...base,
      status: "cancelled",
      cancelReason: "moved to September",
    };
    const august = manualEventsForMonth([cancelled], 2026, 7);
    expect(august).toHaveLength(1);
    expect(august[0]!.status).toBe("cancelled");
  });

  it("keeps its reason across every day of a multi-day span", () => {
    const span: CalEvent = {
      ...base,
      date: "2026-08-12",
      endDate: "2026-08-14",
      status: "cancelled",
      cancelReason: "lift booking clashed",
    };
    const days = manualEventsForMonth([span], 2026, 7);
    expect(days).toHaveLength(3);
    expect(days.every((d) => d.cancelReason === "lift booking clashed")).toBe(true);
  });
});
