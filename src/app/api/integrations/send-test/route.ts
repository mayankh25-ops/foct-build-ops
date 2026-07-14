import { NextResponse } from "next/server";

import { notify } from "@/lib/server/notify";
import { callerIsOrgAdmin, isRouteAuthConfigured, resolveCaller } from "@/lib/server/route-auth";
import { isAdminConfigured } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/integrations/send-test — fires a REAL test email or SMS through
 * whatever provider is active for the org/building. Body:
 *   { orgId, buildingId?, channel: "email"|"sms", to }
 * The send is recorded in notification_log with is_test = true.
 */

interface SendTestBody {
  orgId?: string;
  buildingId?: string | null;
  channel?: "email" | "sms";
  to?: string;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isRouteAuthConfigured() || !isAdminConfigured) {
    return NextResponse.json(
      { ok: false, error: "Supabase server env not configured (SUPABASE_SECRET_KEY) — live sends unavailable" },
      { status: 501 }
    );
  }
  const caller = await resolveCaller(req);
  if (!caller) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  const body = (await req.json()) as SendTestBody;
  if (!body.orgId || !body.channel || !body.to) {
    return NextResponse.json({ ok: false, error: "orgId, channel and to are required" }, { status: 400 });
  }
  if (!(await callerIsOrgAdmin(caller, body.orgId))) {
    return NextResponse.json({ ok: false, error: "not an organisation admin" }, { status: 403 });
  }

  const stamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" });
  const outcome = await notify({
    channel: body.channel,
    orgId: body.orgId,
    buildingId: body.buildingId ?? null,
    to: body.to,
    subject: "FOCT BuildingOps — test email",
    html:
      `<p>This is a <strong>test email</strong> from FOCT BuildingOps.</p>` +
      `<p>Sent ${stamp} (Melbourne) via your active email provider. ` +
      `If you're reading this, the integration works.</p>`,
    text: `FOCT BuildingOps test message — sent ${stamp} via your active provider. If you're reading this, the integration works.`,
    isTest: true,
    actorId: caller.userId,
  });

  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 502 });
}
