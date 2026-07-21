"use client";

/**
 * Residents module (owner direction 2026-07-17) — the ResidentRequests
 * "coming soon" shell promoted to a functional module: enrolment with
 * emergency contacts / next of kin, access credentials, conduct history
 * (complaints/warnings), amenity bookings and resident requests (hard
 * rubbish, maintenance, guest access, moves). Parcels are NOT duplicated
 * here — the resident drawer reads the concierge parcel register by
 * apartment.
 *
 * Isolation model for Stage 2: resident records belong to the concierge/BM
 * organisation × building. The cleaning org never sees this data; the
 * building owner org sees counts, not records. Every table below maps to a
 * building-scoped table under that RLS model, and history entries are
 * audit-logged writes.
 */
import * as React from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export type CredentialKind = "fob" | "swipe-card" | "garage-remote" | "mailbox-key";
export type CredentialStatus = "active" | "lost" | "returned";

export interface AccessCredential {
  id: string;
  kind: CredentialKind;
  /** engraved / printed identifier, e.g. "FOB-2704-A" */
  label: string;
  issuedAt: string; // ISO date
  status: CredentialStatus;
}

export type HistoryKind = "note" | "complaint" | "warning" | "incident";

export interface ResidentHistoryEntry {
  id: string;
  kind: HistoryKind;
  at: string; // ISO
  by: string;
  text: string;
}

export interface Resident {
  id: string;
  name: string;
  apartment: string;
  floor: number;
  type: "owner-occupier" | "tenant";
  phone: string;
  email: string;
  movedIn: string; // ISO date
  parkingBay?: string;
  storageCage?: string;
  vehicle?: string;
  pets?: string;
  medicalNote?: string;
  emergency: EmergencyContact[];
  credentials: AccessCredential[];
  history: ResidentHistoryEntry[];
  status: "active" | "moving-out" | "former";
}

export const AMENITIES = [
  { id: "cinema", name: "Cinema room", where: "Level 5", capacity: 12 },
  { id: "karaoke", name: "Karaoke lounge", where: "Level 5", capacity: 10 },
  { id: "bbq", name: "BBQ terrace", where: "Level 40", capacity: 20 },
  { id: "dining", name: "Private dining room", where: "Level 40", capacity: 14 },
  { id: "pool", name: "Pool & spa (private hire)", where: "Level 6", capacity: 8 },
  { id: "gym-pt", name: "Gym PT room", where: "Level 6", capacity: 2 },
] as const;
export type AmenityId = (typeof AMENITIES)[number]["id"];

export interface AmenityBooking {
  id: string;
  residentId: string;
  amenityId: AmenityId;
  date: string; // YYYY-MM-DD
  /** decimal hours, e.g. 18.5 = 6:30 pm */
  start: number;
  end: number;
  guests: number;
  status: "pending" | "confirmed" | "declined";
  note?: string;
}

export type RequestKind =
  | "hard-rubbish"
  | "maintenance"
  | "guest-access"
  | "move-booking"
  | "other";

export const requestKindMeta: Record<RequestKind, { label: string }> = {
  "hard-rubbish": { label: "Hard rubbish collection" },
  maintenance: { label: "Maintenance request" },
  "guest-access": { label: "Guest access" },
  "move-booking": { label: "Move booking" },
  other: { label: "Other" },
};

export interface ResidentRequest {
  id: string;
  /** human reference shown to the resident, RR-xxxx */
  ref: string;
  residentId: string;
  kind: RequestKind;
  at: string; // ISO
  detail: string;
  preferredDate?: string; // YYYY-MM-DD
  status: "new" | "scheduled" | "in-progress" | "done" | "declined";
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d: number) => {
  const dt = new Date(Date.now() + d * 86400000);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Seed matches the concierge parcel register apartments so both modules agree. */
const seedResidents = (): Resident[] => [
  {
    id: "r-okafor",
    name: "James Okafor",
    apartment: "2704",
    floor: 27,
    type: "owner-occupier",
    phone: "0412 118 204",
    email: "j.okafor@outlook.com",
    movedIn: "2023-02-14",
    parkingBay: "B2-114",
    storageCage: "SC-27-04",
    vehicle: "Tesla Model 3 · 1QX 4LR",
    pets: "1 cat (registered)",
    emergency: [
      { name: "Adaeze Okafor", relationship: "Spouse", phone: "0412 118 990" },
      { name: "Chike Okafor", relationship: "Brother · next of kin", phone: "0433 671 002" },
    ],
    credentials: [
      { id: "c1", kind: "fob", label: "FOB-2704-A", issuedAt: "2023-02-14", status: "active" },
      { id: "c2", kind: "fob", label: "FOB-2704-B", issuedAt: "2023-02-14", status: "active" },
      { id: "c3", kind: "garage-remote", label: "GR-2704", issuedAt: "2023-02-14", status: "active" },
    ],
    history: [
      { id: "h1", kind: "note", at: daysAgo(40), by: "Amelia Ng", text: "Requested contractor access for kitchen reno — induction paperwork on file." },
    ],
    status: "active",
  },
  {
    id: "r-petrova",
    name: "Marina Petrova",
    apartment: "1109",
    floor: 11,
    type: "tenant",
    phone: "0401 552 718",
    email: "marina.petrova@gmail.com",
    movedIn: "2024-08-01",
    parkingBay: "B1-042",
    vehicle: "Mazda CX-5 · ABJ 123",
    emergency: [{ name: "Olga Petrova", relationship: "Mother · next of kin", phone: "+7 921 555 0180" }],
    credentials: [
      { id: "c4", kind: "fob", label: "FOB-1109-A", issuedAt: "2024-08-01", status: "active" },
      { id: "c5", kind: "swipe-card", label: "SW-1109", issuedAt: "2024-08-01", status: "lost" },
    ],
    history: [
      { id: "h2", kind: "complaint", at: daysAgo(12), by: "Ravi Sharma", text: "Complained about lift 2 wait times during morning peak — passed to BM." },
    ],
    status: "active",
  },
  {
    id: "r-whitford",
    name: "Simon Whitford",
    apartment: "3302",
    floor: 33,
    type: "owner-occupier",
    phone: "0419 883 340",
    email: "s.whitford@whitfordgroup.com.au",
    movedIn: "2021-11-20",
    parkingBay: "B3-201 + B3-202",
    storageCage: "SC-33-02",
    vehicle: "Range Rover Sport · SWH 001",
    emergency: [{ name: "Eleanor Whitford", relationship: "Spouse", phone: "0419 883 341" }],
    medicalNote: "Pacemaker — advise paramedics on any medical callout.",
    credentials: [
      { id: "c6", kind: "fob", label: "FOB-3302-A", issuedAt: "2021-11-20", status: "active" },
      { id: "c7", kind: "garage-remote", label: "GR-3302-A", issuedAt: "2021-11-20", status: "active" },
      { id: "c8", kind: "garage-remote", label: "GR-3302-B", issuedAt: "2022-03-02", status: "returned" },
    ],
    history: [
      { id: "h3", kind: "warning", at: daysAgo(60), by: "Building manager", text: "Formal warning — short-stay letting detected (L33-02, Feb). By-law 14 breach; repeated breach escalates to OC." },
      { id: "h4", kind: "note", at: daysAgo(20), by: "Amelia Ng", text: "Warning acknowledged in writing; listing removed." },
    ],
    status: "active",
  },
  {
    id: "r-tran",
    name: "Linh Tran",
    apartment: "0806",
    floor: 8,
    type: "tenant",
    phone: "0430 227 519",
    email: "linh.tran.melb@gmail.com",
    movedIn: "2025-01-15",
    pets: "1 small dog (approved)",
    emergency: [{ name: "Bao Tran", relationship: "Father · next of kin", phone: "0430 227 001" }],
    credentials: [{ id: "c9", kind: "fob", label: "FOB-0806-A", issuedAt: "2025-01-15", status: "active" }],
    history: [],
    status: "active",
  },
  {
    id: "r-nguyen",
    name: "Kim Nguyen",
    apartment: "1502",
    floor: 15,
    type: "owner-occupier",
    phone: "0402 664 190",
    email: "kim.nguyen@icloud.com",
    movedIn: "2022-06-30",
    parkingBay: "B2-078",
    emergency: [{ name: "Thanh Nguyen", relationship: "Husband", phone: "0402 664 191" }],
    credentials: [
      { id: "c10", kind: "fob", label: "FOB-1502-A", issuedAt: "2022-06-30", status: "active" },
      { id: "c11", kind: "mailbox-key", label: "MB-1502", issuedAt: "2022-06-30", status: "active" },
    ],
    history: [
      { id: "h5", kind: "incident", at: daysAgo(5), by: "Concierge desk", text: "Balcony door alarm 02:10 — false alarm, resident overseas; NOK notified, patrol attended." },
    ],
    status: "active",
  },
  {
    id: "r-castellanos",
    name: "Diego Castellanos",
    apartment: "2211",
    floor: 22,
    type: "tenant",
    phone: "0468 774 356",
    email: "d.castellanos@hotmail.com",
    movedIn: "2024-03-11",
    vehicle: "Yamaha MT-07 · MC 4471 (motorcycle bay)",
    emergency: [{ name: "Sofía Castellanos", relationship: "Sister · next of kin", phone: "+34 655 210 884" }],
    credentials: [{ id: "c12", kind: "fob", label: "FOB-2211-A", issuedAt: "2024-03-11", status: "active" }],
    history: [
      { id: "h6", kind: "complaint", at: daysAgo(3), by: "Concierge desk", text: "Noise complaint from 2210 (Sat 23:40). First instance — spoken to, no further action." },
    ],
    status: "active",
  },
  {
    id: "r-osei",
    name: "Abena Osei",
    apartment: "3610",
    floor: 36,
    type: "owner-occupier",
    phone: "0415 902 663",
    email: "abena.osei@oseilegal.com.au",
    movedIn: "2020-09-01",
    parkingBay: "B3-190",
    storageCage: "SC-36-10",
    emergency: [{ name: "Kwame Osei", relationship: "Spouse", phone: "0415 902 664" }],
    credentials: [
      { id: "c13", kind: "fob", label: "FOB-3610-A", issuedAt: "2020-09-01", status: "active" },
      { id: "c14", kind: "swipe-card", label: "SW-3610", issuedAt: "2020-09-01", status: "active" },
    ],
    history: [],
    status: "active",
  },
  {
    id: "r-macleod",
    name: "Fiona MacLeod",
    apartment: "0403",
    floor: 4,
    type: "tenant",
    phone: "0421 007 483",
    email: "fi.macleod@gmail.com",
    movedIn: "2025-06-01",
    emergency: [{ name: "Ewan MacLeod", relationship: "Brother · next of kin", phone: "+44 7700 900123" }],
    credentials: [{ id: "c15", kind: "fob", label: "FOB-0403-A", issuedAt: "2025-06-01", status: "active" }],
    history: [],
    status: "moving-out",
  },
];

const seedBookings = (): AmenityBooking[] => [
  { id: "b1", residentId: "r-nguyen", amenityId: "cinema", date: daysAhead(2), start: 19, end: 22, guests: 8, status: "confirmed", note: "Birthday — movie night" },
  { id: "b2", residentId: "r-castellanos", amenityId: "karaoke", date: daysAhead(3), start: 20, end: 23, guests: 10, status: "pending" },
  { id: "b3", residentId: "r-okafor", amenityId: "bbq", date: daysAhead(6), start: 12, end: 15, guests: 14, status: "pending" },
  { id: "b4", residentId: "r-osei", amenityId: "dining", date: daysAhead(9), start: 18.5, end: 22, guests: 12, status: "confirmed" },
];

const seedRequests = (): ResidentRequest[] => [
  { id: "q1", ref: "RR-2031", residentId: "r-tran", kind: "hard-rubbish", at: daysAgo(1), detail: "Old 2-seater sofa + broken bookshelf", preferredDate: daysAhead(4), status: "new" },
  { id: "q2", ref: "RR-2030", residentId: "r-petrova", kind: "maintenance", at: daysAgo(2), detail: "Ensuite exhaust fan rattling", status: "scheduled" },
  { id: "q3", ref: "RR-2029", residentId: "r-macleod", kind: "move-booking", at: daysAgo(2), detail: "Move-out — lift padding + dock, morning preferred", preferredDate: daysAhead(12), status: "new" },
  { id: "q4", ref: "RR-2028", residentId: "r-whitford", kind: "guest-access", at: daysAgo(4), detail: "Parents visiting 2 weeks — temporary fob + visitor bay", status: "done" },
];

/** Non-declined bookings that clash with the proposed window — the
 *  double-booking guard for the concierge desk. */
export function conflictingBookings(
  bookings: AmenityBooking[],
  amenityId: AmenityId,
  date: string,
  start: number,
  end: number,
  ignoreId?: string
): AmenityBooking[] {
  return bookings.filter(
    (b) =>
      b.id !== ignoreId &&
      b.amenityId === amenityId &&
      b.date === date &&
      b.status !== "declined" &&
      b.start < end &&
      start < b.end
  );
}

export function nextRequestRef(requests: ResidentRequest[]): string {
  const nums = requests.map((r) => Number.parseInt(r.ref.replace("RR-", ""), 10)).filter(Number.isFinite);
  return `RR-${Math.max(2000, ...nums) + 1}`;
}

interface ResidentsState {
  residents: Resident[];
  bookings: AmenityBooking[];
  requests: ResidentRequest[];
  seeded: boolean;
  ensureSeed: () => void;
  enrolResident: (
    input: Omit<Resident, "id" | "credentials" | "history" | "status"> & {
      credentials?: AccessCredential[];
    }
  ) => string;
  addHistory: (residentId: string, entry: { kind: HistoryKind; by: string; text: string }) => void;
  addCredential: (residentId: string, kind: CredentialKind, label: string) => void;
  setCredentialStatus: (residentId: string, credentialId: string, status: CredentialStatus) => void;
  /** residents' own requests default to "pending"; the concierge desk books
   *  on behalf with status "confirmed". */
  addBooking: (input: Omit<AmenityBooking, "id" | "status"> & { status?: AmenityBooking["status"] }) => void;
  setBookingStatus: (id: string, status: AmenityBooking["status"]) => void;
  addRequest: (input: Omit<ResidentRequest, "id" | "ref" | "at" | "status">) => string;
  setRequestStatus: (id: string, status: ResidentRequest["status"]) => void;
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

export const useResidentsStore = create<ResidentsState>()(
  persist(
    (set, get) => ({
      residents: [],
      bookings: [],
      requests: [],
      seeded: false,

      ensureSeed: () => {
        if (get().seeded && get().residents.length) return;
        set({ residents: seedResidents(), bookings: seedBookings(), requests: seedRequests(), seeded: true });
      },

      enrolResident: (input) => {
        const id = `r-${Date.now()}-${seq++}`;
        set((s) => ({
          residents: [
            {
              ...input,
              id,
              credentials: input.credentials ?? [],
              history: [],
              status: "active" as const,
            },
            ...s.residents,
          ],
        }));
        return id;
      },

      addHistory: (residentId, entry) =>
        set((s) => ({
          residents: s.residents.map((r) =>
            r.id === residentId
              ? {
                  ...r,
                  history: [
                    { id: `h-${Date.now()}-${seq++}`, at: new Date().toISOString(), ...entry },
                    ...r.history,
                  ],
                }
              : r
          ),
        })),

      addCredential: (residentId, kind, label) =>
        set((s) => ({
          residents: s.residents.map((r) =>
            r.id === residentId
              ? {
                  ...r,
                  credentials: [
                    ...r.credentials,
                    {
                      id: `c-${Date.now()}-${seq++}`,
                      kind,
                      label: label.trim(),
                      issuedAt: new Date().toISOString().slice(0, 10),
                      status: "active" as const,
                    },
                  ],
                }
              : r
          ),
        })),

      setCredentialStatus: (residentId, credentialId, status) =>
        set((s) => ({
          residents: s.residents.map((r) =>
            r.id === residentId
              ? {
                  ...r,
                  credentials: r.credentials.map((c) => (c.id === credentialId ? { ...c, status } : c)),
                }
              : r
          ),
        })),

      addBooking: (input) =>
        set((s) => ({
          bookings: [
            { ...input, id: `b-${Date.now()}-${seq++}`, status: input.status ?? ("pending" as const) },
            ...s.bookings,
          ],
        })),

      setBookingStatus: (id, status) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),

      addRequest: (input) => {
        const ref = nextRequestRef(get().requests);
        set((s) => ({
          requests: [
            { ...input, id: `q-${Date.now()}-${seq++}`, ref, at: new Date().toISOString(), status: "new" as const },
            ...s.requests,
          ],
        }));
        return ref;
      },

      setRequestStatus: (id, status) =>
        set((s) => ({ requests: s.requests.map((q) => (q.id === id ? { ...q, status } : q)) })),

      resetDemo: () =>
        set({ residents: seedResidents(), bookings: seedBookings(), requests: seedRequests(), seeded: true }),
    }),
    {
      name: "foct-residents-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
    }
  )
);

export function useResidentsReady(): boolean {
  const [ready, setReady] = React.useState(false);
  const done = React.useRef(false);
  React.useEffect(() => {
    if (!done.current) {
      done.current = true;
      void useResidentsStore.persist.rehydrate();
      useResidentsStore.getState().ensureSeed();
    }
    setReady(true);
  }, []);
  return ready;
}
