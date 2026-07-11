"use client";

/**
 * Building calendar — one shared calendar for the building. Periodic works
 * are GENERATED from the Scope agreement dataset (same cadence rules as the
 * Scope periodic planner: quarterly Mar/Jun/Sep/Dec, bi-annual Apr/Oct,
 * annual staggered), so the contract's periodic tail lands on real dates
 * automatically. Building events (contractor visits, lift bookings, waste
 * pickups, inspections) are seeded; Add job writes manual events that
 * persist. Supabase replaces the store at the calendar backend stage.
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
  | "other";

export interface CalEvent {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** decimal hours; undefined = all-day */
  time?: number;
  category: CalCategory;
  detail?: string;
  /** scope entity code for periodic works */
  oc?: string;
  billable?: boolean;
  source: "scope" | "seed" | "manual";
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
  other: { label: "Other", tone: "neutral" },
};

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

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

interface CalendarState {
  manualEvents: CalEvent[];
  addJob: (input: {
    title: string;
    date: string;
    time?: number;
    category: CalCategory;
    detail?: string;
  }) => void;
  removeJob: (id: string) => void;
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
      addJob: (input) =>
        set((s) => ({
          manualEvents: [
            ...s.manualEvents,
            { id: `manual-${Date.now()}-${seq++}`, source: "manual" as const, ...input },
          ],
        })),
      removeJob: (id) =>
        set((s) => ({ manualEvents: s.manualEvents.filter((e) => e.id !== id) })),
      resetDemo: () => set({ manualEvents: [] }),
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
