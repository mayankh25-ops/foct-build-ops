import { NextResponse } from "next/server";

/**
 * Door soft-trigger proxy. Browsers can't call LAN door controllers
 * directly (CORS/mixed-content), so the dashboard posts here and the
 * server fires the configured trigger URL.
 *
 * SAFE BY DEFAULT:
 *  - does nothing unless SECURITY_TRIGGERS_ENABLED=1 is set on the
 *    machine running the app (the concierge PC);
 *  - only ever calls PRIVATE-network hosts (localhost / RFC1918 /
 *    .local) — this is a LAN actuator, not a general proxy;
 *  - 3-second timeout, response body discarded.
 * Stage 2 adds real authz: the route will require a session whose role
 * passes can('security','doors','trigger'), and every call lands in
 * audit_logs.
 */

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/i;

export async function POST(req: Request) {
  if (process.env.SECURITY_TRIGGERS_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, reason: "Triggers disabled — set SECURITY_TRIGGERS_ENABLED=1 on this machine." },
      { status: 403 }
    );
  }

  let url: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body.url !== "string") throw new Error("missing url");
    url = body.url;
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad request." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid trigger URL." }, { status: 400 });
  }
  if (!/^https?:$/.test(parsed.protocol) || !PRIVATE_HOST.test(parsed.hostname)) {
    return NextResponse.json(
      { ok: false, reason: "Trigger URLs must point at a private-network device." },
      { status: 400 }
    );
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(parsed.toString(), { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Device did not respond within 3 seconds." },
      { status: 502 }
    );
  }
}
