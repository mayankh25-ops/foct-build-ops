"use client";

/**
 * Notices — the admin side (0009).
 *
 * A notice is either GENERAL (everyone at the site, and it scrolls on the
 * kiosk idle screen) or PERSONAL (one employee, shown only to them after they
 * sign in). Its text is a per-language map, so one notice carries English,
 * Hindi and anything else the crew reads.
 *
 * Runs as the signed-in admin under RLS. Falls back to a small demo set when
 * Supabase env is absent so the screen is never a broken shell.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const NOTICES_LIVE = isSupabaseConfigured;

/** BCP-47 → what a cleaner sees on the language chip. */
export const LANGUAGES = [
  { code: "en", label: "English", chip: "EN" },
  { code: "hi", label: "हिन्दी (Hindi)", chip: "हिं" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)", chip: "ਪੰ" },
  { code: "ne", label: "नेपाली (Nepali)", chip: "ने" },
  { code: "zh", label: "简体中文 (Chinese)", chip: "中" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];
export type Translated = Partial<Record<string, string>>;

export type NoticePriority = "info" | "important" | "urgent";

export interface NoticeRow {
  id: string;
  building_id: string;
  staff_id: string | null;
  title: Translated;
  body: Translated;
  priority: NoticePriority;
  starts_on: string;
  ends_on: string | null;
  start_min: number | null;
  end_min: number | null;
  requires_ack: boolean;
  version: number;
  active: boolean;
  created_at: string;
  /** joined for display */
  staff?: { name: string } | null;
}

export interface NoticeInput {
  staffId: string | null;
  title: Translated;
  body: Translated;
  priority: NoticePriority;
  startsOn: string;
  endsOn: string | null;
  startMin: number | null;
  endMin: number | null;
  requiresAck: boolean;
}

/** The languages a notice actually has text in, in LANGUAGES order. */
export function filledLanguages(body: Translated): string[] {
  return LANGUAGES.map((l) => l.code).filter((code) => (body[code] ?? "").trim().length > 0);
}

/** Is this notice showing on the kiosk right now? Mirrors app.notice_is_current. */
export function isCurrent(n: NoticeRow, now = new Date()): boolean {
  if (!n.active) return false;
  const today = now.toISOString().slice(0, 10);
  if (today < n.starts_on) return false;
  if (n.ends_on && today > n.ends_on) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (n.start_min !== null && mins < n.start_min) return false;
  if (n.end_min !== null && mins > n.end_min) return false;
  return true;
}

/* ------------------------------------------------------------- demo ---- */

export const demoNotices: NoticeRow[] = [
  {
    id: "demo-1",
    building_id: "demo",
    staff_id: null,
    title: { en: "Loading dock", hi: "लोडिंग डॉक" },
    body: {
      en: "Loading dock closed until 06:30 — use the Little Collins St entry.",
      hi: "लोडिंग डॉक 06:30 तक बंद है — लिटिल कॉलिन्स स्ट्रीट से आएं।",
    },
    priority: "important",
    starts_on: new Date().toISOString().slice(0, 10),
    ends_on: null,
    start_min: null,
    end_min: null,
    requires_ack: false,
    version: 1,
    active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    building_id: "demo",
    staff_id: "marcus",
    title: { en: "Roster change" },
    body: { en: "See Priya about Thursday's shift before you start." },
    priority: "info",
    starts_on: new Date().toISOString().slice(0, 10),
    ends_on: null,
    start_min: null,
    end_min: null,
    requires_ack: true,
    version: 1,
    active: true,
    created_at: new Date().toISOString(),
    staff: { name: "Marcus Chen" },
  },
];

/* ------------------------------------------------------------- live ---- */

const SELECT = "id,building_id,staff_id,title,body,priority,starts_on,ends_on,start_min,end_min,requires_ack,version,active,created_at,staff(name)";

export async function listNotices(buildingId: string): Promise<NoticeRow[]> {
  const { data, error } = await getSupabase()
    .from("notices")
    .select(SELECT)
    .eq("building_id", buildingId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NoticeRow[];
}

export async function createNotice(
  buildingId: string,
  orgId: string,
  input: NoticeInput
): Promise<void> {
  const { error } = await getSupabase().from("notices").insert({
    building_id: buildingId,
    org_id: orgId,
    staff_id: input.staffId,
    title: input.title,
    body: input.body,
    priority: input.priority,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    start_min: input.startMin,
    end_min: input.endMin,
    requires_ack: input.requiresAck,
  });
  if (error) throw new Error(error.message);
}

export async function updateNotice(id: string, input: NoticeInput): Promise<void> {
  const { error } = await getSupabase()
    .from("notices")
    .update({
      staff_id: input.staffId,
      title: input.title,
      body: input.body,
      priority: input.priority,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      start_min: input.startMin,
      end_min: input.endMin,
      requires_ack: input.requiresAck,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Notices are switched OFF, never deleted — the acknowledgement record and
 *  the history of what people were told are worth keeping. */
export async function setNoticeActive(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabase().from("notices").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface AckRow {
  staff_id: string;
  acked_at: string;
  notice_version: number;
  staff?: { name: string } | null;
}

export async function listAcks(noticeId: string): Promise<AckRow[]> {
  const { data, error } = await getSupabase()
    .from("notice_acks")
    .select("staff_id,acked_at,notice_version,staff(name)")
    .eq("notice_id", noticeId)
    .order("acked_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AckRow[];
}

/* -------------------------------------------------------------- sites -- */

export interface SiteRow {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  default_language: string;
}

export async function listSites(): Promise<SiteRow[]> {
  const { data, error } = await getSupabase()
    .from("buildings")
    .select("id,name,slug,address,timezone,default_language")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteRow[];
}

export async function updateSite(
  id: string,
  patch: Partial<Pick<SiteRow, "name" | "address" | "timezone" | "default_language">>
): Promise<void> {
  const { error } = await getSupabase().from("buildings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export interface NewSiteInput {
  name: string;
  address: string;
  timezone: string;
  language: string;
  /** blank = "my own organisation", which is the ordinary case */
  ownerOrg?: string;
  cleaningOrg?: string;
}

export type SiteResult =
  | { ok: true; buildingId: string; slug: string }
  | { ok: false; error: string };

/**
 * Create a site — building, organisations, cross-org grants, module switches
 * and the caller's own membership, in one transaction (0017).
 *
 * Returns a result rather than throwing: every failure here is something the
 * person at the keyboard can act on ("that isn't a timezone", "ask your
 * admin"), so it belongs in the form, not in a console.
 */
export async function createSite(input: NewSiteInput): Promise<SiteResult> {
  const { data, error } = await getSupabase().rpc("site_create", {
    p_name: input.name,
    p_address: input.address,
    p_timezone: input.timezone,
    p_language: input.language,
    p_owner_org: input.ownerOrg?.trim() || null,
    p_cleaning_org: input.cleaningOrg?.trim() || null,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  const res = data as { ok: boolean; building_id?: string; slug?: string; error?: string };
  if (!res?.ok) return { ok: false, error: res?.error ?? "The site could not be created." };
  return { ok: true, buildingId: res.building_id!, slug: res.slug! };
}

export async function deleteSite(id: string): Promise<SiteResult | { ok: true; slug: string; buildingId: string }> {
  const { data, error } = await getSupabase().rpc("site_delete", { p_building: id });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return { ok: false, error: res?.error ?? "The site could not be removed." };
  return { ok: true, buildingId: id, slug: "" };
}

/**
 * Turn a Postgres/PostgREST error into something a supervisor can act on.
 *
 * The two that matter are the ones that mean "the database is behind the app":
 * a missing function or column reads as gibberish, but it always has the same
 * fix — paste the SQL bundle. Saying so here is the difference between a
 * five-minute fix and an afternoon.
 */
export function friendlyDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("could not find the function") || m.includes("does not exist") || m.includes("42883")) {
    return `${message} — your database is missing part of this release. Open Settings → System health for what to do.`;
  }
  if (m.includes("column") && m.includes("does not exist")) {
    return `${message} — your database is behind the app. Open Settings → System health for what to do.`;
  }
  if (m.includes("jwt") || m.includes("not signed in")) {
    return "Your session has expired. Sign in again.";
  }
  return message;
}

/** Australian zones first — every site is here today. */
export const TIMEZONES = [
  "Australia/Melbourne",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Darwin",
  "Pacific/Auckland",
];
