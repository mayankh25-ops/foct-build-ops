import { NextResponse } from "next/server";

import { createEmailProvider, createSmsProvider, REGISTERED_SLUGS } from "@/lib/integrations/registry";
import type { ProviderConfig, VerifyResult } from "@/lib/integrations/types";
import { callerIsOrgAdmin, isRouteAuthConfigured, resolveCaller } from "@/lib/server/route-auth";
import { getSupabaseAdmin, isAdminConfigured } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

/**
 * POST /api/integrations/test — "Test connection" for the admin GUI.
 * Two modes:
 *   { orgId, slug, config }      — PRE-SAVE: form values (incl. secrets) are
 *                                  tested transiently and never persisted.
 *   { orgId, credentialId }      — SAVED: secrets come from the Vault
 *                                  (service_role reveal); the result is
 *                                  stamped via integration_credential_record_test.
 * Caller must be an org admin (verified against the database, not the client).
 */

interface TestBody {
  orgId?: string;
  slug?: string;
  config?: ProviderConfig;
  credentialId?: string;
}

function verifyFor(slug: string, config: ProviderConfig): Promise<VerifyResult> {
  if ((REGISTERED_SLUGS.email as readonly string[]).includes(slug)) {
    return createEmailProvider(slug, config).verifyCredentials();
  }
  if ((REGISTERED_SLUGS.sms as readonly string[]).includes(slug)) {
    return createSmsProvider(slug, config).verifyCredentials();
  }
  throw new Error(`unknown provider slug "${slug}"`);
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isRouteAuthConfigured() || !isAdminConfigured) {
    return NextResponse.json(
      { ok: false, detail: "Supabase server env not configured (SUPABASE_SECRET_KEY) — live tests unavailable" },
      { status: 501 }
    );
  }
  const caller = await resolveCaller(req);
  if (!caller) return NextResponse.json({ ok: false, detail: "not signed in" }, { status: 401 });

  const body = (await req.json()) as TestBody;
  if (!body.orgId) return NextResponse.json({ ok: false, detail: "orgId required" }, { status: 400 });
  if (!(await callerIsOrgAdmin(caller, body.orgId))) {
    return NextResponse.json({ ok: false, detail: "not an organisation admin" }, { status: 403 });
  }

  try {
    let result: VerifyResult;

    if (body.credentialId) {
      const admin = getSupabaseAdmin();
      const { data: cred, error } = await admin
        .from("integration_credentials")
        .select("id, org_id, config, integration_providers ( slug )")
        .eq("id", body.credentialId)
        .single();
      if (error || !cred || cred.org_id !== body.orgId) {
        return NextResponse.json({ ok: false, detail: "credential not found" }, { status: 404 });
      }
      const { data: secrets, error: revealError } = await admin.rpc("integration_secret_reveal", {
        p_id: body.credentialId,
      });
      if (revealError) throw new Error(revealError.message);
      const slug = (cred.integration_providers as unknown as { slug: string }).slug;
      result = await verifyFor(slug, {
        ...((cred.config ?? {}) as ProviderConfig),
        ...(secrets as ProviderConfig),
      });
      await admin.rpc("integration_credential_record_test", {
        p_id: body.credentialId,
        p_ok: result.ok,
        p_note: result.detail,
      });
    } else if (body.slug && body.config) {
      result = await verifyFor(body.slug, body.config);
    } else {
      return NextResponse.json(
        { ok: false, detail: "provide either credentialId or slug + config" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "test failed";
    return NextResponse.json({ ok: false, detail }, { status: 200 });
  }
}
