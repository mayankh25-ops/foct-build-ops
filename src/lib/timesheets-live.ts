"use client";

/**
 * Timesheets, live (0010).
 *
 * One RPC returns the week exactly as payroll should see it — sessions,
 * corrections, roster comparison and the current decision — so the screen and
 * the CSV export can never disagree about what someone is owed.
 *
 * The rules this layer relies on, all enforced in the database rather than
 * here: a correction needs a reason, a rejection needs a reason, an approved
 * week is locked until reopened, and one decision row exists per person per
 * week.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const TIMESHEETS_LIVE = isSupabaseConfigured;

export type WeekStatus = "pending" | "approved" | "rejected";

export interface LiveSession {
  session_event_id: string;
  work_date: string;
  in_at: string;
  out_at: string | null;
  minutes: number | null;
  recorded_offline: boolean;
  selfie_path: string | null;
  adjustment_minutes: number;
  adjustment_note: string;
}

export interface LiveWeekRow {
  staff_id: string;
  staff_name: string;
  role: string;
  active: boolean;
  rostered_minutes: number;
  worked_minutes: number;
  adjustment_minutes: number;
  open_sessions: number;
  status: WeekStatus;
  approved_minutes: number | null;
  note: string;
  decided_at: string | null;
  decided_by: string | null;
  sessions: LiveSession[];
}

export interface LiveWeek {
  week_start: string;
  timezone: string;
  rows: LiveWeekRow[];
}

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function weekStart(d: Date = new Date()): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  monday.setHours(12, 0, 0, 0); // midday avoids DST edges either side
  return monday.toISOString().slice(0, 10);
}

export function shiftWeek(week: string, deltaWeeks: number): string {
  const d = new Date(`${week}T12:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

/** What payroll pays: the override if a manager set one, else worked + corrections. */
export function payableMinutes(row: LiveWeekRow): number {
  if (row.status === "approved" && row.approved_minutes !== null) return row.approved_minutes;
  return Math.max(0, row.worked_minutes + row.adjustment_minutes);
}

export function varianceMinutes(row: LiveWeekRow): number {
  return payableMinutes(row) - row.rostered_minutes;
}

/* --------------------------------------------------------------- reads -- */

export async function fetchWeek(buildingId: string, week: string): Promise<LiveWeek> {
  const { data, error } = await getSupabase().rpc("timesheet_week", {
    p_building: buildingId,
    p_week_start: week,
  });
  if (error) throw new Error(error.message);
  const res = data as ({ ok: boolean } & LiveWeek) | null;
  if (!res?.ok) throw new Error("Could not load the week");
  return { week_start: res.week_start, timezone: res.timezone, rows: res.rows ?? [] };
}

/* ------------------------------------------------------------- writes --- */

export interface WriteResult {
  ok: boolean;
  error?: string;
  /** the week is approved and refuses changes until reopened */
  locked?: boolean;
}

export async function adjustSession(
  sessionEventId: string,
  deltaMinutes: number,
  note: string
): Promise<WriteResult> {
  const { data, error } = await getSupabase().rpc("attendance_adjust", {
    p_session_event: sessionEventId,
    p_delta_minutes: Math.round(deltaMinutes),
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  return (data as WriteResult) ?? { ok: false, error: "No answer from the server" };
}

export async function decideWeek(args: {
  buildingId: string;
  staffId: string;
  week: string;
  status: WeekStatus;
  minutes?: number | null;
  note?: string;
}): Promise<WriteResult & { approved_minutes?: number; open_sessions?: number }> {
  const { data, error } = await getSupabase().rpc("timesheet_decide", {
    p_building: args.buildingId,
    p_staff: args.staffId,
    p_week_start: args.week,
    p_status: args.status,
    p_minutes: args.minutes ?? null,
    p_note: args.note ?? "",
  });
  if (error) return { ok: false, error: error.message };
  return (data as WriteResult) ?? { ok: false, error: "No answer from the server" };
}

/* -------------------------------------------------------------- export -- */

const csvCell = (v: string | number | null | undefined): string => {
  const s = v === null || v === undefined ? "" : String(v);
  // a leading =, +, - or @ makes Excel treat text as a formula
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const hhmm = (mins: number | null): string =>
  mins === null ? "" : `${Math.floor(mins / 60)}:${String(Math.abs(mins % 60)).padStart(2, "0")}`;

/**
 * Payroll CSV. One row per SESSION, not per person: a payroll clerk needs to
 * see where the hours came from, and a per-person summary hides exactly the
 * detail that gets queried. Decimal hours are included because most payroll
 * systems import those, not h:mm.
 */
export function weekToCsv(week: LiveWeek, siteName: string): string {
  const header = [
    "Site",
    "Week starting",
    "Employee",
    "Role",
    "Date",
    "Signed in",
    "Signed out",
    "Worked (h:mm)",
    "Correction (min)",
    "Correction reason",
    "Recorded offline",
    "Week status",
    "Week paid (h:mm)",
    "Week paid (decimal)",
    "Decided by",
    "Decided at",
    "Week note",
  ];

  const time = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-AU", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : "";

  const lines = [header.map(csvCell).join(",")];

  for (const row of week.rows) {
    const paid = payableMinutes(row);
    const weekFields = [
      row.status,
      hhmm(paid),
      (paid / 60).toFixed(2),
      row.decided_by ?? "",
      row.decided_at ? new Date(row.decided_at).toLocaleString("en-AU") : "",
      row.note,
    ];

    if (row.sessions.length === 0) {
      lines.push(
        [siteName, week.week_start, row.staff_name, row.role, "", "", "", "", "", "", "", ...weekFields]
          .map(csvCell)
          .join(",")
      );
      continue;
    }

    for (const s of row.sessions) {
      lines.push(
        [
          siteName,
          week.week_start,
          row.staff_name,
          row.role,
          s.work_date,
          time(s.in_at),
          s.out_at ? time(s.out_at) : "STILL ON SITE",
          hhmm(s.minutes),
          s.adjustment_minutes || "",
          s.adjustment_note,
          s.recorded_offline ? "yes" : "",
          ...weekFields,
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }

  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 names (Nguyễn, Kaur) correctly
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
