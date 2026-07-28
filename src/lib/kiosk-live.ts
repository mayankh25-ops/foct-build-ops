"use client";

/**
 * Stage 2 phase 2 — the kiosk's live data layer (the wall tablet / Android APK).
 *
 * The kiosk is NOT a signed-in user. An admin provisions a device in
 * Settings → Cleaners & kiosks, reads out a 6-digit pair code, and the tablet
 * redeems it once for a long-lived device token kept in localStorage. From
 * then on the tablet can call exactly four RPCs (0007) and nothing else:
 * pair, search names, punch, attach selfie. PINs never travel back to the
 * device — it sends one and Postgres answers yes or no.
 *
 * When Supabase env is absent the kiosk stays on its local demo store, so a
 * fresh clone still demonstrates the flow.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const KIOSK_LIVE = isSupabaseConfigured;

const DEVICE_KEY = "foct.kiosk.device.v1";
const SELFIE_BUCKET = "kiosk-selfies";

export interface KioskDevice {
  token: string;
  label: string;
  buildingId: string;
  buildingName: string;
  pairedAt: string;
}

export interface KioskStaff {
  id: string;
  name: string;
}

export interface PunchResult {
  ok: boolean;
  /** the cleaner is already checked in / has no open shift — a soft refusal */
  soft?: boolean;
  staffId?: string;
  staffName?: string;
  eventId?: string;
  error?: string;
  /** the request reached nobody — the caller should fall back to the outbox */
  offline?: boolean;
}

/* ------------------------------------------------ device identity ------- */

export function readDevice(): KioskDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as KioskDevice;
    return d.token && d.buildingId ? d : null;
  } catch {
    return null;
  }
}

function saveDevice(d: KioskDevice): void {
  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(d));
}

export function forgetDevice(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(DEVICE_KEY);
}

/* ------------------------------------------------------- pairing ------- */

export async function pairDevice(
  code: string
): Promise<{ ok: true; device: KioskDevice } | { ok: false; error: string }> {
  const { data, error } = await getSupabase().rpc("kiosk_pair", { p_code: code.trim() });
  if (error) return { ok: false, error: friendly(error.message) };
  const res = data as {
    ok: boolean;
    error?: string;
    device_token?: string;
    device_label?: string;
    building_id?: string;
    building_name?: string;
  } | null;
  if (!res?.ok || !res.device_token) {
    return { ok: false, error: res?.error ?? "Pair code not recognised." };
  }
  const device: KioskDevice = {
    token: res.device_token,
    label: res.device_label ?? "Kiosk",
    buildingId: res.building_id!,
    buildingName: res.building_name ?? "",
    pairedAt: new Date().toISOString(),
  };
  saveDevice(device);
  return { ok: true, device };
}

/* -------------------------------------------------- name search ------- */

export async function searchStaff(token: string, query: string): Promise<KioskStaff[]> {
  const { data, error } = await getSupabase().rpc("kiosk_staff_search", {
    p_token: token,
    p_query: query,
  });
  if (error) return [];
  const res = data as { ok: boolean; staff?: KioskStaff[] } | null;
  return res?.ok ? (res.staff ?? []) : [];
}

/* -------------------------------------------------------- punch ------- */

export async function punch(args: {
  token: string;
  pin: string;
  kind: "in" | "out";
  staffId?: string | null;
  /** idempotency key, so a retry over a bad connection lands once */
  clientEventId?: string | null;
}): Promise<PunchResult> {
  try {
    const { data, error } = await getSupabase().rpc("kiosk_punch", {
      p_token: args.token,
      p_pin: args.pin,
      p_kind: args.kind,
      p_selfie_path: null,
      p_staff_id: args.staffId ?? null,
      p_client_event_id: args.clientEventId ?? null,
    });
    if (error) {
      const offline = /Failed to fetch|NetworkError|timeout/i.test(error.message);
      return { ok: false, offline, error: friendly(error.message) };
    }
    const res = data as {
      ok: boolean;
      already?: boolean;
      no_open_shift?: boolean;
      staff_id?: string;
      staff_name?: string;
      event_id?: string;
      error?: string;
    } | null;
    if (!res) return { ok: false, offline: true, error: "No answer from the server." };
    return {
      ok: res.ok,
      soft: Boolean(res.already || res.no_open_shift),
      staffId: res.staff_id,
      staffName: res.staff_name,
      eventId: res.event_id,
      error: res.error,
    };
  } catch (e) {
    // a thrown fetch is the tablet losing Wi-Fi mid-punch: not an error the
    // cleaner should see, just a reason to record it locally instead
    return { ok: false, offline: true, error: friendly((e as Error).message) };
  }
}

/* ------------------------------------------------- selfie upload ------- */

/**
 * Uploads the 3-2-1 photo and attaches it to the event just recorded. Runs
 * AFTER the punch so the cleaner is told "you're checked in" immediately and
 * never waits on the network for a photo. A failed upload is not an error the
 * cleaner should see: the attendance record already exists without it.
 */
export async function uploadSelfie(args: {
  token: string;
  buildingId: string;
  eventId: string;
  dataUrl: string;
}): Promise<boolean> {
  try {
    const blob = await (await fetch(args.dataUrl)).blob();
    const path = `${args.buildingId}/${args.eventId}.jpg`;
    const supabase = getSupabase();
    const { error } = await supabase.storage
      .from(SELFIE_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) return false;
    const { data } = await supabase.rpc("kiosk_attach_selfie", {
      p_token: args.token,
      p_event: args.eventId,
      p_path: path,
    });
    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------- */

function friendly(message: string): string {
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return "No connection to the office system — check the tablet's Wi‑Fi.";
  }
  if (/Invalid API key/i.test(message)) {
    return "This tablet's configuration is out of date — tell your supervisor.";
  }
  return message;
}

/* --------------------------------------------------- notices online ---- */

/** The notices this person should see right now — general plus their own. */
export async function noticesForStaff(
  token: string,
  staffId: string
): Promise<{ id: string; title?: Record<string, string>; body: Record<string, string>;
             priority: "info" | "important" | "urgent"; personal?: boolean;
             requires_ack?: boolean; acked?: boolean }[]> {
  const { data, error } = await getSupabase().rpc("notices_for_staff", {
    p_token: token,
    p_staff: staffId,
  });
  if (error) return [];
  const res = data as { ok: boolean; notices?: [] } | null;
  return res?.ok ? (res.notices ?? []) : [];
}
