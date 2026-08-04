import { NextResponse } from "next/server";

import { notify } from "@/lib/server/notify";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET|POST /api/alerts/scan — the scheduled job behind missed check-in alerts.
 *
 * Scans every building, raises what is now true, resolves what no longer is,
 * and emails whatever is still unsent through the org's own active email
 * provider (CLAUDE.md: nothing third-party is hardcoded — this goes through
 * notify(), same as every other send).
 *
 * Runs on a schedule (vercel.json, or any scheduler that can call a URL). It
 * is safe to call as often as you like: the database's unique index is what
 * stops a person being emailed twice, not this route's care.
 *
 * Auth: a shared secret, because a cron caller has no session. Send it as
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends) or
 * `x-cron-secret`. Without CRON_SECRET set, the route refuses outright rather
 * than running unauthenticated.
 */

interface ScanRow {
  building_id: string;
  timezone: string;
  date: string;
  raised: number;
  resolved: number;
  to_send: {
    id: string;
    org_id: string;
    kind: "missed" | "overdue";
    staff_name: string;
    work_date: string;
    due_min: number | null;
    emails: string[];
  }[];
}

const hhmm = (min: number | null): string =>
  min === null ? "" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Same wording as the screen (src/lib/alerts-live.ts) — one fact, one sentence. */
function line(a: ScanRow["to_send"][number]): string {
  if (a.kind === "missed") {
    return a.due_min === null
      ? `${a.staff_name} has not checked in`
      : `${a.staff_name} has not checked in for a ${hhmm(a.due_min)} start`;
  }
  return a.due_min === null
    ? `${a.staff_name} is still signed in`
    : `${a.staff_name} is still signed in — the shift ended at ${hhmm(a.due_min)}`;
}

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}

async function run(req: Request): Promise<NextResponse> {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set — the alert job refuses to run unauthenticated" },
      { status: 501 }
    );
  }
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "not authorised" }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SECRET_KEY is not set — the job cannot reach the database" },
      { status: 501 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("attendance_alerts_scan_all");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  const buildings = ((data as { buildings?: ScanRow[] } | null)?.buildings ?? []) as ScanRow[];
  let raised = 0;
  let resolved = 0;
  let sent = 0;
  let failed = 0;

  for (const b of buildings) {
    raised += b.raised ?? 0;
    resolved += b.resolved ?? 0;
    if (!b.to_send?.length) continue;

    // One email per organisation per scan, not one per person: five missing
    // cleaners is one problem to look at, not five interruptions.
    const byOrg = new Map<string, ScanRow["to_send"]>();
    for (const a of b.to_send) {
      const list = byOrg.get(a.org_id) ?? [];
      list.push(a);
      byOrg.set(a.org_id, list);
    }

    for (const [orgId, alerts] of byOrg) {
      const recipients = [...new Set(alerts.flatMap((a) => a.emails))];
      if (recipients.length === 0) continue;

      const lines = alerts.map(line);
      const subject =
        alerts.length === 1
          ? `Attendance alert — ${lines[0]}`
          : `Attendance alerts — ${alerts.length} at this site`;

      const outcome = await notify({
        channel: "email",
        orgId,
        buildingId: b.building_id,
        to: recipients,
        subject,
        html:
          `<p>${alerts.length === 1 ? "An attendance alert" : `${alerts.length} attendance alerts`} for ${b.date}:</p>` +
          `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` +
          `<p>Open Roster → Today to acknowledge them.</p>`,
        text: `Attendance alerts for ${b.date}:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nOpen Roster → Today to acknowledge.`,
        actorId: null,
      });

      // Stamped only on acceptance: a mail outage must leave a visibly UNSENT
      // alert rather than a silent one.
      await admin.rpc("attendance_alerts_mark_sent", {
        p_ids: alerts.map((a) => a.id),
        p_error: outcome.ok ? null : (outcome.error ?? "send failed"),
      });
      if (outcome.ok) sent += alerts.length;
      else failed += alerts.length;
    }
  }

  return NextResponse.json({
    ok: true,
    buildings: buildings.length,
    raised,
    resolved,
    emailed: sent,
    failed,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  return run(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  return run(req);
}
