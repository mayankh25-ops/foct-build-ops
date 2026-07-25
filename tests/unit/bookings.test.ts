/**
 * Amenity booking conflicts — double-booking the cinema is the kind of defect
 * a resident notices before we do. Overlap rules are inclusive at the edges
 * on purpose: a 18:00–20:00 booking must NOT block a 20:00–22:00 one.
 */
import { describe, expect, it } from "vitest";
import { conflictingBookings, type AmenityBooking } from "@/lib/residents-store";

const DAY = "2026-07-21";

function booking(over: Partial<AmenityBooking> = {}): AmenityBooking {
  return {
    id: "b1",
    residentId: "r1",
    amenityId: "cinema",
    date: DAY,
    start: 18,
    end: 20,
    guests: 2,
    status: "confirmed",
    ...over,
  };
}

const find = (existing: AmenityBooking[], start: number, end: number, ignoreId?: string) =>
  conflictingBookings(existing, "cinema", DAY, start, end, ignoreId);

describe("conflictingBookings", () => {
  it("finds an overlap that starts inside an existing booking", () => {
    expect(find([booking()], 19, 21)).toHaveLength(1);
  });

  it("finds an overlap that fully contains an existing booking", () => {
    expect(find([booking()], 17, 22)).toHaveLength(1);
  });

  it("allows back-to-back bookings that only touch at the boundary", () => {
    expect(find([booking()], 20, 22)).toHaveLength(0);
    expect(find([booking()], 16, 18)).toHaveLength(0);
  });

  it("ignores a different amenity, a different day, and declined bookings", () => {
    expect(find([booking({ amenityId: "karaoke" })], 19, 21)).toHaveLength(0);
    expect(find([booking({ date: "2026-07-22" })], 19, 21)).toHaveLength(0);
    expect(find([booking({ status: "declined" })], 19, 21)).toHaveLength(0);
  });

  it("still blocks against a pending booking — first in, first served", () => {
    expect(find([booking({ status: "pending" })], 19, 21)).toHaveLength(1);
  });

  it("does not conflict with itself when a booking is being edited", () => {
    expect(find([booking()], 18, 20, "b1")).toHaveLength(0);
  });
});
