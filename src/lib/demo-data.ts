/**
 * Aurora on Collins demo dataset (see CLAUDE.md → Demo dataset).
 * Stage 1.5 screens are static and render exclusively from this file so the
 * cast stays consistent everywhere. Replaced by Supabase seed data in Stage 2.
 */

export const building = {
  name: "Aurora on Collins",
  org: "FOCT Cleaning",
  manager: { name: "Priya Sharma", role: "Cleaning manager" },
};

export type ShiftStatus = "completed" | "on-site" | "late" | "missed" | "rostered";

export interface Shift {
  cleaner: string;
  zone: string;
  scheduled: [number, number]; // decimal hours
  actual?: [number, number | null]; // null end = still on site
  status: ShiftStatus;
}

export const todaysShifts: Shift[] = [
  { cleaner: "Marcus Chen", zone: "Lobby + L1–L8", scheduled: [6, 10], actual: [5.97, 10.07], status: "completed" },
  { cleaner: "Leila Haddad", zone: "L9–L24", scheduled: [6, 10.5], actual: [6.03, null], status: "on-site" },
  { cleaner: "Tom Nguyen", zone: "L25–L40 + BOH", scheduled: [6, 10], status: "missed" },
  { cleaner: "Sofia Marino", zone: "End-of-trip + gym", scheduled: [6.5, 9.5], actual: [6.92, null], status: "late" },
  { cleaner: "Daniel Aboud", zone: "Lifts + glass line", scheduled: [7, 11], actual: [6.98, null], status: "on-site" },
  { cleaner: "Grace Liu", zone: "L20 store + restock", scheduled: [10, 13], status: "rostered" },
];

export function fmtTime(h?: number | null): string {
  if (h === undefined || h === null) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const shiftStatusMeta: Record<
  ShiftStatus,
  { label: string; tone: "success" | "accent" | "warning" | "critical" | "neutral" }
> = {
  completed: { label: "Completed", tone: "success" },
  "on-site": { label: "On site now", tone: "accent" },
  late: { label: "Started late", tone: "warning" },
  missed: { label: "Missed check-in", tone: "critical" },
  rostered: { label: "Rostered", tone: "neutral" },
};

export interface TimesheetRow {
  cleaner: string;
  building: string;
  rostered: number;
  actual: number;
  status: "ready" | "approved" | "needs-review";
  note?: string;
}

export const timesheets: TimesheetRow[] = [
  { cleaner: "Marcus Chen", building: "Aurora on Collins", rostered: 20, actual: 20.25, status: "ready" },
  { cleaner: "Leila Haddad", building: "Aurora on Collins", rostered: 22.5, actual: 22.5, status: "ready" },
  { cleaner: "Sofia Marino", building: "Aurora on Collins", rostered: 15, actual: 13.6, status: "needs-review", note: "Two late starts — tram disruption on Collins St. Confirm with Sofia before approving." },
  { cleaner: "Daniel Aboud", building: "Aurora on Collins", rostered: 20, actual: 20, status: "approved" },
  { cleaner: "Tom Nguyen", building: "Aurora on Collins", rostered: 20, actual: 16, status: "needs-review", note: "Missed Wednesday shift — reassigned to Marcus after 15-minute alert." },
  { cleaner: "Grace Liu", building: "Aurora on Collins", rostered: 12, actual: 12, status: "ready" },
];

export type ConsumableCategory =
  | "Chemicals"
  | "Paper products"
  | "Bin liners"
  | "Gloves & PPE"
  | "Cleaning tools"
  | "Machine accessories";

export interface StockItem {
  name: string;
  category: ConsumableCategory;
  level: number; // 0–1
  onHand: string;
  reorderAt: string;
}

export const stock: StockItem[] = [
  { name: "Neutral floor cleaner 5 L", category: "Chemicals", level: 0.18, onHand: "4", reorderAt: "6" },
  { name: "Glass polish 750 mL", category: "Chemicals", level: 0.55, onHand: "11", reorderAt: "8" },
  { name: "Paper towel (carton)", category: "Paper products", level: 0.12, onHand: "3", reorderAt: "10" },
  { name: "Toilet tissue (carton)", category: "Paper products", level: 0.62, onHand: "18", reorderAt: "12" },
  { name: "Bin liners 240 L (roll)", category: "Bin liners", level: 0.25, onHand: "5", reorderAt: "8" },
  { name: "Nitrile gloves L (box)", category: "Gloves & PPE", level: 0.8, onHand: "24", reorderAt: "10" },
  { name: "Microfibre cloth pack", category: "Cleaning tools", level: 0.45, onHand: "9", reorderAt: "6" },
  { name: "Scrubber pads (set)", category: "Machine accessories", level: 0.7, onHand: "14", reorderAt: "6" },
];

export interface ConsumableOrder {
  id: string;
  requestedBy: string;
  requestedOn: string;
  items: { name: string; qty: number }[];
  status: "awaiting-approval" | "approved" | "ordered";
}

export const orders: ConsumableOrder[] = [
  {
    id: "CO-1042",
    requestedBy: "Marcus Chen",
    requestedOn: "Today, 06:41",
    items: [
      { name: "Neutral floor cleaner 5 L", qty: 12 },
      { name: "Microfibre cloth pack", qty: 8 },
      { name: "Glass polish 750 mL", qty: 2 },
    ],
    status: "awaiting-approval",
  },
  {
    id: "CO-1041",
    requestedBy: "Leila Haddad",
    requestedOn: "Yesterday, 14:12",
    items: [
      { name: "Paper towel (carton)", qty: 10 },
      { name: "Bin liners 240 L (roll)", qty: 6 },
    ],
    status: "awaiting-approval",
  },
  {
    id: "CO-1039",
    requestedBy: "Priya Sharma",
    requestedOn: "Mon, 09:05",
    items: [{ name: "Nitrile gloves L (box)", qty: 12 }],
    status: "ordered",
  },
];

export interface CleaningTask {
  title: string;
  zone: string;
  by: string;
  when: string;
  photos: number;
  status: "done" | "flagged";
}

export const recentTasks: CleaningTask[] = [
  { title: "Lobby marble buffed", zone: "Ground", by: "Marcus Chen", when: "07:20", photos: 2, status: "done" },
  { title: "Spill cleaned — L14 kitchen", zone: "L14", by: "Leila Haddad", when: "08:05", photos: 3, status: "done" },
  { title: "Graffiti reported — loading dock", zone: "BOH", by: "Daniel Aboud", when: "08:40", photos: 1, status: "flagged" },
];

export interface WeekHours {
  day: string;
  rostered: number;
  actual: number;
  today?: boolean;
}

export const weekHours: WeekHours[] = [
  { day: "Mon", rostered: 22, actual: 21.5 },
  { day: "Tue", rostered: 22, actual: 22.25 },
  { day: "Wed", rostered: 23.5, actual: 14.1, today: true },
  { day: "Thu", rostered: 22, actual: 0 },
  { day: "Fri", rostered: 22, actual: 0 },
  { day: "Sat", rostered: 9, actual: 0 },
  { day: "Sun", rostered: 0, actual: 0 },
];
