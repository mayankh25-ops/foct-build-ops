"use client";

/**
 * The kiosk's local database (IndexedDB via Dexie).
 *
 * A cleaners' room is a basement. The tablet must sign people in with no
 * network at all, so it keeps its own copy of what it needs and its own record
 * of what happened:
 *
 *   employees  — names + bcrypt PIN hashes, never PINs
 *   notices    — the general ones only; personal notes are never cached on a
 *                shared tablet where the wrong person could read them
 *   outbox     — sign-ins waiting to reach the server, each with a UUID the
 *                server upserts on, so a replay can never double-punch anyone
 *   selfies    — photo blobs waiting to upload, keyed by their event
 *   meta       — site config, last sync, and the clock offset we learned
 *
 * Nothing here talks to the network; `kiosk-sync.ts` does that.
 */
import Dexie, { type Table } from "dexie";

export interface CachedEmployee {
  id: string;
  name: string;
  role: string;
  /** bcrypt — compared locally, never reversible to a PIN */
  pin_hash: string | null;
  language: string;
}

export interface CachedNotice {
  id: string;
  title: Record<string, string>;
  body: Record<string, string>;
  priority: "info" | "important" | "urgent";
  requires_ack: boolean;
  version: number;
  starts_on: string;
  ends_on: string | null;
  start_min: number | null;
  end_min: number | null;
}

export type OutboxKind = "in" | "out" | "ack";

export interface OutboxItem {
  /** the idempotency key — generated here, honoured by the server */
  client_event_id: string;
  kind: OutboxKind;
  staff_id: string;
  staff_name: string;
  /** ISO, from the tablet's own clock */
  device_time: string;
  /** true when it was recorded with no network */
  recorded_offline: boolean;
  /** for kind === "ack" */
  notice_id?: string;
  /** how many times we have tried to push it */
  attempts: number;
  last_error?: string;
}

export interface QueuedSelfie {
  client_event_id: string;
  blob: Blob;
  created_at: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

class KioskDb extends Dexie {
  employees!: Table<CachedEmployee, string>;
  notices!: Table<CachedNotice, string>;
  outbox!: Table<OutboxItem, string>;
  selfies!: Table<QueuedSelfie, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("foct-kiosk");
    this.version(1).stores({
      employees: "id, name",
      notices: "id",
      outbox: "client_event_id, device_time",
      selfies: "client_event_id",
      meta: "key",
    });
  }
}

let db: KioskDb | null = null;

/** Null on the server and in any browser without IndexedDB — callers degrade
 *  to online-only rather than crashing. */
export function kioskDb(): KioskDb | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  db ??= new KioskDb();
  return db;
}

/* ------------------------------------------------------------- meta ---- */

export const META = {
  site: "site",
  lastSync: "last_sync",
  /** serverTime - deviceTime at the last sync, in ms */
  clockOffset: "clock_offset_ms",
  defaultLanguage: "default_language",
} as const;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await kioskDb()?.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await kioskDb()?.meta.put({ key, value });
}

/* ------------------------------------------------------------ limits --- */

/** Caps, so a tablet left offline for a month degrades predictably instead of
 *  filling its disk and failing at the worst moment. Events are never dropped;
 *  photos are, because attendance matters more than its illustration. */
export const MAX_OUTBOX = 5000;
export const MAX_SELFIES = 500;

/** How stale the cache may get before we say so on screen. */
export const STALE_AFTER_DAYS = 7;

export async function trimSelfies(): Promise<number> {
  const d = kioskDb();
  if (!d) return 0;
  const count = await d.selfies.count();
  if (count <= MAX_SELFIES) return 0;
  const oldest = await d.selfies.orderBy("created_at").limit(count - MAX_SELFIES).toArray();
  await d.selfies.bulkDelete(oldest.map((s) => s.client_event_id));
  return oldest.length;
}
