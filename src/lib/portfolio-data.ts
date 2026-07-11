/**
 * Portfolio (head-office) demo fleet. Aurora on Collins is THE live
 * building — its signals derive from the attendance + service-desk stores
 * at render time. The rest are seeded sister buildings so the exception-
 * first triage reads real. Fictional names only (CLAUDE.md).
 */

export interface BuildingSignals {
  /** missed check-ins right now (15-min grace expired, no cover) */
  missedNow: number;
  /** SLA attend/resolve breaches so far today */
  slaBreachesToday: number;
  openUrgentTickets: number;
  openTickets: number;
  /** last site-audit score, 0–100 */
  auditScore: number;
  auditTrend: "up" | "down" | "flat";
  /** actual vs contracted labour hours this week, % (100 = on contract) */
  hoursVsContractPct: number;
  cleanersOnSite: number;
}

export interface PortfolioBuilding {
  code: string;
  name: string;
  suburb: string;
  levels: number;
  contractHoursWk: number;
  signals: BuildingSignals;
  /** the live demo building links to its real dashboard */
  live?: boolean;
}

export type Rag = "critical" | "warning" | "ok";

export function ragFor(s: BuildingSignals): Rag {
  if (s.missedNow > 0 || s.slaBreachesToday > 0 || s.openUrgentTickets > 0) return "critical";
  if (s.auditScore < 90 || Math.abs(s.hoursVsContractPct - 100) > 5 || s.openTickets > 8)
    return "warning";
  return "ok";
}

export const ragMeta: Record<Rag, { label: string; tone: "critical" | "warning" | "success" }> = {
  critical: { label: "Needs attention", tone: "critical" },
  warning: { label: "Watch", tone: "warning" },
  ok: { label: "Healthy", tone: "success" },
};

/** Seeded sister buildings — Aurora's row is built live and prepended. */
export const portfolioSeed: PortfolioBuilding[] = [
  {
    code: "MER",
    name: "Meridian Tower",
    suburb: "Melbourne CBD",
    levels: 52,
    contractHoursWk: 510,
    signals: {
      missedNow: 1,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 6,
      auditScore: 93,
      auditTrend: "flat",
      hoursVsContractPct: 97,
      cleanersOnSite: 6,
    },
  },
  {
    code: "SPN",
    name: "125 Spencer",
    suburb: "Melbourne CBD",
    levels: 33,
    contractHoursWk: 260,
    signals: {
      missedNow: 0,
      slaBreachesToday: 2,
      openUrgentTickets: 1,
      openTickets: 11,
      auditScore: 88,
      auditTrend: "down",
      hoursVsContractPct: 91,
      cleanersOnSite: 3,
    },
  },
  {
    code: "LON",
    name: "The Lonsdale",
    suburb: "Melbourne CBD",
    levels: 41,
    contractHoursWk: 385,
    signals: {
      missedNow: 0,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 9,
      auditScore: 87,
      auditTrend: "up",
      hoursVsContractPct: 99,
      cleanersOnSite: 4,
    },
  },
  {
    code: "YQY",
    name: "Yarra Quays",
    suburb: "Docklands",
    levels: 28,
    contractHoursWk: 220,
    signals: {
      missedNow: 0,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 3,
      auditScore: 95,
      auditTrend: "up",
      hoursVsContractPct: 100,
      cleanersOnSite: 3,
    },
  },
  {
    code: "CEX",
    name: "Collins Exchange",
    suburb: "Melbourne CBD",
    levels: 37,
    contractHoursWk: 340,
    signals: {
      missedNow: 0,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 4,
      auditScore: 96,
      auditTrend: "flat",
      hoursVsContractPct: 101,
      cleanersOnSite: 4,
    },
  },
  {
    code: "SBT",
    name: "Southbank Terraces",
    suburb: "Southbank",
    levels: 24,
    contractHoursWk: 180,
    signals: {
      missedNow: 0,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 2,
      auditScore: 92,
      auditTrend: "flat",
      hoursVsContractPct: 100,
      cleanersOnSite: 2,
    },
  },
  {
    code: "DKO",
    name: "Docklands One",
    suburb: "Docklands",
    levels: 30,
    contractHoursWk: 240,
    signals: {
      missedNow: 0,
      slaBreachesToday: 0,
      openUrgentTickets: 0,
      openTickets: 7,
      auditScore: 84,
      auditTrend: "down",
      hoursVsContractPct: 106,
      cleanersOnSite: 3,
    },
  },
];
