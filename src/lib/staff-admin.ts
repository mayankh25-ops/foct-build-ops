"use client";

/**
 * Stage 2 phase 2 — the admin side of attendance: who creates cleaners and
 * kiosks, and how a PIN gets issued.
 *
 * Everything here runs as the SIGNED-IN admin against 0007, so RLS decides
 * what they can see and `app.manages_staff_at()` decides what they can change
 * — the cleaning company manages its own people at every building it services,
 * the owner org manages its own.
 *
 * Without Supabase env the screen runs in demo mode against the seeded
 * directory: names and PINs are shown, but nothing can be created, because a
 * demo PIN is not a credential anyone should rely on.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { staffDirectory } from "@/lib/attendance-store";

export const STAFF_LIVE = isSupabaseConfigured;

export interface StaffRow {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
}

export interface DeviceRow {
  id: string;
  label: string;
  pair_code: string | null;
  pair_expires: string | null;
  paired_at: string | null;
  last_seen: string | null;
  active: boolean;
}

export interface AttendanceSession {
  staff_id: string;
  staff_name: string;
  role: string;
  work_date: string;
  in_at: string;
  out_at: string | null;
  minutes: number | null;
  in_selfie: string | null;
  out_selfie: string | null;
  source: string;
  device_id: string | null;
}

/** Demo rows so the screen is never empty before the SQL is applied. */
export const demoStaff: StaffRow[] = staffDirectory.map((s) => ({
  id: s.id,
  name: s.name,
  role: s.role,
  active: true,
  created_at: "",
}));

export const demoDevices: DeviceRow[] = [
  {
    id: "demo-kiosk",
    label: "Cleaners room iPad",
    pair_code: null,
    pair_expires: null,
    paired_at: new Date(Date.now() - 86_400_000 * 12).toISOString(),
    last_seen: new Date(Date.now() - 1_800_000).toISOString(),
    active: true,
  },
];

/* --------------------------------------------------------- cleaners ---- */

export async function listStaff(buildingId: string): Promise<StaffRow[]> {
  const { data, error } = await getSupabase()
    .from("staff")
    .select("id,name,role,active,created_at")
    .eq("building_id", buildingId)
    .order("active", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffRow[];
}

/** Returns the generated PIN — shown ONCE, never retrievable afterwards. */
export async function createStaff(
  buildingId: string,
  name: string,
  role: string
): Promise<{ staffId: string; pin: string }> {
  const { data, error } = await getSupabase().rpc("staff_create", {
    p_building: buildingId,
    p_name: name,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  const res = data as { ok: boolean; staff_id: string; pin: string };
  return { staffId: res.staff_id, pin: res.pin };
}

export async function resetPin(staffId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("staff_reset_pin", { p_staff: staffId });
  if (error) throw new Error(error.message);
  return (data as { pin: string }).pin;
}

export async function setStaffActive(staffId: string, active: boolean): Promise<void> {
  const { error } = await getSupabase().from("staff").update({ active }).eq("id", staffId);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------ kiosk devices -- */

export async function listDevices(buildingId: string): Promise<DeviceRow[]> {
  const { data, error } = await getSupabase()
    .from("kiosk_devices")
    .select("id,label,pair_code,pair_expires,paired_at,last_seen,active")
    .eq("building_id", buildingId)
    .order("active", { ascending: false })
    .order("label");
  if (error) throw new Error(error.message);
  return (data ?? []) as DeviceRow[];
}

export async function createDevice(
  buildingId: string,
  label: string
): Promise<{ deviceId: string; pairCode: string }> {
  const { data, error } = await getSupabase().rpc("kiosk_device_create", {
    p_building: buildingId,
    p_label: label,
  });
  if (error) throw new Error(error.message);
  const res = data as { device_id: string; pair_code: string };
  return { deviceId: res.device_id, pairCode: res.pair_code };
}

/** Re-issue a code (device replaced, or the old code expired). Unpairs it. */
export async function reissuePairCode(deviceId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc("kiosk_issue_pair_code", {
    p_device: deviceId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Retire a lost or stolen tablet: the token stops working immediately. */
export async function retireDevice(deviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("kiosk_devices")
    .update({ active: false, device_token: null, pair_code: null })
    .eq("id", deviceId);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------- timesheets -- */

export async function listSessions(
  buildingId: string,
  from: string,
  to: string
): Promise<AttendanceSession[]> {
  const { data, error } = await getSupabase().rpc("attendance_sessions", {
    p_building: buildingId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error(error.message);
  const res = data as { ok: boolean; sessions?: AttendanceSession[] } | null;
  return res?.sessions ?? [];
}

/** Signed URL for a stored selfie (private bucket, 60s). */
export async function selfieUrl(path: string): Promise<string | null> {
  const { data } = await getSupabase().storage.from("kiosk-selfies").createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}
