"use client";

/**
 * Consumables — per-building ALLOWED catalogue + live ordering (owner
 * direction 2026-07-15: "we will add allowed consumable list per building;
 * user can simply add order, they will see image of item and choose
 * quantity, one option is for Other that will add any custom item").
 * Item "images" are icon tiles from the design system — no stock photos.
 * Supabase replaces this store at the consumables backend stage; the
 * allowed list becomes a building-scoped table under the same RLS model.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ConsumableCategory } from "@/lib/demo-data";

export interface CatalogueItem {
  id: string;
  name: string;
  category: ConsumableCategory;
  /** how it's ordered, e.g. "5 L drum" / "carton of 6" */
  unit: string;
  /** on the building's allowed list (admin-managed) */
  allowed: boolean;
  /** admin-uploaded product thumbnail (compressed data URL) */
  imageDataUrl?: string;
}

export interface OrderLine {
  name: string;
  qty: number;
  unit?: string;
  /** true when added via the "Other" free-text option */
  custom?: boolean;
}

export interface ConsumableOrderRow {
  id: string;
  requestedBy: string;
  /** ISO timestamp */
  at: string;
  items: OrderLine[];
  status: "awaiting-approval" | "approved" | "declined" | "ordered";
  note?: string;
}

/** The building's allowed list — seeded to match the level-20 store stock. */
const SEED_CATALOGUE: CatalogueItem[] = [
  { id: "floor-cleaner", name: "Neutral floor cleaner 5 L", category: "Chemicals", unit: "5 L drum", allowed: true },
  { id: "glass-polish", name: "Glass polish 750 mL", category: "Chemicals", unit: "750 mL bottle", allowed: true },
  { id: "disinfectant", name: "Hospital-grade disinfectant 5 L", category: "Chemicals", unit: "5 L drum", allowed: true },
  { id: "paper-towel", name: "Paper towel", category: "Paper products", unit: "carton of 16", allowed: true },
  { id: "toilet-tissue", name: "Toilet tissue", category: "Paper products", unit: "carton of 48", allowed: true },
  { id: "liners-240", name: "Bin liners 240 L", category: "Bin liners", unit: "roll of 100", allowed: true },
  { id: "liners-120", name: "Bin liners 120 L", category: "Bin liners", unit: "roll of 200", allowed: true },
  { id: "gloves-l", name: "Nitrile gloves L", category: "Gloves & PPE", unit: "box of 100", allowed: true },
  { id: "gloves-m", name: "Nitrile gloves M", category: "Gloves & PPE", unit: "box of 100", allowed: true },
  { id: "microfibre", name: "Microfibre cloth pack", category: "Cleaning tools", unit: "pack of 20", allowed: true },
  { id: "mop-heads", name: "Flat mop heads", category: "Cleaning tools", unit: "pack of 5", allowed: true },
  { id: "scrubber-pads", name: "Scrubber pads", category: "Machine accessories", unit: "set of 5", allowed: true },
];

const SEED_ORDERS: ConsumableOrderRow[] = [
  {
    id: "CO-1042",
    requestedBy: "Marcus Chen",
    at: new Date(Date.now() - 3 * 3600000).toISOString(),
    items: [
      { name: "Neutral floor cleaner 5 L", qty: 12, unit: "5 L drum" },
      { name: "Microfibre cloth pack", qty: 8, unit: "pack of 20" },
      { name: "Glass polish 750 mL", qty: 2, unit: "750 mL bottle" },
    ],
    status: "awaiting-approval",
  },
  {
    id: "CO-1041",
    requestedBy: "Leila Haddad",
    at: new Date(Date.now() - 22 * 3600000).toISOString(),
    items: [
      { name: "Paper towel", qty: 10, unit: "carton of 16" },
      { name: "Bin liners 240 L", qty: 6, unit: "roll of 100" },
    ],
    status: "awaiting-approval",
  },
  {
    id: "CO-1039",
    requestedBy: "Priya Sharma",
    at: new Date(Date.now() - 3 * 86400000).toISOString(),
    items: [{ name: "Nitrile gloves L", qty: 12, unit: "box of 100" }],
    status: "ordered",
  },
];

interface ConsumablesState {
  catalogue: CatalogueItem[];
  orders: ConsumableOrderRow[];
  seeded: boolean;
  ensureSeed: () => void;
  createOrder: (input: { requestedBy: string; items: OrderLine[]; note?: string }) => string;
  setOrderStatus: (id: string, status: ConsumableOrderRow["status"]) => void;
  toggleAllowed: (id: string) => void;
  setItemImage: (id: string, imageDataUrl: string | undefined) => void;
  addCatalogueItem: (input: { name: string; category: ConsumableCategory; unit: string }) => void;
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

export const useConsumablesStore = create<ConsumablesState>()(
  persist(
    (set, get) => ({
      catalogue: [],
      orders: [],
      seeded: false,

      ensureSeed: () => {
        if (get().seeded && get().catalogue.length) return;
        set({ catalogue: SEED_CATALOGUE, orders: SEED_ORDERS, seeded: true });
      },

      createOrder: (input) => {
        const nums = get()
          .orders.map((o) => Number.parseInt(o.id.replace("CO-", ""), 10))
          .filter(Number.isFinite);
        const id = `CO-${String(Math.max(1000, ...nums) + 1 + seq++).padStart(4, "0")}`;
        set((s) => ({
          orders: [
            {
              id,
              requestedBy: input.requestedBy,
              at: new Date().toISOString(),
              items: input.items,
              status: "awaiting-approval" as const,
              note: input.note,
            },
            ...s.orders,
          ],
        }));
        return id;
      },

      setOrderStatus: (id, status) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),

      toggleAllowed: (id) =>
        set((s) => ({
          catalogue: s.catalogue.map((c) => (c.id === id ? { ...c, allowed: !c.allowed } : c)),
        })),

      setItemImage: (id, imageDataUrl) =>
        set((s) => ({
          catalogue: s.catalogue.map((c) => (c.id === id ? { ...c, imageDataUrl } : c)),
        })),

      addCatalogueItem: (input) =>
        set((s) => ({
          catalogue: [
            ...s.catalogue,
            {
              id: `item-${Date.now()}-${seq++}`,
              name: input.name.trim(),
              category: input.category,
              unit: input.unit.trim() || "each",
              allowed: true,
            },
          ],
        })),

      resetDemo: () => set({ catalogue: SEED_CATALOGUE, orders: SEED_ORDERS, seeded: true }),
    }),
    {
      name: "foct-consumables-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    }
  )
);

export function useConsumablesReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useConsumablesStore.persist.rehydrate();
      useConsumablesStore.getState().ensureSeed();
    }
    setReady(true);
  }, []);
  return ready;
}
