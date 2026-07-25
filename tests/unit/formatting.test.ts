/**
 * Number and time formatting shown to managers and cleaners.
 *
 * These read as cosmetic until a payroll conversation happens over a screen
 * that said "0h" when it meant "0h 30m", so the rounding and the sign are
 * pinned here. Note the minus sign is U+2212, not a hyphen — the typography
 * rule from the design audit, and easy to lose in a refactor.
 */
import { describe, expect, it } from "vitest";
import { fmtDeltaHM, fmtHM, fmtTime } from "@/lib/demo-data";

describe("fmtHM", () => {
  it("formats whole hours, minutes, and both", () => {
    expect(fmtHM(0)).toBe("0m");
    expect(fmtHM(2)).toBe("2h");
    expect(fmtHM(0.5)).toBe("30m");
    expect(fmtHM(18 + 16 / 60)).toBe("18h 16m");
  });

  it("pads single-digit minutes so columns line up", () => {
    expect(fmtHM(1 + 5 / 60)).toBe("1h 05m");
  });

  it("rounds to the nearest minute rather than truncating", () => {
    expect(fmtHM(1 + 29.6 / 60)).toBe("1h 30m");
  });

  it("uses a real minus sign for negatives", () => {
    expect(fmtHM(-1.5)).toBe("−1h 30m");
    expect(fmtHM(-1.5).startsWith("-")).toBe(false);
  });
});

describe("fmtDeltaHM", () => {
  it("shows an explicit sign, and plain zero for no variance", () => {
    expect(fmtDeltaHM(0)).toBe("0m");
    expect(fmtDeltaHM(16 / 60)).toBe("+16 min");
    expect(fmtDeltaHM(-(2 + 50 / 60))).toBe("−2h 50m");
  });

  it("treats a sub-half-minute variance as zero, not as a signed nothing", () => {
    expect(fmtDeltaHM(0.004)).toBe("0m");
  });
});

describe("fmtTime", () => {
  it("renders decimal hours as a 24-hour clock", () => {
    expect(fmtTime(6)).toBe("06:00");
    expect(fmtTime(18.5)).toBe("18:30");
  });

  it("renders an em dash when there is no time, rather than 00:00", () => {
    expect(fmtTime(null)).toBe("—");
    expect(fmtTime(undefined)).toBe("—");
  });
});
