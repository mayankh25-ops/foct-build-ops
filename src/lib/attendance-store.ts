"use client";

/**
 * Attendance demo store — flow #1's working brain until the backend stage.
 * The kiosk writes REAL check-in/out events here; rosters, timesheets and
 * missed-check-in alerts all DERIVE from those events (nothing hand-typed):
 *   roster shift status  = rostered shift × today's events × the clock
 *   timesheet rows       = paired in/out events vs rostered hours (variance)
 *   missed alerts        = rostered start + 15 min grace with no check-in
 * Zustand per CLAUDE.md (client state only); Supabase replaces this store at
 * the attendance backend stage without touching the screens.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface StaffMember {
  id: string;
  name: string;
  pin: string;
  role: string;
}

export interface RosterShift {
  id: string;
  staffId: string;
  /** yyyy-mm-dd (building-local) */
  date: string;
  /** decimal hours, e.g. 6.5 = 06:30 */
  start: number;
  end: number;
  zone: string;
  /** set when this occurrence was materialised from an ongoing/temporary pattern */
  patternId?: string;
}

export type ShiftPatternKind = "ongoing" | "temporary";

/** A standing roster arrangement — permanent or for a fixed period. Expanded
 *  into concrete RosterShift occurrences for the current week (all consumers
 *  keep reading plain shifts). */
export interface ShiftPattern {
  id: string;
  staffId: string;
  zone: string;
  start: number;
  end: number;
  kind: ShiftPatternKind;
  /** yyyy-mm-dd — first day the arrangement applies */
  startDate: string;
  /** yyyy-mm-dd — last day (temporary only) */
  endDate?: string;
  /** 0=Mon … 6=Sun */
  weekdays: number[];
}

/** Monday-start weekday: 0=Mon … 6=Sun */
const mondayWeekday = (d: Date) => (d.getDay() + 6) % 7;

/** Concrete occurrences of a pattern inside the week containing `now`. */
export function patternOccurrencesForWeek(pattern: ShiftPattern, now: Date): RosterShift[] {
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayWeekday(now));
  monday.setHours(0, 0, 0, 0);
  const out: RosterShift[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const key = dateKey(day);
    if (key < pattern.startDate) continue;
    if (pattern.kind === "temporary" && pattern.endDate && key > pattern.endDate) continue;
    if (!pattern.weekdays.includes(mondayWeekday(day))) continue;
    out.push({
      id: `${pattern.id}@${key}`,
      staffId: pattern.staffId,
      date: key,
      start: pattern.start,
      end: pattern.end,
      zone: pattern.zone,
      patternId: pattern.id,
    });
  }
  return out;
}

export interface AttendanceEvent {
  id: string;
  staffId: string;
  kind: "in" | "out";
  /** ISO timestamp */
  at: string;
  source: "kiosk" | "qr";
}

export type DerivedShiftStatus = "completed" | "on-site" | "late" | "missed" | "rostered";

/** Grace period before a shift with no check-in raises a missed alert. */
export const MISSED_GRACE_MIN = 15;
/** Checked in later than this after rostered start = "started late". */
export const LATE_AFTER_MIN = 5;
/** Weekly variance beyond this needs a manager's review before approval. */
export const REVIEW_VARIANCE_H = 0.5;

/* ---------------- demo cast + seeded week ---------------- */

export const staffDirectory: StaffMember[] = [
  { id: "marcus", name: "Marcus Chen", pin: "1234", role: "Cleaner" },
  { id: "leila", name: "Leila Haddad", pin: "2345", role: "Cleaner" },
  { id: "sofia", name: "Sofia Marino", pin: "3456", role: "Cleaner" },
  { id: "tom", name: "Tom Nguyen", pin: "4567", role: "Cleaner" },
  { id: "daniel", name: "Daniel Aboud", pin: "5678", role: "Cleaner" },
  { id: "grace", name: "Grace Liu", pin: "6789", role: "Cleaner" },
];

export const staffById: Record<string, StaffMember> = Object.fromEntries(
  staffDirectory.map((s) => [s.id, s])
);

/** Register a manager-added cleaner into the module registry (kiosk PIN
 *  lookup, dashboard names, derivations all read it). Idempotent by id. */
function registerStaff(m: StaffMember) {
  if (!staffById[m.id]) {
    staffDirectory.push(m);
    staffById[m.id] = m;
  }
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function decHours(d: Date): number {
  return d.getHours() + d.getMinutes() / 60;
}

function atTime(day: Date, dec: number): Date {
  const d = new Date(day);
  d.setHours(Math.floor(dec), Math.round((dec % 1) * 60), 0, 0);
  return d;
}

const ZONES: Record<string, string> = {
  marcus: "Lobby + L1–L8",
  leila: "L9–L24",
  tom: "L25–L40 + BOH",
  sofia: "End-of-trip + gym",
  daniel: "Lifts + glass line",
  grace: "L20 store + restock",
};

const STARTS: Record<string, [number, number]> = {
  marcus: [6, 10],
  leila: [6, 10.5],
  tom: [6, 10],
  sofia: [6.5, 9.5],
  daniel: [7, 11],
  grace: [10, 13],
};

/**
 * Seed a working week (Mon → today) of rostered shifts plus realistic
 * events: small on-time variances, Sofia's two late starts, Tom's missed
 * Wednesday, and today's mid-flight state (Marcus done, Leila/Daniel on
 * site, Sofia late, Tom missed, Grace still rostered).
 */
function seedWeek(now: Date): { shifts: RosterShift[]; events: AttendanceEvent[] } {
  const shifts: RosterShift[] = [];
  const events: AttendanceEvent[] = [];
  const push = (staffId: string, day: Date, inOff: number | null, outOff: number | null) => {
    const [s, e] = STARTS[staffId]!;
    const key = dateKey(day);
    shifts.push({ id: `${staffId}-${key}`, staffId, date: key, start: s, end: e, zone: ZONES[staffId]! });
    if (inOff !== null)
      events.push({ id: `${staffId}-${key}-in`, staffId, kind: "in", at: atTime(day, s + inOff).toISOString(), source: "kiosk" });
    if (outOff !== null)
      events.push({ id: `${staffId}-${key}-out`, staffId, kind: "out", at: atTime(day, e + outOff).toISOString(), source: "kiosk" });
  };

  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // back to Monday
  const daysSoFar = Math.min((now.getDay() + 6) % 7, 4); // Mon..Fri history before today

  for (let i = 0; i < daysSoFar; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    for (const s of staffDirectory) {
      if (s.id === "tom" && i === 2) {
        // Tom's missed Wednesday — rostered, never checked in
        push(s.id, day, null, null);
      } else if (s.id === "sofia" && (i === 1 || i === 3)) {
        // two late starts (tram disruption)
        push(s.id, day, 0.42, 0);
      } else {
        push(s.id, day, i % 2 === 0 ? -0.05 : 0.03, i % 3 === 0 ? 0.07 : 0);
      }
    }
  }

  // Today: a mid-flight cast ANCHORED TO THE CLOCK so the demo looks alive
  // at any hour — one completed, two on site, one late, one missed, one
  // still rostered. Times sit on the half-hour grid around "now".
  const anchor = Math.min(19, Math.max(2.5, Math.round((decHours(now) - 0.5) * 2) / 2));
  const todayCast: Array<{ id: string; start: number; end: number; inOff: number | null; outOff: number | null }> = [
    { id: "marcus", start: anchor - 2.5, end: anchor - 0.5, inOff: -0.03, outOff: 0.07 }, // completed
    { id: "leila", start: anchor - 1.5, end: anchor + 3, inOff: 0.03, outOff: null }, // on site
    { id: "tom", start: anchor - 1, end: anchor + 3, inOff: null, outOff: null }, // missed
    { id: "sofia", start: anchor - 1, end: anchor + 2, inOff: 0.42, outOff: null }, // started late
    { id: "daniel", start: anchor - 0.5, end: anchor + 3.5, inOff: -0.02, outOff: null }, // on site
    { id: "grace", start: anchor + 1.5, end: anchor + 4.5, inOff: null, outOff: null }, // rostered
  ];
  const todayKey = dateKey(now);
  for (const c of todayCast) {
    const start = Math.max(0.25, c.start);
    shifts.push({
      id: `${c.id}-${todayKey}`,
      staffId: c.id,
      date: todayKey,
      start,
      end: Math.min(23.75, Math.max(start + 1, c.end)),
      zone: ZONES[c.id]!,
    });
    if (c.inOff !== null)
      events.push({ id: `${c.id}-${todayKey}-in`, staffId: c.id, kind: "in", at: atTime(now, start + c.inOff).toISOString(), source: "kiosk" });
    if (c.outOff !== null)
      events.push({ id: `${c.id}-${todayKey}-out`, staffId: c.id, kind: "out", at: atTime(now, Math.min(23.75, Math.max(start + 1, c.end)) + c.outOff).toISOString(), source: "kiosk" });
  }
  // safety: never seed an event claiming a future time
  const cutoff = now.toISOString();
  return {
    shifts,
    events: events.filter((e) => !(e.at > cutoff && e.id.includes(todayKey))),
  };
}

/* ---------------- derivations ---------------- */

export interface ShiftView {
  shift: RosterShift;
  staff: StaffMember;
  status: DerivedShiftStatus;
  checkIn?: Date;
  checkOut?: Date;
}

function eventsFor(events: AttendanceEvent[], staffId: string, date: string) {
  return events
    .filter((e) => e.staffId === staffId && dateKey(new Date(e.at)) === date)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function deriveShift(shift: RosterShift, events: AttendanceEvent[], now: Date): ShiftView {
  const dayEvents = eventsFor(events, shift.staffId, shift.date);
  const firstIn = dayEvents.find((e) => e.kind === "in");
  const lastOut = [...dayEvents].reverse().find((e) => e.kind === "out");
  const staff = staffById[shift.staffId]!;
  const startAt = atTime(new Date(`${shift.date}T00:00:00`), shift.start);

  let status: DerivedShiftStatus;
  if (firstIn && lastOut && lastOut.at > firstIn.at) status = "completed";
  else if (firstIn) {
    const lateBy = (new Date(firstIn.at).getTime() - startAt.getTime()) / 60000;
    status = lateBy > LATE_AFTER_MIN ? "late" : "on-site";
  } else {
    const graceEnd = new Date(startAt.getTime() + MISSED_GRACE_MIN * 60000);
    status = now > graceEnd ? "missed" : "rostered";
  }
  return {
    shift,
    staff,
    status,
    checkIn: firstIn ? new Date(firstIn.at) : undefined,
    checkOut: lastOut ? new Date(lastOut.at) : undefined,
  };
}

export interface MissedAlert {
  shift: RosterShift;
  staff: StaffMember;
  /** minutes since rostered start */
  overdueMin: number;
}

export function deriveMissedAlerts(
  shifts: RosterShift[],
  events: AttendanceEvent[],
  now: Date
): MissedAlert[] {
  const today = dateKey(now);
  return shifts
    .filter((s) => s.date === today)
    .map((s) => deriveShift(s, events, now))
    .filter((v) => v.status === "missed")
    .map((v) => ({
      shift: v.shift,
      staff: v.staff,
      overdueMin: Math.round(
        (now.getTime() - atTime(now, v.shift.start).getTime()) / 60000
      ),
    }));
}

export interface TimesheetEntry {
  shift: RosterShift;
  staff: StaffMember;
  status: DerivedShiftStatus;
  rostered: number;
  /** paired in→out hours; 0 when missed, in-progress counts to `now` */
  actual: number;
  inProgress: boolean;
  checkIn?: Date;
  checkOut?: Date;
  /** manager's per-shift +/- hours correction */
  correction?: ShiftCorrection;
  /** actual + correction, floored at 0 — what payroll pays for this shift */
  paid: number;
}

export interface TimesheetWeekRow {
  staff: StaffMember;
  entries: TimesheetEntry[];
  rostered: number;
  actual: number;
  /** actual with per-shift corrections applied — payroll's number */
  corrected: number;
  variance: number;
  needsReview: boolean;
  approved: boolean;
  /** manager's payroll decision — set when approved with the review modal */
  approval?: { note?: string; approvedHours?: number };
}

export function deriveTimesheets(
  shifts: RosterShift[],
  events: AttendanceEvent[],
  approvals: Record<string, string>,
  now: Date,
  approvalMeta: Record<string, ApprovalMeta> = {},
  corrections: Record<string, ShiftCorrection> = {}
): TimesheetWeekRow[] {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const mondayKey = dateKey(monday);
  const todayKey = dateKey(now);
  return staffDirectory.map((staff) => {
    const entries: TimesheetEntry[] = shifts
      // this week, up to today — future pattern occurrences aren't payable yet
      .filter((s) => s.staffId === staff.id && new Date(`${s.date}T12:00:00`) >= monday && s.date <= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => {
        const v = deriveShift(s, events, now);
        let actual = 0;
        let inProgress = false;
        if (v.checkIn && v.checkOut) actual = (v.checkOut.getTime() - v.checkIn.getTime()) / 3600000;
        else if (v.checkIn) {
          actual = (now.getTime() - v.checkIn.getTime()) / 3600000;
          inProgress = true;
        }
        const rounded = Math.max(0, Math.round(actual * 100) / 100);
        const correction = corrections[s.id];
        return {
          shift: s,
          staff,
          status: v.status,
          rostered: s.end - s.start,
          actual: rounded,
          inProgress,
          checkIn: v.checkIn,
          checkOut: v.checkOut,
          correction,
          paid: Math.max(0, Math.round((rounded + (correction?.delta ?? 0)) * 100) / 100),
        };
      });
    const done = entries.filter((e) => !e.inProgress);
    const rostered = done.reduce((n, e) => n + e.rostered, 0);
    const actual = done.reduce((n, e) => n + e.actual, 0);
    const corrected = done.reduce((n, e) => n + e.paid, 0);
    const variance = Math.round((actual - rostered) * 100) / 100;
    return {
      staff,
      entries,
      rostered,
      actual: Math.round(actual * 100) / 100,
      corrected: Math.round(corrected * 100) / 100,
      variance,
      needsReview:
        Math.abs(variance) > REVIEW_VARIANCE_H || entries.some((e) => e.status === "missed"),
      approved: approvals[staff.id] === mondayKey,
      approval:
        approvals[staff.id] === mondayKey && approvalMeta[staff.id]?.week === mondayKey
          ? { note: approvalMeta[staff.id]!.note, approvedHours: approvalMeta[staff.id]!.approvedHours }
          : undefined,
    };
  }).filter((r) => r.entries.length > 0 || approvals[r.staff.id] === mondayKey);
}

/* ---------------- store ---------------- */

export interface CheckResult {
  ok: boolean;
  staff?: StaffMember;
  /** check-in attempted while already on the clock */
  already?: boolean;
  /** check-out attempted with no open shift */
  noOpenShift?: boolean;
}

export interface ApprovalMeta {
  week: string;
  note?: string;
  /** manager-adjusted payroll hours (defaults to derived actual) */
  approvedHours?: number;
}

/** A per-shift payroll correction: +/- hours with the manager's reason. */
export interface ShiftCorrection {
  delta: number;
  note: string;
}

interface AttendanceState {
  shifts: RosterShift[];
  events: AttendanceEvent[];
  /** staffId → monday dateKey of the approved week */
  approvals: Record<string, string>;
  /** staffId → remarks + adjusted hours captured at approval */
  approvalMeta: Record<string, ApprovalMeta>;
  /** shift id → per-shift +/- hours correction with remark */
  corrections: Record<string, ShiftCorrection>;
  /** standing roster arrangements (ongoing / temporary) */
  shiftPatterns: ShiftPattern[];
  /** manager-added cleaners (seed cast lives in staffDirectory) */
  customStaff: StaffMember[];
  seededAt: string | null;
  /** Seeds the demo week on first mount (client-only; needs the real clock). */
  ensureSeed: () => void;
  checkIn: (pin: string) => CheckResult;
  checkOut: (pin: string) => CheckResult;
  addShift: (input: { staffId: string; date: string; start: number; end: number; zone: string }) => void;
  addShiftPattern: (input: Omit<ShiftPattern, "id">) => void;
  setCorrection: (shiftId: string, correction: ShiftCorrection | null) => void;
  addStaff: (input: { name: string; pin: string; role?: string }) => { ok: boolean; error?: string; staff?: StaffMember };
  approveWeek: (staffId: string, now: Date, opts?: { note?: string; approvedHours?: number }) => void;
  approveAllReady: (now: Date) => void;
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
      /* demo persistence is best-effort */
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

let evSeq = 0;
const eventId = () => `ev-${Date.now()}-${evSeq++}`;

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      shifts: [],
      events: [],
      approvals: {},
      approvalMeta: {},
      corrections: {},
      shiftPatterns: [],
      customStaff: [],
      seededAt: null,

      ensureSeed: () => {
        const s = get();
        // manager-added cleaners must survive reseeds AND reloads
        s.customStaff.forEach(registerStaff);
        const now = new Date();
        const today = dateKey(now);
        // reseed when empty OR when the seed is from an older day (demo stays alive)
        if (s.seededAt === today && s.shifts.length) return;
        const seeded = seedWeek(now);
        // standing arrangements survive the reseed — re-materialise this week
        const fromPatterns = s.shiftPatterns.flatMap((pt) => patternOccurrencesForWeek(pt, now));
        set({
          shifts: [...seeded.shifts, ...fromPatterns],
          events: seeded.events,
          approvals: {},
          approvalMeta: {},
          corrections: {},
          seededAt: today,
        });
      },

      checkIn: (pin) => {
        const staff = staffDirectory.find((m) => m.pin === pin);
        if (!staff) return { ok: false };
        const now = new Date();
        const today = eventsFor(get().events, staff.id, dateKey(now));
        const open = today.length && today[today.length - 1]!.kind === "in";
        if (open) return { ok: true, staff, already: true };
        set((st) => ({
          events: [
            ...st.events,
            { id: eventId(), staffId: staff.id, kind: "in", at: now.toISOString(), source: "kiosk" },
          ],
        }));
        return { ok: true, staff };
      },

      checkOut: (pin) => {
        const staff = staffDirectory.find((m) => m.pin === pin);
        if (!staff) return { ok: false };
        const now = new Date();
        const today = eventsFor(get().events, staff.id, dateKey(now));
        const open = today.length && today[today.length - 1]!.kind === "in";
        if (!open) return { ok: true, staff, noOpenShift: true };
        set((st) => ({
          events: [
            ...st.events,
            { id: eventId(), staffId: staff.id, kind: "out", at: now.toISOString(), source: "kiosk" },
          ],
        }));
        return { ok: true, staff };
      },

      addShift: (input) => {
        set((st) => ({
          shifts: [
            ...st.shifts,
            { id: `${input.staffId}-${input.date}-${Math.round(input.start * 60)}`, ...input },
          ],
        }));
      },

      addShiftPattern: (input) => {
        const pattern: ShiftPattern = { id: `pt-${Date.now()}-${evSeq++}`, ...input };
        const occurrences = patternOccurrencesForWeek(pattern, new Date());
        set((st) => ({
          shiftPatterns: [...st.shiftPatterns, pattern],
          shifts: [...st.shifts, ...occurrences.filter((o) => !st.shifts.some((x) => x.id === o.id))],
        }));
      },

      setCorrection: (shiftId, correction) =>
        set((st) => {
          const next = { ...st.corrections };
          if (correction && Math.abs(correction.delta) > 0.001) next[shiftId] = correction;
          else delete next[shiftId];
          return { corrections: next };
        }),

      addStaff: (input) => {
        const name = input.name.trim();
        const pin = input.pin.trim();
        if (name.length < 2) return { ok: false, error: "Enter the cleaner's name" };
        if (!/^\d{4}$/.test(pin)) return { ok: false, error: "PIN must be exactly 4 digits" };
        if (staffDirectory.some((s) => s.pin === pin))
          return { ok: false, error: "That PIN is already in use — pick another" };
        const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cleaner";
        let id = base;
        let n = 2;
        while (staffById[id]) id = `${base}-${n++}`;
        const staff: StaffMember = { id, name, pin, role: input.role?.trim() || "Cleaner" };
        registerStaff(staff);
        set((st) => ({ customStaff: [...st.customStaff, staff] }));
        return { ok: true, staff };
      },

      approveWeek: (staffId, now, opts) => {
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const week = dateKey(monday);
        set((st) => ({
          approvals: { ...st.approvals, [staffId]: week },
          approvalMeta: opts
            ? { ...st.approvalMeta, [staffId]: { week, note: opts.note, approvedHours: opts.approvedHours } }
            : st.approvalMeta,
        }));
      },

      approveAllReady: (now) => {
        const rows = deriveTimesheets(get().shifts, get().events, get().approvals, now);
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        const key = dateKey(monday);
        set((st) => ({
          approvals: {
            ...st.approvals,
            ...Object.fromEntries(
              rows.filter((r) => !r.needsReview && !r.approved).map((r) => [r.staff.id, key])
            ),
          },
        }));
      },

      resetDemo: () => {
        const seeded = seedWeek(new Date());
        set({ ...seeded, approvals: {}, approvalMeta: {}, corrections: {}, shiftPatterns: [], customStaff: [], seededAt: dateKey(new Date()) });
      },
    }),
    {
      name: "foct-attendance-v1",
      storage: createJSONStorage(() => safeStorage),
      // SSR-safe: server render shows empty state; pages rehydrate + seed
      // post-mount via useAttendanceReady().
      skipHydration: true,
    }
  )
);

/**
 * Rehydrate + seed after mount; returns `now` (re-ticking each minute) so
 * derivations are hydration-safe — render nothing time-dependent until set.
 */
export function useAttendanceReady(): Date | null {
  const [now, setNow] = React.useState<Date | null>(null);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useAttendanceStore.persist.rehydrate();
      useAttendanceStore.getState().ensureSeed();
    }
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
