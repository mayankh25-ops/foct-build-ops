"use client";

/**
 * Today, live (0013). Who is actually here, against who was meant to be.
 *
 * Every state on this screen is decided by the database, not here: one read
 * (`attendance_day`) returns the states, the counts and the grace period it
 * used. If a screen decided for itself what "missed" means, it would sooner or
 * later disagree with whatever emails the supervisor about it.
 *
 * The read also decides whether NAMES may be shown at all. A building owner or
 * concierge gets `detail: false` and the counts — cleaning progress without
 * cleaning staff records.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const ATTENDANCE_LIVE = isSupabaseConfigured;

export type DayState = "on_site" | "finished" | "missed" | "upcoming";

export interface DayShift {
  id: string;
  start_min: number;
  end_min: number;
  zone: string;
  note: string;
}

export interface DayRow {
  staff_id: string;
  staff_name: string;
  role: string;
  active: boolean;
  shifts: DayShift[];
  rostered_minutes: number;
  expected_start_min: number | null;
  expected_end_min: number | null;
  first_in: string | null;
  last_out: string | null;
  open_since: string | null;
  worked_minutes: number;
  sessions: number;
  open_sessions: number;
  recorded_offline: boolean;
  on_site: boolean;
  unrostered: boolean;
  late_minutes: number;
  overdue_minutes: number;
  state: DayState;
}

export interface DaySummary {
  people: number;
  rostered: number;
  on_site: number;
  finished: number;
  upcoming: number;
  missed: number;
  late: number;
  overdue: number;
  unrostered_here: number;
  rostered_minutes: number;
  worked_minutes: number;
}

export interface AttendanceDay {
  date: string;
  timezone: string;
  server_time: string;
  grace_min: number;
  /** false = you may see the counts, not the people */
  detail: boolean;
  summary: DaySummary;
  rows: DayRow[];
}

/** Today's date in the browser's own timezone, as the RPC wants it. */
export function todayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayIso(d);
}

/** What a state is called, and how loudly. */
export const stateMeta: Record<
  DayState,
  { label: string; tone: "success" | "warning" | "critical" | "neutral" }
> = {
  on_site: { label: "On site", tone: "success" },
  finished: { label: "Finished", tone: "neutral" },
  missed: { label: "No check-in", tone: "critical" },
  upcoming: { label: "Later today", tone: "neutral" },
};

/**
 * The one line a supervisor reads per person. Deliberately concrete — "45m
 * late" beats "late", and a missed shift names the time it should have started.
 */
export function dayNote(row: DayRow, timeOfDay: (min: number) => string): string {
  if (row.state === "missed" && row.expected_start_min !== null) {
    return `No check-in for a ${timeOfDay(row.expected_start_min)} start`;
  }
  if (row.overdue_minutes > 0) {
    return `Still signed in ${hm(row.overdue_minutes)} past the finish`;
  }
  if (row.late_minutes > 0) {
    return `Arrived ${hm(row.late_minutes)} late`;
  }
  if (row.unrostered && row.sessions > 0) {
    return "Here today, not on the roster";
  }
  if (row.state === "upcoming" && row.expected_start_min !== null) {
    return `Due at ${timeOfDay(row.expected_start_min)}`;
  }
  return "";
}

function hm(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export async function fetchDay(
  buildingId: string,
  date: string,
  graceMin = 15
): Promise<AttendanceDay> {
  const { data, error } = await getSupabase().rpc("attendance_day", {
    p_building: buildingId,
    p_date: date,
    p_grace_min: graceMin,
  });
  if (error) throw new Error(error.message);
  const res = data as ({ ok: boolean } & AttendanceDay) | null;
  if (!res?.ok) throw new Error("Could not load today");
  return {
    date: res.date,
    timezone: res.timezone,
    server_time: res.server_time,
    grace_min: res.grace_min,
    detail: res.detail,
    summary: res.summary,
    rows: res.rows ?? [],
  };
}
