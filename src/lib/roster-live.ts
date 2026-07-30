"use client";

/**
 * Roster, live (0011). Who is meant to be here, and when.
 *
 * The same rows the timesheet compares against, so "rostered" means one thing
 * in this product. Every rule that could make a roster lie is enforced in the
 * database and reported back as a sentence: a finish before its start, the same
 * person rostered twice at once, somebody else's employee.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const ROSTER_LIVE = isSupabaseConfigured;

export interface RosterShift {
  id: string;
  staff_id: string;
  staff_name: string;
  work_date: string;
  start_min: number;
  end_min: number;
  minutes: number;
  zone: string;
  note: string;
}

export interface RosterStaff {
  id: string;
  name: string;
  role: string;
  rostered_minutes: number;
}

export interface RosterWeek {
  week_start: string;
  timezone: string;
  staff: RosterStaff[];
  shifts: RosterShift[];
}

export interface RosterResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** the refusal was a clash rather than bad input */
  overlap?: boolean;
}

/* ---------------------------------------------------------- time helpers -- */

/** 390 → "06:30" */
export function minToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** "06:30" → 390; null when unparseable, so callers can refuse rather than guess */
export function timeToMin(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function hm(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const core = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
  return minutes < 0 ? `−${core}` : core;
}

/** The seven dates of a week, Monday first. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Would this shift clash with one already on the board? Mirrors the database
 * trigger so the form can say so before a round trip — the server stays the
 * authority, this is only courtesy.
 */
export function clashesWith(
  shifts: RosterShift[],
  candidate: { staffId: string; date: string; startMin: number; endMin: number; ignoreId?: string }
): RosterShift | undefined {
  return shifts.find(
    (s) =>
      s.id !== candidate.ignoreId &&
      s.staff_id === candidate.staffId &&
      s.work_date === candidate.date &&
      candidate.startMin < s.end_min &&
      s.start_min < candidate.endMin
  );
}

/* ----------------------------------------------------------------- reads -- */

export async function fetchRosterWeek(buildingId: string, week: string): Promise<RosterWeek> {
  const { data, error } = await getSupabase().rpc("roster_week", {
    p_building: buildingId,
    p_week_start: week,
  });
  if (error) throw new Error(error.message);
  const res = data as ({ ok: boolean } & RosterWeek) | null;
  if (!res?.ok) throw new Error("Could not load the roster");
  return {
    week_start: res.week_start,
    timezone: res.timezone,
    staff: res.staff ?? [],
    shifts: res.shifts ?? [],
  };
}

/* ---------------------------------------------------------------- writes -- */

export async function saveShift(args: {
  buildingId: string;
  staffId: string;
  date: string;
  startMin: number;
  endMin: number;
  zone?: string;
  note?: string;
  id?: string | null;
}): Promise<RosterResult> {
  const { data, error } = await getSupabase().rpc("roster_shift_set", {
    p_building: args.buildingId,
    p_staff: args.staffId,
    p_work_date: args.date,
    p_start_min: args.startMin,
    p_end_min: args.endMin,
    p_zone: args.zone ?? "",
    p_note: args.note ?? "",
    p_id: args.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return (data as RosterResult) ?? { ok: false, error: "No answer from the server" };
}

export async function deleteShift(id: string): Promise<RosterResult> {
  const { data, error } = await getSupabase().rpc("roster_shift_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return (data as RosterResult) ?? { ok: false, error: "No answer from the server" };
}

export async function copyWeek(
  buildingId: string,
  fromWeek: string,
  toWeek: string
): Promise<{ ok: boolean; copied?: number; skipped?: number; error?: string }> {
  const { data, error } = await getSupabase().rpc("roster_copy_week", {
    p_building: buildingId,
    p_from_week: fromWeek,
    p_to_week: toWeek,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean }) ?? { ok: false, error: "No answer from the server" };
}
