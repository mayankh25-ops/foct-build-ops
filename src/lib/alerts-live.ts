"use client";

/**
 * Missed check-in alerts, live (0014).
 *
 * An alert is raised by the scheduled scan, not by this screen — so what a
 * manager sees here is exactly what was (or will be) emailed. Acknowledging is
 * a resolution with a name on it, never a delete: "I know, I called her" is the
 * useful record when somebody asks next week.
 */
import { getSupabase } from "@/lib/supabase";

export type AlertKind = "missed" | "overdue";

export interface OpenAlert {
  id: string;
  kind: AlertKind;
  staff_id: string;
  staff_name: string;
  work_date: string;
  due_min: number | null;
  raised_at: string;
  notified_at: string | null;
  notify_error: string | null;
}

export interface AlertSettings {
  building_id: string;
  org_id: string;
  enabled: boolean;
  grace_min: number;
  overdue_after_min: number;
  raise_overdue: boolean;
  notify_emails: string[];
  configured: boolean;
}

/** 390 → "06:30" (kept local so the alerts layer stands on its own) */
function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * The sentence in the alert, and in the email. One definition, so the screen
 * and the inbox never word the same fact differently.
 */
export function alertLine(a: Pick<OpenAlert, "kind" | "staff_name" | "due_min">): string {
  if (a.kind === "missed") {
    return a.due_min === null
      ? `${a.staff_name} has not checked in`
      : `${a.staff_name} has not checked in for a ${hhmm(a.due_min)} start`;
  }
  return a.due_min === null
    ? `${a.staff_name} is still signed in`
    : `${a.staff_name} is still signed in — the shift ended at ${hhmm(a.due_min)}`;
}

/** How an unsent alert reads. Silence about a failed send would be the worst
 *  outcome of an alerting feature, so it is stated. */
export function deliveryNote(a: OpenAlert, hasRecipients: boolean): string {
  if (a.notify_error) return `Email failed: ${a.notify_error}`;
  if (a.notified_at) return `Emailed ${new Date(a.notified_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return hasRecipients ? "Email queued" : "On screen only — no recipients set";
}

export async function fetchOpenAlerts(buildingId: string, date?: string): Promise<OpenAlert[]> {
  const { data, error } = await getSupabase().rpc("attendance_alerts_open", {
    p_building: buildingId,
    p_date: date ?? null,
  });
  if (error) throw new Error(error.message);
  const res = data as { ok: boolean; alerts?: OpenAlert[] } | null;
  if (!res?.ok) throw new Error("Could not load alerts");
  return res.alerts ?? [];
}

export async function ackAlert(id: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc("attendance_alert_ack", {
    p_alert: id,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; error?: string }) ?? { ok: false, error: "No answer from the server" };
}

/** A manager-triggered scan, for "check now" rather than waiting for the job. */
export async function scanNow(buildingId: string): Promise<{ ok: boolean; raised?: number; resolved?: number; error?: string }> {
  const { data, error } = await getSupabase().rpc("attendance_alerts_scan", {
    p_building: buildingId,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean }) ?? { ok: false, error: "No answer from the server" };
}

export async function fetchAlertSettings(buildingId: string): Promise<AlertSettings> {
  const { data, error } = await getSupabase().rpc("alert_settings_get", { p_building: buildingId });
  if (error) throw new Error(error.message);
  const res = data as ({ ok: boolean } & AlertSettings) | null;
  if (!res?.ok) throw new Error("Could not load alert settings");
  return res;
}

export async function saveAlertSettings(args: {
  buildingId: string;
  enabled: boolean;
  graceMin: number;
  overdueAfterMin: number;
  raiseOverdue: boolean;
  emails: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc("alert_settings_set", {
    p_building: args.buildingId,
    p_enabled: args.enabled,
    p_grace_min: args.graceMin,
    p_overdue_after_min: args.overdueAfterMin,
    p_raise_overdue: args.raiseOverdue,
    p_emails: args.emails,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; error?: string }) ?? { ok: false, error: "No answer from the server" };
}

/** "a@b.com, c@d.com" → ["a@b.com","c@d.com"] — the server validates, this only splits. */
export function parseEmails(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((e) => e.trim())
    .filter(Boolean);
}
