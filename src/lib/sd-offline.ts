"use client";

/**
 * Offline sync engine for the Service Desk — ported from the owner's FFM
 * Building Support import (import/ticketing-system, sync.js/db.js) and
 * adapted to OUR sd_* backend. Every live-mode mutation queues an outbox op
 * in IndexedDB first (instant, no reception needed); the engine replays the
 * outbox in order, idempotently, when the device comes back online, every
 * 60 s, on tab refocus, and on demand. In demo mode (SD_LIVE off) the engine
 * is disabled — the local store already IS the truth.
 */
import * as React from "react";
import { lodgeViaIntake, SD_LIVE_FLAG, sdLive } from "@/lib/sd-supabase";
import type { NewTicketInput } from "@/lib/service-desk-store";

const DB_NAME = "foct-sd-offline";
const STORE = "outbox";
const AUTO_INTERVAL_MS = 60_000;

export interface OutboxOp {
  id: string;
  createdAt: number;
  type:
    | "lodge"
    | "assign"
    | "attend"
    | "close"
    | "reopen"
    | "addInternalNote"
    | "addFollower"
    | "removeFollower"
    | "setCsat";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export interface SyncState {
  enabled: boolean;
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSync: number | null;
  lastError: string | null;
}

const state: SyncState = {
  enabled: SD_LIVE_FLAG,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastSync: null,
  lastError: null,
};

const listeners = new Set<(s: SyncState) => void>();
const emit = () => listeners.forEach((fn) => fn({ ...state }));

/* ---------------- tiny IndexedDB helper ---------------- */

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbAll(): Promise<OutboxOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OutboxOp[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(op: OutboxOp): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- outbox ---------------- */

let seq = 0;
const opId = () => `op-${Date.now()}-${seq++}-${Math.floor(Math.random() * 1e6)}`;

async function refreshPending() {
  try {
    state.pending = (await idbAll()).length;
  } catch {
    /* IndexedDB unavailable (private mode) — stay at 0, ops run direct */
  }
  emit();
}

/** Queue a mutation. In demo mode this is a no-op (local store is truth). */
export async function queueOp(type: OutboxOp["type"], payload: OutboxOp["payload"]) {
  if (!state.enabled) return;
  try {
    await idbPut({ id: opId(), createdAt: Date.now(), type, payload });
    await refreshPending();
  } catch {
    // fall back to direct fire-and-forget if IndexedDB is unavailable
    void applyOp({ id: opId(), createdAt: Date.now(), type, payload }).catch(() => undefined);
    return;
  }
  if (state.online) void flush();
}

async function applyOp(op: OutboxOp): Promise<void> {
  switch (op.type) {
    case "lodge":
      await lodgeViaIntake(op.payload as NewTicketInput);
      break;
    case "assign":
      await sdLive.assign(op.payload.ref, op.payload.cleaner);
      break;
    case "attend":
      await sdLive.attend(op.payload.ref, op.payload.by);
      break;
    case "close":
      await sdLive.close(op.payload.ref, op.payload.args);
      break;
    case "reopen":
      await sdLive.reopen(op.payload.ref, op.payload.by);
      break;
    case "addInternalNote":
      await sdLive.addInternalNote(op.payload.ref, op.payload.by, op.payload.text);
      break;
    case "addFollower":
      await sdLive.addFollower(op.payload.ref, op.payload.email);
      break;
    case "removeFollower":
      await sdLive.removeFollower(op.payload.ref, op.payload.email);
      break;
    case "setCsat":
      await sdLive.setCsat(op.payload.ref, op.payload.rating);
      break;
  }
}

const isNetworkError = (e: unknown) => {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
};

let flushPromise: Promise<void> | null = null;
/** Replay the outbox in order; stops at the first failure and retries later. */
export function flush(): Promise<void> {
  if (flushPromise) return flushPromise;
  flushPromise = doFlush().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function doFlush() {
  if (!state.enabled) return;
  let rows: OutboxOp[];
  try {
    rows = (await idbAll()).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return;
  }
  if (!rows.length) return;
  state.syncing = true;
  state.lastError = null;
  emit();
  try {
    for (const op of rows) {
      await applyOp(op);
      await idbDelete(op.id);
      state.pending = Math.max(0, state.pending - 1);
      emit();
    }
    state.lastSync = Date.now();
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : String(e);
    if (isNetworkError(e)) state.online = false;
  } finally {
    state.syncing = false;
    emit();
  }
}

/* ---------------- lifecycle + React hook ---------------- */

let wired = false;
function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => {
    state.online = true;
    emit();
    void flush();
  });
  window.addEventListener("offline", () => {
    state.online = false;
    emit();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state.online) void flush();
  });
  setInterval(() => {
    if (state.online) void flush();
  }, AUTO_INTERVAL_MS);
  void refreshPending();
}

/** Live sync status for the SYNCED / QUEUED pill. */
export function useSyncStatus(): SyncState & { syncNow: () => void } {
  const [snap, setSnap] = React.useState<SyncState>({ ...state });
  React.useEffect(() => {
    wire();
    const fn = (s: SyncState) => setSnap(s);
    listeners.add(fn);
    fn({ ...state });
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return { ...snap, syncNow: () => void flush() };
}
