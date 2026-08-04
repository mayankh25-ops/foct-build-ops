"use client";

/**
 * Shift handover, live (0016) — the log you can go back through.
 *
 * Every entry keeps its author and its exact time, and the feed pages backwards
 * so a year of handovers is still readable. Notes cannot be edited: a shift log
 * that can be quietly rewritten is worthless in a dispute, so a correction is a
 * new note sitting next to what it corrects.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const HANDOVER_LIVE = isSupabaseConfigured;

export interface HandoverNote {
  id: string;
  body: string;
  kind: "info" | "important";
  created_at: string;
  /** the day it belongs to in the BUILDING's timezone, decided server-side */
  work_date: string;
  author_id: string;
  author: string;
  deleted: boolean;
  deleted_at: string | null;
  mine: boolean;
  can_delete: boolean;
}

export interface HandoverPage {
  timezone: string;
  notes: HandoverNote[];
  has_more: boolean;
}

export async function fetchHandover(
  buildingId: string,
  before?: string | null,
  limit = 30
): Promise<HandoverPage> {
  const { data, error } = await getSupabase().rpc("handover_feed", {
    p_building: buildingId,
    p_before: before ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const res = data as ({ ok: boolean } & HandoverPage) | null;
  if (!res?.ok) throw new Error("Could not load the handover");
  return { timezone: res.timezone, notes: res.notes ?? [], has_more: res.has_more };
}

export async function addHandover(
  buildingId: string,
  body: string,
  kind: "info" | "important" = "info"
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc("handover_add", {
    p_building: buildingId,
    p_body: body,
    p_kind: kind,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; error?: string }) ?? { ok: false, error: "No answer from the server" };
}

export async function withdrawHandover(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc("handover_delete", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean; error?: string }) ?? { ok: false, error: "No answer from the server" };
}

/* --------------------------------------------------------------- display -- */

/**
 * "14:35" — the exact time, because "3h ago" is useless a week later.
 *
 * In the BUILDING's timezone, not the reader's: a manager reading this from
 * another state must see the time the note was written on site, or every
 * handover they quote back is wrong by the offset.
 */
export function noteTime(iso: string, timezone?: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

/** "3h ago" — useful TODAY, alongside the exact time, never instead of it. */
export function relative(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** yyyy-mm-dd for a moment, in a given timezone (the site's, not the reader's). */
function dateIn(when: Date, timezone?: string): string {
  if (!timezone) {
    return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(
      when.getDate()
    ).padStart(2, "0")}`;
  }
  // en-CA gives yyyy-mm-dd, which is the shape the server sends back
  return when.toLocaleDateString("en-CA", { timeZone: timezone });
}

/**
 * "Today · Mon 4 Aug" — the heading above a day's notes. "Today" is the
 * BUILDING's today: at 08:00 in Melbourne it is still yesterday in London, and
 * the site's log should not say so.
 */
export function dayHeading(workDate: string, today = new Date(), timezone?: string): string {
  const label = new Date(`${workDate}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = dateIn(today, timezone);
  if (workDate === t) return `Today · ${label}`;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  const yesterday = dateIn(y, timezone);
  if (workDate === yesterday) return `Yesterday · ${label}`;
  return label;
}

/** Notes arrive newest-first; group them into days in that same order. */
export function groupByDay(notes: HandoverNote[]): { date: string; notes: HandoverNote[] }[] {
  const out: { date: string; notes: HandoverNote[] }[] = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && last.date === n.work_date) last.notes.push(n);
    else out.push({ date: n.work_date, notes: [n] });
  }
  return out;
}
