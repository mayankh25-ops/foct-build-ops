"use client";

/**
 * Service Desk live data layer (Stage 3). Maps sd_* rows to the exact shapes
 * the screens already consume (SdTicketLive), so flipping to live data touches
 * zero UI. Activated by NEXT_PUBLIC_SD_LIVE=1 + a signed-in session (reads and
 * mutations run under RLS); the public intake RPC works without a session.
 * NOTE: this build environment cannot reach *.supabase.co — smoke-test on a
 * machine with network access (owner's laptop / Vercel preview).
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SdEvent, SdPriority, SdStatus, SdTicket } from "@/lib/service-desk-data";
import type { NewTicketInput, SdTicketLive } from "@/lib/service-desk-store";

export const SD_LIVE_FLAG = process.env.NEXT_PUBLIC_SD_LIVE === "1" && isSupabaseConfigured;
export const INTAKE_TOKEN = process.env.NEXT_PUBLIC_SD_INTAKE_TOKEN ?? "aurora-demo-intake-7f2k";

const statusFromDb: Record<string, SdStatus> = {
  new: "new",
  open: "open",
  in_progress: "in-progress",
  resolved: "resolved",
  closed: "closed",
  reopened: "reopened",
};
// kept for the write path that lands with live mutations (Stage 4)
const _statusToDb = (s: SdStatus) => s.replace("-", "_");

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
  return today ? `Today ${t}` : `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ${t}`;
}

interface TicketRow {
  id: string;
  ref: string;
  status: string;
  priority: SdPriority;
  category_label: string;
  description: string;
  lodged_by_name: string;
  assigned_name: string | null;
  csat: "up" | "down" | null;
  pdf_path: string | null;
  created_at: string;
  sd_ticket_locations: { level: string; area_text: string | null; sort_order: number }[];
  sd_ticket_photos: { kind: "before" | "after"; data_url: string | null }[];
  sd_ticket_events: { kind: SdEvent["kind"]; actor_name: string; body: string; internal: boolean; created_at: string }[];
  sd_ticket_followers: { email: string }[];
}

function mapTicket(r: TicketRow): SdTicketLive {
  const before = r.sd_ticket_photos.filter((p) => p.kind === "before");
  const after = r.sd_ticket_photos.filter((p) => p.kind === "after");
  const status = statusFromDb[r.status] ?? "new";
  return {
    ref: r.ref,
    category: r.category_label as SdTicket["category"],
    locations: [...r.sd_ticket_locations]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((l) => ({ level: l.level, area: l.area_text ?? undefined })),
    description: r.description,
    priority: r.priority,
    status,
    lodgedBy: r.lodged_by_name,
    assignee: r.assigned_name ?? undefined,
    followers: r.sd_ticket_followers.map((f) => f.email),
    createdAt: fmtWhen(r.created_at),
    sla:
      status === "resolved" || status === "closed"
        ? { state: "met", toAttend: "—", toResolve: "met" }
        : { state: "running", remaining: "live SLA timers land with Inngest" },
    photosBefore: before.length,
    photosAfter: after.length,
    photoUrlsBefore: before.map((p) => p.data_url).filter((u): u is string => !!u),
    photoUrlsAfter: after.map((p) => p.data_url).filter((u): u is string => !!u),
    csat: r.csat ?? undefined,
    pdf: r.pdf_path ?? undefined,
    events: [...r.sd_ticket_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({
        at: fmtWhen(e.created_at),
        who: e.actor_name,
        what: e.body,
        internal: e.internal || undefined,
        kind: e.kind,
      })),
  };
}

const TICKET_SELECT =
  "id, ref, status, priority, category_label, description, lodged_by_name, assigned_name, csat, pdf_path, created_at," +
  " sd_ticket_locations(level, area_text, sort_order)," +
  " sd_ticket_photos(kind, data_url)," +
  " sd_ticket_events(kind, actor_name, body, internal, created_at)," +
  " sd_ticket_followers(email)";

export async function fetchLiveTickets(): Promise<SdTicketLive[]> {
  const { data, error } = await getSupabase()
    .from("sd_tickets")
    .select(TICKET_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as TicketRow[]).map(mapTicket);
}

/** Public intake — works signed-out; the token scopes it to the building. */
export async function lodgeViaIntake(input: NewTicketInput): Promise<string> {
  const { data, error } = await getSupabase().rpc("sd_lodge_ticket", {
    p_token: INTAKE_TOKEN,
    p_payload: {
      lodgedBy: input.lodgedBy,
      categoryLabel: input.category,
      description: input.description,
      priority: input.priority,
      locations: input.locations,
      followers: input.followers,
      photos: input.photoUrls,
    },
  });
  if (error) throw error;
  return (data as { ticket_ref: string }[])[0]!.ticket_ref;
}

async function byRef(ref: string): Promise<string> {
  const { data, error } = await getSupabase().from("sd_tickets").select("id").eq("ref", ref).single();
  if (error) throw error;
  return (data as { id: string }).id;
}

async function addEvent(ticketId: string, kind: SdEvent["kind"], actor: string, body: string, internal = false) {
  const { error } = await getSupabase()
    .from("sd_ticket_events")
    .insert({ ticket_id: ticketId, kind, actor_name: actor, body, internal });
  if (error) throw error;
}

/** Mutation mirrors — same vocabulary as the local store's actions. */
export const sdLive = {
  async assign(ref: string, cleaner: string) {
    const id = await byRef(ref);
    const { error } = await getSupabase()
      .from("sd_tickets")
      .update({ assigned_name: cleaner, status: "open" })
      .eq("id", id);
    if (error) throw error;
    await addEvent(id, "status", "Priya Sharma", `Assigned ${cleaner}`);
  },
  async attend(ref: string, by: string) {
    const id = await byRef(ref);
    const { error } = await getSupabase()
      .from("sd_tickets")
      .update({ status: "in_progress", assigned_name: by, attended_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await addEvent(id, "status", by, "Attending — status In progress");
  },
  async close(ref: string, args: { by: string; note?: string; photoUrls: string[] }) {
    const id = await byRef(ref);
    const photos = args.photoUrls.map((u) => ({ ticket_id: id, kind: "after", data_url: u, uploaded_by: args.by }));
    const { error: pErr } = await getSupabase().from("sd_ticket_photos").insert(photos);
    if (pErr) throw pErr;
    const { error } = await getSupabase()
      .from("sd_tickets")
      .update({ status: "resolved", assigned_name: args.by, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await addEvent(id, "photo", args.by, `After photos uploaded · ${args.photoUrls.length}${args.note ? ` — ${args.note}` : ""}`);
    await addEvent(id, "status", args.by, "Resolved — closure notifications queued");
  },
  async reopen(ref: string, by: string) {
    const id = await byRef(ref);
    const { error } = await getSupabase().from("sd_tickets").update({ status: "reopened", csat: null }).eq("id", id);
    if (error) throw error;
    await addEvent(id, "status", by, "Reopened — issue not fixed");
  },
  async addInternalNote(ref: string, by: string, text: string) {
    await addEvent(await byRef(ref), "note", by, text, true);
  },
  async addFollower(ref: string, email: string) {
    const id = await byRef(ref);
    const { error } = await getSupabase().from("sd_ticket_followers").insert({ ticket_id: id, email });
    if (error && !`${error.message}`.includes("duplicate")) throw error;
  },
  async removeFollower(ref: string, email: string) {
    const id = await byRef(ref);
    await getSupabase().from("sd_ticket_followers").delete().eq("ticket_id", id).eq("email", email);
  },
  async setCsat(ref: string, rating: "up" | "down") {
    const id = await byRef(ref);
    const { error } = await getSupabase().from("sd_tickets").update({ csat: rating }).eq("id", id);
    if (error) throw error;
    await addEvent(id, "csat", "Lodger", `Rated the fix ${rating === "up" ? "👍" : "👎"}`);
  },
};
