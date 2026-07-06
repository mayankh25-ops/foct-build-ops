/**
 * Service Desk demo dataset (Aurora on Collins). Static Stage-1.x preview of
 * the ticketing module — replaced by sd_* tables + RLS in the Service Desk
 * backend stages (see docs/modules/SERVICE_DESK_PRD.md).
 * Cast stays consistent with demo-data.ts: concierges lodge, cleaners attend.
 */

export const sdCategories = [
  "Spillage",
  "Dirty area",
  "Rubbish overflow",
  "Toilet issue",
  "Glass/window",
  "Graffiti",
  "Odour",
  "Carpet stain",
  "Lift interior",
  "Other",
] as const;

/** Site staff registry — drives every name dropdown + notification routing. */
export const sdSiteStaff = {
  concierges: ["Amelia Ng", "Oliver Reyes"], // Concierge Collective
  cleaners: ["Marcus Chen", "Leila Haddad", "Tom Nguyen", "Sofia Marino"],
  manager: "Priya Sharma",
};

/** Aurora on Collins level list (B4–B1, GF, L1–L40) for the location picker. */
export const sdLevels = [
  "B4", "B3", "B2", "B1", "GF",
  ...Array.from({ length: 40 }, (_, i) => `L${i + 1}`),
  "Other…",
];

export type SdStatus = "new" | "open" | "in-progress" | "resolved" | "closed" | "reopened";
export type SdPriority = "low" | "normal" | "high" | "urgent";

export const sdStatusMeta: Record<
  SdStatus,
  { label: string; tone: "success" | "accent" | "warning" | "critical" | "neutral" | "info" }
> = {
  new: { label: "New", tone: "info" },
  open: { label: "Open", tone: "accent" },
  "in-progress": { label: "In progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  reopened: { label: "Reopened", tone: "critical" },
};

export const sdPriorityMeta: Record<
  SdPriority,
  { label: string; tone: "neutral" | "accent" | "warning" | "critical" }
> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "accent" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "critical" },
};

export interface SdEvent {
  at: string; // "Today 08:41"
  who: string;
  what: string;
  internal?: boolean;
  kind: "created" | "status" | "note" | "photo" | "notify" | "csat";
}

export interface SdTicket {
  ref: string;
  category: (typeof sdCategories)[number];
  locations: { level: string; area?: string }[];
  description: string;
  priority: SdPriority;
  status: SdStatus;
  lodgedBy: string; // concierge
  assignee?: string; // cleaner
  followers: string[];
  createdAt: string;
  /** SLA state for the countdown chip. */
  sla:
    | { state: "running"; remaining: string }
    | { state: "warning"; remaining: string }
    | { state: "breached"; over: string }
    | { state: "met"; toAttend: string; toResolve: string };
  photosBefore: number;
  photosAfter: number;
  csat?: "up" | "down";
  pdf?: string;
  events: SdEvent[];
}

export const sdTickets: SdTicket[] = [
  {
    ref: "SD-AUR-2607-0045",
    category: "Toilet issue",
    locations: [{ level: "L23", area: "Male amenities" }],
    description: "Second cubicle blocked and overflowing — water reaching the tile line.",
    priority: "urgent",
    status: "open",
    lodgedBy: "Amelia Ng",
    assignee: "Sofia Marino",
    followers: ["bm@auroraoncollins.com.au", "fm.team@meridianstrata.com.au"],
    createdAt: "Today 08:52",
    sla: { state: "warning", remaining: "11m to attend" },
    photosBefore: 2,
    photosAfter: 0,
    events: [
      { at: "Today 08:52", who: "Amelia Ng", what: "Ticket lodged · 2 photos · Urgent", kind: "created" },
      { at: "Today 08:52", who: "System", what: "WhatsApp + push sent to on-duty cleaner and manager", kind: "notify" },
      { at: "Today 08:56", who: "Priya Sharma", what: "Acknowledged — assigned Sofia Marino", kind: "status" },
      { at: "Today 09:20", who: "System", what: "SLA warning · 80% of 45-minute attend target", kind: "notify" },
    ],
  },
  {
    ref: "SD-AUR-2607-0043",
    category: "Graffiti",
    locations: [{ level: "B1", area: "Loading dock roller door" }],
    description: "Tag on the roller door, roughly 1 m wide. Photo attached from dock camera round.",
    priority: "high",
    status: "in-progress",
    lodgedBy: "Oliver Reyes",
    assignee: "Marcus Chen",
    followers: ["bm@auroraoncollins.com.au"],
    createdAt: "Today 08:40",
    sla: { state: "running", remaining: "2h 04m to resolve" },
    photosBefore: 1,
    photosAfter: 0,
    events: [
      { at: "Today 08:40", who: "Oliver Reyes", what: "Ticket lodged · 1 photo · High", kind: "created" },
      { at: "Today 08:41", who: "System", what: "WhatsApp + push sent to on-duty cleaner", kind: "notify" },
      { at: "Today 08:47", who: "Marcus Chen", what: "Attending — status In progress", kind: "status" },
      {
        at: "Today 08:55",
        who: "Marcus Chen",
        what: "Solvent kit is low — using the B2 store backup. Flag for consumables order.",
        internal: true,
        kind: "note",
      },
    ],
  },
  {
    ref: "SD-AUR-2607-0044",
    category: "Rubbish overflow",
    locations: [
      { level: "L8", area: "Kitchen point" },
      { level: "L9", area: "Kitchen point" },
    ],
    description: "Both kitchen bins overflowing after the tenant event last night.",
    priority: "normal",
    status: "new",
    lodgedBy: "Amelia Ng",
    followers: [],
    createdAt: "Today 09:05",
    sla: { state: "running", remaining: "1h 12m to attend" },
    photosBefore: 1,
    photosAfter: 0,
    events: [
      { at: "Today 09:05", who: "Amelia Ng", what: "Ticket lodged · 1 photo · 2 locations", kind: "created" },
      { at: "Today 09:05", who: "System", what: "Push sent to site cleaning team", kind: "notify" },
    ],
  },
  {
    ref: "SD-AUR-2607-0042",
    category: "Spillage",
    locations: [{ level: "L14", area: "Kitchen breakout" }],
    description: "Coffee spill across the breakout floor, spreading toward the carpet edge.",
    priority: "high",
    status: "resolved",
    lodgedBy: "Amelia Ng",
    assignee: "Leila Haddad",
    followers: ["bm@auroraoncollins.com.au", "tenantsvc@meridianstrata.com.au"],
    createdAt: "Today 07:48",
    sla: { state: "met", toAttend: "9m", toResolve: "17m" },
    photosBefore: 2,
    photosAfter: 2,
    csat: "up",
    pdf: "SD-AUR-2607-0042.pdf",
    events: [
      { at: "Today 07:48", who: "Amelia Ng", what: "Ticket lodged · 2 photos · High", kind: "created" },
      { at: "Today 07:48", who: "System", what: "WhatsApp + push sent to on-duty cleaner", kind: "notify" },
      { at: "Today 07:57", who: "Leila Haddad", what: "Attending — status In progress", kind: "status" },
      { at: "Today 08:05", who: "Leila Haddad", what: "After photos uploaded · spill cleaned, wet-floor sign placed", kind: "photo" },
      { at: "Today 08:05", who: "Leila Haddad", what: "Resolved — closure notification sent to Amelia + 2 followers", kind: "status" },
      { at: "Today 08:11", who: "Amelia Ng", what: "Rated the fix 👍", kind: "csat" },
    ],
  },
  {
    ref: "SD-AUR-2607-0040",
    category: "Odour",
    locations: [{ level: "B2", area: "Carpark lift lobby" }],
    description: "Persistent drain odour near the lift call panel.",
    priority: "normal",
    status: "reopened",
    lodgedBy: "Oliver Reyes",
    assignee: "Tom Nguyen",
    followers: ["bm@auroraoncollins.com.au"],
    createdAt: "Yesterday 15:20",
    sla: { state: "breached", over: "3h over resolve target" },
    photosBefore: 1,
    photosAfter: 1,
    csat: "down",
    events: [
      { at: "Yesterday 15:20", who: "Oliver Reyes", what: "Ticket lodged · 1 photo", kind: "created" },
      { at: "Yesterday 16:05", who: "Tom Nguyen", what: "Attending — status In progress", kind: "status" },
      { at: "Yesterday 16:40", who: "Tom Nguyen", what: "Resolved — enzyme treatment applied", kind: "status" },
      { at: "Today 07:30", who: "Oliver Reyes", what: "Reopened — odour back this morning. Rated 👎", kind: "status" },
      { at: "Today 07:31", who: "System", what: "Reopen alert sent to Priya Sharma (manager)", kind: "notify" },
    ],
  },
  {
    ref: "SD-AUR-2607-0041",
    category: "Lift interior",
    locations: [{ level: "GF", area: "Lift car 3" }],
    description: "Scuff marks and sticky residue on lift car 3 handrail.",
    priority: "low",
    status: "closed",
    lodgedBy: "Oliver Reyes",
    assignee: "Marcus Chen",
    followers: [],
    createdAt: "Yesterday 09:12",
    sla: { state: "met", toAttend: "22m", toResolve: "51m" },
    photosBefore: 1,
    photosAfter: 1,
    csat: "up",
    pdf: "SD-AUR-2607-0041.pdf",
    events: [
      { at: "Yesterday 09:12", who: "Oliver Reyes", what: "Ticket lodged · 1 photo", kind: "created" },
      { at: "Yesterday 09:34", who: "Marcus Chen", what: "Attending — status In progress", kind: "status" },
      { at: "Yesterday 10:03", who: "Marcus Chen", what: "Resolved — after photo uploaded", kind: "status" },
      { at: "Today 10:03", who: "System", what: "Auto-closed 24h after resolve · PDF attached to closure email", kind: "status" },
    ],
  },
];

/** Saved queue views (manager). Counts match the tickets above. */
export const sdSavedViews = [
  { label: "All open", count: 4 },
  { label: "Urgent open", count: 1 },
  { label: "Unattended > 2h", count: 0 },
  { label: "Reopened", count: 1 },
  { label: "Resolved this week", count: 2 },
];

export const sdMetrics = {
  openTickets: 4,
  avgAttend: "14m",
  avgResolve: "38m",
  slaCompliance: "94%",
};
