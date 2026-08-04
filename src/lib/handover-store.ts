"use client";

/**
 * Shift handover notes (DEMO fallback) — the cleaning org's shift-to-shift log
 * on the dashboard. Called "Shift handover" everywhere now (owner, 2026-08-04);
 * "team handover" was the same thing under a second name.
 *
 * Signed in, the dashboard uses the LIVE timeline instead (0016), where the
 * cleaning company's log and the concierge company's log are separate by
 * org_id — same table, same building, neither sees the other.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface TeamNote {
  id: string;
  author: string;
  at: string; // ISO
  text: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const seedNotes = (): TeamNote[] => [
  {
    id: "t1",
    author: "Priya Sharma",
    at: hoursAgo(3),
    text: "Loading dock closed until 06:30 tomorrow — use the Little Collins St entry. Buff the lobby marble before 07:00.",
  },
  {
    id: "t2",
    author: "Marcus Chen",
    at: hoursAgo(14),
    text: "L20 store restocked; two boxes of liners left on the trolley for the AM crew. Scrubber battery on charge in BOH.",
  },
];

interface HandoverState {
  notes: TeamNote[];
  seeded: boolean;
  ensureSeed: () => void;
  addNote: (author: string, text: string) => void;
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

export const useHandoverStore = create<HandoverState>()(
  persist(
    (set, get) => ({
      notes: [],
      seeded: false,
      ensureSeed: () => {
        if (get().seeded) return;
        set({ notes: seedNotes(), seeded: true });
      },
      addNote: (author, text) =>
        set((s) => ({
          notes: [{ id: `t-${Date.now()}-${seq++}`, author, at: new Date().toISOString(), text }, ...s.notes],
        })),
      resetDemo: () => set({ notes: seedNotes(), seeded: true }),
    }),
    {
      name: "foct-handover-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    }
  )
);

export function useHandoverReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useHandoverStore.persist.rehydrate();
      useHandoverStore.getState().ensureSeed();
    }
    setReady(true);
  }, []);
  return ready;
}
