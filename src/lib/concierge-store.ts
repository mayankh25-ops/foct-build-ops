"use client";

/**
 * Concierge desk demo store — parcels register + shift handover notes.
 * Handover notes are PRIVATE to the concierge organisation (the RLS model
 * makes that a database guarantee at the backend stage; the UI copy says
 * so today). Tickets are NOT here — the concierge raises them through the
 * shared Service Desk store, which is the whole point.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Parcel {
  id: string;
  resident: string;
  apartment: string;
  carrier: string;
  description: string;
  receivedAt: string; // ISO
  status: "awaiting" | "collected";
  collectedAt?: string;
}

export interface HandoverNote {
  id: string;
  author: string;
  at: string; // ISO
  text: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

const seedParcels = (): Parcel[] => [
  { id: "p1", resident: "J. Okafor", apartment: "2704", carrier: "AusPost", description: "Large box", receivedAt: hoursAgo(2), status: "awaiting" },
  { id: "p2", resident: "M. Petrova", apartment: "1109", carrier: "DHL", description: "Document satchel", receivedAt: hoursAgo(5), status: "awaiting" },
  { id: "p3", resident: "S. Whitford", apartment: "3302", carrier: "Amazon", description: "2 cartons", receivedAt: hoursAgo(7), status: "awaiting" },
  { id: "p4", resident: "L. Tran", apartment: "0806", carrier: "StarTrack", description: "Tube (artwork)", receivedAt: hoursAgo(26), status: "collected", collectedAt: hoursAgo(3) },
];

const seedNotes = (): HandoverNote[] => [
  { id: "n1", author: "Amelia Ng", at: hoursAgo(9), text: "Lift 3 padded until Friday — L27 move-in continues tomorrow 10:00. Dock key returned to the safe." },
  { id: "n2", author: "Ravi Sharma", at: hoursAgo(21), text: "Resident 1109 expecting an urgent courier — call on arrival, do not leave at desk. BM asked us to log any pool-deck access after 22:00." },
];

interface ConciergeState {
  parcels: Parcel[];
  notes: HandoverNote[];
  seeded: boolean;
  ensureSeed: () => void;
  logParcel: (input: Omit<Parcel, "id" | "receivedAt" | "status">) => void;
  markCollected: (id: string) => void;
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

export const useConciergeStore = create<ConciergeState>()(
  persist(
    (set, get) => ({
      parcels: [],
      notes: [],
      seeded: false,
      ensureSeed: () => {
        if (get().seeded) return;
        set({ parcels: seedParcels(), notes: seedNotes(), seeded: true });
      },
      logParcel: (input) =>
        set((s) => ({
          parcels: [
            {
              id: `p-${Date.now()}-${seq++}`,
              receivedAt: new Date().toISOString(),
              status: "awaiting" as const,
              ...input,
            },
            ...s.parcels,
          ],
        })),
      markCollected: (id) =>
        set((s) => ({
          parcels: s.parcels.map((p) =>
            p.id === id ? { ...p, status: "collected" as const, collectedAt: new Date().toISOString() } : p
          ),
        })),
      addNote: (author, text) =>
        set((s) => ({
          notes: [{ id: `n-${Date.now()}-${seq++}`, author, at: new Date().toISOString(), text }, ...s.notes],
        })),
      resetDemo: () => set({ parcels: seedParcels(), notes: seedNotes(), seeded: true }),
    }),
    {
      name: "foct-concierge-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    }
  )
);

export function useConciergeReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useConciergeStore.persist.rehydrate();
      useConciergeStore.getState().ensureSeed();
    }
    setReady(true);
  }, []);
  return ready;
}
