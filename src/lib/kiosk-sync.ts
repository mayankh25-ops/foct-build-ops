"use client";

/**
 * The kiosk's sync engine — cache in, outbox out.
 *
 * The shape of it:
 *
 *   bootstrap()   pull site, employees and general notices into IndexedDB
 *   verifyPin()   compare a typed PIN against the cached bcrypt hash, offline
 *   record()      write a sign-in to the outbox and return immediately
 *   flush()       push the outbox; the server upserts on client_event_id, so
 *                 running this twice does nothing the first run didn't
 *
 * The cleaner never waits for the network. A sign-in is answered the instant
 * it is written locally; whether it has reached the server yet is our problem,
 * not theirs.
 */
import bcrypt from "bcryptjs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  getMeta,
  kioskDb,
  META,
  setMeta,
  STALE_AFTER_DAYS,
  trimSelfies,
  type CachedEmployee,
  type CachedNotice,
  type OutboxItem,
} from "@/lib/kiosk-db";

export interface KioskSite {
  id: string;
  name: string;
  timezone: string;
  default_language: string;
}

export interface SyncState {
  online: boolean;
  pending: number;
  lastSync: string | null;
  stale: boolean;
  syncing: boolean;
}

const SELFIE_BUCKET = "kiosk-selfies";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // last resort — only reached on very old WebViews
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-${Math.random()
    .toString(16)
    .slice(2, 14)}`;
}

/* ------------------------------------------------------- bootstrap ----- */

export async function bootstrap(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Not configured" };
  const db = kioskDb();
  try {
    const { data, error } = await getSupabase().rpc("kiosk_bootstrap", { p_token: token });
    if (error) return { ok: false, error: error.message };
    const res = data as {
      ok: boolean;
      error?: string;
      server_time?: string;
      site?: KioskSite;
      staff?: CachedEmployee[];
      notices?: CachedNotice[];
    } | null;
    if (!res?.ok || !res.site) return { ok: false, error: res?.error ?? "No answer" };

    if (db) {
      await db.transaction("rw", db.employees, db.notices, db.meta, async () => {
        await db.employees.clear();
        await db.employees.bulkPut(res.staff ?? []);
        await db.notices.clear();
        await db.notices.bulkPut(res.notices ?? []);
        await db.meta.put({ key: META.site, value: res.site });
        await db.meta.put({ key: META.lastSync, value: new Date().toISOString() });
        // the tablet's clock is not to be trusted; remember how far out it is
        if (res.server_time) {
          await db.meta.put({
            key: META.clockOffset,
            value: new Date(res.server_time).getTime() - Date.now(),
          });
        }
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function cachedSite(): Promise<KioskSite | null> {
  return (await getMeta<KioskSite>(META.site)) ?? null;
}

export async function cachedNotices(): Promise<CachedNotice[]> {
  const db = kioskDb();
  if (!db) return [];
  const all = await db.notices.toArray();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const mins = now.getHours() * 60 + now.getMinutes();
  return all.filter(
    (n) =>
      today >= n.starts_on &&
      (!n.ends_on || today <= n.ends_on) &&
      (n.start_min === null || mins >= n.start_min) &&
      (n.end_min === null || mins <= n.end_min)
  );
}

export async function searchCached(query: string): Promise<CachedEmployee[]> {
  const db = kioskDb();
  if (!db) return [];
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const all = await db.employees.toArray();
  return all.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 12);
}

/* --------------------------------------------------- offline PIN ------- */

/**
 * Verify a PIN against the cached hash. Returns the employee or null.
 *
 * Stated honestly: a 4-digit PIN is 10,000 possibilities, so the hash makes
 * extracting one from a stolen tablet expensive rather than impossible. It is
 * still far better than caching the PIN itself, and it is only reachable at
 * all by someone holding the physical device.
 */
export async function verifyPinOffline(
  pin: string,
  staffId?: string | null
): Promise<CachedEmployee | null> {
  const db = kioskDb();
  if (!db) return null;
  const candidates = staffId
    ? ([await db.employees.get(staffId)].filter(Boolean) as CachedEmployee[])
    : await db.employees.toArray();
  for (const e of candidates) {
    if (!e.pin_hash) continue;
    if (await bcrypt.compare(pin, e.pin_hash)) return e;
  }
  return null;
}

/* ------------------------------------------------------ the outbox ----- */

export interface RecordResult {
  clientEventId: string;
  at: Date;
}

/** Writes the event locally and returns at once. Syncing is a later problem. */
export async function record(args: {
  kind: "in" | "out";
  staffId: string;
  staffName: string;
  online: boolean;
}): Promise<RecordResult> {
  const db = kioskDb();
  const offset = (await getMeta<number>(META.clockOffset)) ?? 0;
  const at = new Date(Date.now() + offset); // best estimate of real time
  const item: OutboxItem = {
    client_event_id: uuid(),
    kind: args.kind,
    staff_id: args.staffId,
    staff_name: args.staffName,
    device_time: at.toISOString(),
    recorded_offline: !args.online,
    attempts: 0,
  };
  await db?.outbox.put(item);
  return { clientEventId: item.client_event_id, at };
}

export async function recordAck(noticeId: string, staffId: string): Promise<void> {
  const db = kioskDb();
  const offset = (await getMeta<number>(META.clockOffset)) ?? 0;
  await db?.outbox.put({
    client_event_id: uuid(),
    kind: "ack",
    staff_id: staffId,
    staff_name: "",
    notice_id: noticeId,
    device_time: new Date(Date.now() + offset).toISOString(),
    recorded_offline: !navigator.onLine,
    attempts: 0,
  });
}

export async function queueSelfie(clientEventId: string, dataUrl: string): Promise<void> {
  const db = kioskDb();
  if (!db) return;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await db.selfies.put({
      client_event_id: clientEventId,
      blob,
      created_at: new Date().toISOString(),
    });
    await trimSelfies();
  } catch {
    // a photo that cannot be stored is not worth failing a sign-in over
  }
}

export async function pendingCount(): Promise<number> {
  return (await kioskDb()?.outbox.count()) ?? 0;
}

/* ---------------------------------------------------------- flush ------ */

let flushing = false;

/** Push everything waiting. Safe to call as often as you like. */
export async function flush(token: string): Promise<{ pushed: number; failed: number }> {
  const db = kioskDb();
  if (!db || !isSupabaseConfigured || flushing || !navigator.onLine) {
    return { pushed: 0, failed: 0 };
  }
  flushing = true;
  let pushed = 0;
  let failed = 0;
  try {
    const supabase = getSupabase();
    const items = await db.outbox.orderBy("device_time").limit(100).toArray();
    const punches = items.filter((i) => i.kind !== "ack");
    const acks = items.filter((i) => i.kind === "ack");

    if (punches.length > 0) {
      const { data, error } = await supabase.rpc("kiosk_sync", {
        p_token: token,
        p_events: punches.map((i) => ({
          client_event_id: i.client_event_id,
          staff_id: i.staff_id,
          kind: i.kind,
          device_time: i.device_time,
          recorded_offline: i.recorded_offline,
        })),
      });
      if (error) throw new Error(error.message);
      const res = data as {
        ok: boolean;
        server_time?: string;
        results?: { client_event_id: string; ok: boolean; error?: string; event_id?: string }[];
      } | null;

      for (const r of res?.results ?? []) {
        if (r.ok) {
          await uploadQueuedSelfie(token, r.client_event_id, r.event_id);
          await db.outbox.delete(r.client_event_id);
          pushed++;
        } else {
          failed++;
          const item = punches.find((i) => i.client_event_id === r.client_event_id);
          if (item) {
            // A malformed or refused event will never succeed. Keep it out of
            // the way after five tries rather than blocking everything behind
            // it forever — but never delete it silently.
            const attempts = item.attempts + 1;
            await db.outbox.update(r.client_event_id, { attempts, last_error: r.error });
            if (attempts >= 5) {
              console.warn("kiosk: giving up on event", r.client_event_id, r.error);
            }
          }
        }
      }
      if (res?.server_time) {
        await setMeta(META.clockOffset, new Date(res.server_time).getTime() - Date.now());
      }
    }

    for (const a of acks) {
      const { data, error } = await supabase.rpc("notice_ack", {
        p_token: token,
        p_notice: a.notice_id,
        p_staff: a.staff_id,
      });
      if (!error && (data as { ok?: boolean } | null)?.ok) {
        await db.outbox.delete(a.client_event_id);
        pushed++;
      } else {
        failed++;
        await db.outbox.update(a.client_event_id, { attempts: a.attempts + 1 });
      }
    }

    await setMeta(META.lastSync, new Date().toISOString());
  } catch {
    failed++;
  } finally {
    flushing = false;
  }
  return { pushed, failed };
}

async function uploadQueuedSelfie(
  token: string,
  clientEventId: string,
  eventId?: string
): Promise<void> {
  const db = kioskDb();
  if (!db || !eventId) return;
  const queued = await db.selfies.get(clientEventId);
  if (!queued) return;
  try {
    const site = await cachedSite();
    const supabase = getSupabase();
    const path = `${site?.id ?? "unknown"}/${eventId}.jpg`;
    const { error } = await supabase.storage
      .from(SELFIE_BUCKET)
      .upload(path, queued.blob, { contentType: "image/jpeg", upsert: false });
    if (error && !/already exists/i.test(error.message)) return; // try again next flush
    await supabase.rpc("kiosk_attach_selfie", {
      p_token: token,
      p_event: eventId,
      p_path: path,
    });
    await db.selfies.delete(clientEventId);
  } catch {
    // leave it queued
  }
}

/* ----------------------------------------------------- sync state ------ */

export async function syncState(): Promise<SyncState> {
  const last = (await getMeta<string>(META.lastSync)) ?? null;
  const stale = last
    ? Date.now() - new Date(last).getTime() > STALE_AFTER_DAYS * 86_400_000
    : true;
  return {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    pending: await pendingCount(),
    lastSync: last,
    stale,
    syncing: flushing,
  };
}

/** "3 hours ago" / "Tuesday" — for the stale-cache warning strip. */
export function describeLastSync(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" });
}

/** Remove a locally-queued event: used when the SERVER has answered for it,
 *  so we never push a punch the server already decided on. */
export async function dropQueued(clientEventId: string): Promise<void> {
  await kioskDb()?.outbox.delete(clientEventId);
}
