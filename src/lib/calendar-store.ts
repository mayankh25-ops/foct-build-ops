"use client";

/**
 * Building calendar — one shared calendar for the building. Periodic works
 * are GENERATED from the Scope agreement dataset (same cadence rules as the
 * Scope periodic planner), building events are seeded, and manual entries
 * persist. Since 2026-07-15 the calendar also carries RECURRING series
 * (daily/weekly/fortnightly/monthly) with role-scoped visibility and
 * admin-locked events (see docs/DECISIONS.md). Supabase replaces the store
 * at the calendar backend stage; visibility/lock rules map 1:1 onto RLS then.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SCOPE_SEED } from "@/lib/scope-data";

export type CalCategory =
  | "periodic"
  | "contractor"
  | "booking"
  | "waste"
  | "inspection"
  | "maintenance"
  | "other";

/** The parties who read/write the shared calendar (org-type level, not user). */
export type CalRole = "admin" | "bm" | "cleaning" | "concierge";

export const CAL_ROLES: Array<{ value: CalRole; label: string }> = [
  { value: "admin", label: "Building admin" },
  { value: "bm", label: "Building manager" },
  { value: "cleaning", label: "Cleaning team" },
  { value: "concierge", label: "Concierge" },
];

export const calRoleLabel = (r: CalRole) => CAL_ROLES.find((x) => x.value === r)?.label ?? r;

export type CalRepeat =
  | "none"
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "yearly";

export const REPEAT_LABELS: Record<CalRepeat, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

/** "everyone" or an explicit list of roles that may SEE the event. */
export type CalVisibility = "everyone" | CalRole[];

/** Channels a resident notice can go out on — matches the live integration
 *  categories (Email + SMS providers); push joins when the resident app ships. */
export type NoticeChannel = "email" | "sms";

export const NOTICE_CHANNEL_LABELS: Record<NoticeChannel, string> = {
  email: "Email",
  sms: "SMS",
};

export const noticeChannelSummary = (channels: NoticeChannel[]) =>
  channels.map((c) => NOTICE_CHANNEL_LABELS[c]).join(" + ");

/** Opt-in resident notification for events that affect residents (e.g. pool
 *  closed for maintenance). Queued with the event; delivery runs through the
 *  org's configured email/SMS providers via notify() at the backend stage. */
export interface ResidentNotice {
  channels: NoticeChannel[];
  /** optional custom wording — the notice falls back to the event details */
  message?: string;
}

export interface CalEvent {
  id: string;
  title: string;
  /** yyyy-mm-dd — start date */
  date: string;
  /** yyyy-mm-dd — finish date for MULTI-DAY events (shows on every day) */
  endDate?: string;
  /** decimal hours; undefined = all-day */
  time?: number;
  /** decimal hours — finish time for timed events */
  endTime?: number;
  category: CalCategory;
  detail?: string;
  /** scope entity code for periodic works */
  oc?: string;
  billable?: boolean;
  source: "scope" | "seed" | "manual";
  /** email reminder queued for this event (sends via the email adapter) */
  reminder?: { email: string; daysBefore: number };
  /** resident notification queued for this event (sends via notify()) */
  residentNotice?: ResidentNotice;
  /** who may see it — undefined/"everyone" = the whole building */
  visibility?: CalVisibility;
  /** admin-locked: nobody but the building admin can change or remove it */
  locked?: boolean;
  createdBy?: CalRole;
  contactName?: string;
  contactPhone?: string;
  /** set on occurrences expanded from a recurring series */
  seriesId?: string;
  repeat?: CalRepeat;
  /** set on day-occurrences expanded from a multi-day event (= original id) */
  spanId?: string;
}

/** A recurring definition — expanded into CalEvents per displayed range. */
export interface CalSeries {
  id: string;
  title: string;
  category: CalCategory;
  detail?: string;
  /** first occurrence, yyyy-mm-dd */
  startDate: string;
  /** optional last date, yyyy-mm-dd */
  until?: string;
  time?: number;
  endTime?: number;
  repeat: Exclude<CalRepeat, "none">;
  /** weekly/fortnightly: 0=Mon … 6=Sun (defaults to the start date's weekday) */
  weekdays?: number[];
  visibility: CalVisibility;
  locked?: boolean;
  createdBy: CalRole;
  contactName?: string;
  contactPhone?: string;
  reminder?: { email: string; daysBefore: number };
  residentNotice?: ResidentNotice;
}

export const calCategoryMeta: Record<
  CalCategory,
  { label: string; tone: "accent" | "success" | "warning" | "critical" | "info" | "neutral" }
> = {
  periodic: { label: "Periodic works", tone: "critical" },
  contractor: { label: "Contractor visit", tone: "warning" },
  booking: { label: "Booking / move", tone: "info" },
  waste: { label: "Waste", tone: "success" },
  inspection: { label: "Inspection", tone: "accent" },
  maintenance: { label: "Maintenance", tone: "warning" },
  other: { label: "Other", tone: "neutral" },
};

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const dateKey = (d: Date) => monthKey(d.getFullYear(), d.getMonth(), d.getDate());
/** Monday-start weekday: 0=Mon … 6=Sun */
const mondayWeekday = (d: Date) => (d.getDay() + 6) % 7;

/**
 * Periodic works for a given month, straight from the agreement.
 * Days are deterministic (spread across the working month by item index)
 * so the schedule is stable across reloads.
 */
export function scopeEventsForMonth(year: number, month: number): CalEvent[] {
  const events: CalEvent[] = [];
  const CADENCE: Record<string, (m: number, idx: number) => boolean> = {
    Monthly: () => true,
    Quarterly: (m) => [2, 5, 8, 11].includes(m),
    "Bi-Annually": (m) => [3, 9].includes(m),
    Annually: (m, idx) => m === (idx * 5 + 2) % 12,
  };
  for (const freq of Object.keys(CADENCE)) {
    let idx = 0;
    for (const oc of SCOPE_SEED.ocs.filter((o) => o.included)) {
      for (const zone of oc.zones) {
        for (const task of zone.tasks) {
          if (task.f !== freq) continue;
          if (CADENCE[freq]!(month, idx)) {
            const day = 2 + ((idx * 7) % 24); // spread across the month, stable
            events.push({
              id: `scope-${freq}-${idx}-${year}-${month}`,
              title: task.t.length > 64 ? `${task.t.slice(0, 61)}…` : task.t,
              date: monthKey(year, month, day),
              category: "periodic",
              detail: `${oc.id} · ${zone.name} · ${freq} per the agreement`,
              oc: oc.id,
              billable: /additional cost/i.test(task.t),
              source: "scope",
            });
          }
          idx++;
        }
      }
    }
  }
  return events;
}

/** Seeded building events for a month — contractor visits, bookings, waste. */
export function seededEventsForMonth(year: number, month: number): CalEvent[] {
  const mk = (d: number) => monthKey(year, month, d);
  return [
    { id: `s-lift-${month}`, title: "Lift 2 — quarterly service (Otis)", date: mk(4), time: 9, category: "contractor", detail: "Induction current · loading dock access", source: "seed" },
    { id: `s-move-${month}`, title: "Resident move-in — L27 (lift booking)", date: mk(6), time: 10, category: "booking", detail: "Lift 3 padded 10:00–13:00 · concierge to supervise", source: "seed" },
    { id: `s-waste1-${month}`, title: "Hard waste collection", date: mk(9), time: 7, category: "waste", detail: "Council pickup — bins presented night before", source: "seed" },
    { id: `s-fire-${month}`, title: "ESM — monthly fire panel test", date: mk(11), time: 8, category: "inspection", detail: "Grade A contractor · report to building manager", source: "seed" },
    { id: `s-window-${month}`, title: "Anchor point inspection — roof", date: mk(16), time: 13, category: "contractor", detail: "Height-safety contractor · certificates to compliance vault", source: "seed" },
    { id: `s-waste2-${month}`, title: "Cardboard/recycling collection", date: mk(18), time: 7, category: "waste", detail: "Private contractor — dock 2", source: "seed" },
    { id: `s-audit-${month}`, title: "Site audit — cleaning QA walk", date: mk(23), time: 14, category: "inspection", detail: "FOCT cleaning manager + BM · scored checklist", source: "seed" },
    { id: `s-move2-${month}`, title: "Office fit-out delivery — L12 (dock booking)", date: mk(26), time: 11, category: "booking", detail: "Dock 1 reserved 11:00–15:00", source: "seed" },
  ];
}

/* ---------------------------------------------------------------------------
 * Recurring series expansion
 * ------------------------------------------------------------------------- */

function occursOn(s: CalSeries, d: Date): boolean {
  const key = dateKey(d);
  if (key < s.startDate) return false;
  if (s.until && key > s.until) return false;
  const start = new Date(`${s.startDate}T00:00:00`);
  switch (s.repeat) {
    case "daily":
      return true;
    case "weekly":
    case "fortnightly": {
      const days = s.weekdays?.length ? s.weekdays : [mondayWeekday(start)];
      if (!days.includes(mondayWeekday(d))) return false;
      if (s.repeat === "weekly") return true;
      // fortnightly: even number of whole weeks since the start's week
      const startMonday = new Date(start);
      startMonday.setDate(start.getDate() - mondayWeekday(start));
      const dayMs = 86_400_000;
      const weeks = Math.floor((d.getTime() - startMonday.getTime()) / (7 * dayMs));
      return weeks % 2 === 0;
    }
    case "monthly":
      return d.getDate() === start.getDate();
    case "quarterly": {
      if (d.getDate() !== start.getDate()) return false;
      const months =
        (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth());
      return months % 3 === 0;
    }
    case "yearly":
      return d.getDate() === start.getDate() && d.getMonth() === start.getMonth();
  }
}

function occurrence(s: CalSeries, key: string): CalEvent {
  return {
    id: `series-${s.id}-${key}`,
    title: s.title,
    date: key,
    time: s.time,
    endTime: s.endTime,
    category: s.category,
    detail: s.detail,
    source: "manual",
    reminder: s.reminder,
    residentNotice: s.residentNotice,
    visibility: s.visibility,
    locked: s.locked,
    createdBy: s.createdBy,
    contactName: s.contactName,
    contactPhone: s.contactPhone,
    seriesId: s.id,
    repeat: s.repeat,
  };
}

/** Every occurrence of every series inside one month. */
export function seriesEventsForMonth(series: CalSeries[], year: number, month: number): CalEvent[] {
  const out: CalEvent[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (const s of series) {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (occursOn(s, d)) out.push(occurrence(s, dateKey(d)));
    }
  }
  return out;
}

/** Manual events for one month — multi-day events (finish date set) expand
 *  into one occurrence per day so they show across the whole span. */
export function manualEventsForMonth(manual: CalEvent[], year: number, month: number): CalEvent[] {
  const prefix = `${year}-${pad(month + 1)}`;
  const out: CalEvent[] = [];
  for (const e of manual) {
    if (!e.endDate || e.endDate <= e.date) {
      if (e.date.startsWith(prefix)) out.push(e);
      continue;
    }
    const start = new Date(`${e.date}T00:00:00`);
    const end = new Date(`${e.endDate}T00:00:00`);
    // safety cap: a span never expands past 92 days, whatever the input says
    for (let i = 0, d = new Date(start); d <= end && i < 92; i++, d.setDate(d.getDate() + 1)) {
      const key = dateKey(d);
      if (key.startsWith(prefix)) out.push({ ...e, id: `${e.id}-${key}`, date: key, spanId: e.id });
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Visibility + permission rules (mirror of the future RLS policies)
 * ------------------------------------------------------------------------- */

/** Can this role SEE the event? Admin sees everything. */
export function visibleTo(e: CalEvent, role: CalRole): boolean {
  if (!e.visibility || e.visibility === "everyone") return true;
  if (role === "admin") return true;
  return e.visibility.includes(role);
}

/** Can this role CHANGE/REMOVE the event? Locked events are admin-only. */
export function canModify(e: Pick<CalEvent, "source" | "locked">, role: CalRole): boolean {
  if (e.source !== "manual") return false;
  if (e.locked) return role === "admin";
  return true;
}

/* ---------------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------------- */

export interface AddEventInput {
  title: string;
  date: string;
  /** finish date — makes it a multi-day event */
  endDate?: string;
  time?: number;
  endTime?: number;
  category: CalCategory;
  detail?: string;
  reminder?: { email: string; daysBefore: number };
  residentNotice?: ResidentNotice;
  visibility?: CalVisibility;
  locked?: boolean;
  createdBy?: CalRole;
  contactName?: string;
  contactPhone?: string;
}

export interface AddSeriesInput extends Omit<AddEventInput, "date"> {
  startDate: string;
  until?: string;
  repeat: Exclude<CalRepeat, "none">;
  weekdays?: number[];
  visibility: CalVisibility;
  createdBy: CalRole;
}

interface CalendarState {
  manualEvents: CalEvent[];
  series: CalSeries[];
  /** demo stand-in for the signed-in party; becomes real auth at backend stage */
  viewRole: CalRole;
  setViewRole: (r: CalRole) => void;
  addJob: (input: AddEventInput) => void;
  addSeries: (input: AddSeriesInput) => void;
  removeJob: (id: string) => void;
  removeSeries: (id: string) => void;
  resetDemo: () => void;
}

const safeStorage = {
  getItem: (k: string) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* best-effort */
    }
  },
  removeItem: (k: string) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

let seq = 0;

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      manualEvents: [],
      series: [],
      viewRole: "admin",
      setViewRole: (viewRole) => set({ viewRole }),
      addJob: (input) =>
        set((s) => ({
          manualEvents: [
            ...s.manualEvents,
            { id: `manual-${Date.now()}-${seq++}`, source: "manual" as const, ...input },
          ],
        })),
      addSeries: (input) =>
        set((s) => ({
          series: [...s.series, { id: `sr-${Date.now()}-${seq++}`, ...input }],
        })),
      removeJob: (id) =>
        set((s) => ({ manualEvents: s.manualEvents.filter((e) => e.id !== id) })),
      removeSeries: (id) => set((s) => ({ series: s.series.filter((x) => x.id !== id) })),
      resetDemo: () => set({ manualEvents: [], series: [] }),
    }),
    {
      name: "foct-calendar-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    }
  )
);

export function useCalendarReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useCalendarStore.persist.rehydrate();
    }
    setReady(true);
  }, []);
  return ready;
}

/** Every event (scope periodic + seeded + manual + recurring) between two dates inclusive. */
export function eventsForRange(
  start: Date,
  end: Date,
  manual: CalEvent[],
  series: CalSeries[] = []
): CalEvent[] {
  const out: CalEvent[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const startKey = monthKey(start.getFullYear(), start.getMonth(), start.getDate());
  const endKey = monthKey(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= end) {
    out.push(
      ...scopeEventsForMonth(cursor.getFullYear(), cursor.getMonth()),
      ...seededEventsForMonth(cursor.getFullYear(), cursor.getMonth()),
      ...seriesEventsForMonth(series, cursor.getFullYear(), cursor.getMonth()),
      ...manualEventsForMonth(manual, cursor.getFullYear(), cursor.getMonth())
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out
    .filter((e) => e.date >= startKey && e.date <= endKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? 24) - (b.time ?? 24));
}
