import "server-only";

import { createEmailProvider, createSmsProvider } from "@/lib/integrations/registry";
import type { ProviderConfig, SendResult } from "@/lib/integrations/types";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

/**
 * notify() — the single door the rest of the app walks through to reach the
 * outside world (CLAUDE.md: Integrations Framework). Resolves the ACTIVE
 * credential for the org/building at runtime (building-scoped beats
 * org-wide), decrypts it server-side, dispatches through the adapter
 * registry, and records which provider handled the send in notification_log.
 * Feature code never imports a brand adapter — only this function.
 */

export interface NotifyParams {
  channel: "email" | "sms";
  orgId: string;
  buildingId?: string | null;
  /** Email: address(es). SMS: one E.164 number. */
  to: string | string[];
  /** Email subject (ignored for SMS). */
  subject?: string;
  /** Email HTML body (optional). */
  html?: string;
  /** Plain text — the SMS body, and the email text fallback. */
  text: string;
  /** Marks the send as a test in notification_log. */
  isTest?: boolean;
  /** User who triggered the send, for the log (null for system jobs). */
  actorId?: string | null;
}

export interface NotifyOutcome extends SendResult {
  provider?: string;
  credentialId?: string;
}

interface ActiveCredential {
  id: string;
  provider_id: string;
  config: Record<string, string>;
  slug: string;
  brand: string;
}

/** j.smith@example.com → j•••@e•••.com ; +61412345678 → +61••••••678 */
export function maskRecipient(recipient: string): string {
  const at = recipient.indexOf("@");
  if (at > -1) {
    const user = recipient.slice(0, at);
    const domain = recipient.slice(at + 1);
    const tld = domain.slice(domain.lastIndexOf("."));
    return `${user.slice(0, 1)}•••@${domain.slice(0, 1)}•••${tld}`;
  }
  return `${recipient.slice(0, 3)}${"•".repeat(Math.max(recipient.length - 6, 1))}${recipient.slice(-3)}`;
}

async function resolveActiveCredential(
  channel: "email" | "sms",
  orgId: string,
  buildingId?: string | null
): Promise<ActiveCredential | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("integration_credentials")
    .select("id, provider_id, building_id, config, integration_providers ( slug, brand )")
    .eq("org_id", orgId)
    .eq("category", channel)
    .eq("active", true);
  if (error || !data || data.length === 0) return null;

  // building-scoped credential wins over the org-wide one
  const scoped = buildingId ? data.find((row) => row.building_id === buildingId) : undefined;
  const chosen = scoped ?? data.find((row) => row.building_id === null) ?? data[0];
  if (!chosen) return null;
  const provider = chosen.integration_providers as unknown as { slug: string; brand: string };
  return {
    id: chosen.id as string,
    provider_id: chosen.provider_id as string,
    config: (chosen.config ?? {}) as Record<string, string>,
    slug: provider.slug,
    brand: provider.brand,
  };
}

async function revealSecrets(credentialId: string): Promise<ProviderConfig> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc("integration_secret_reveal", { p_id: credentialId });
  if (error) throw new Error(`vault reveal failed: ${error.message}`);
  return data as ProviderConfig;
}

async function logSend(
  params: NotifyParams,
  outcome: NotifyOutcome,
  credential: ActiveCredential | null
): Promise<void> {
  const admin = getSupabaseAdmin();
  const first = (Array.isArray(params.to) ? params.to[0] : params.to) ?? "";
  await admin.from("notification_log").insert({
    org_id: params.orgId,
    building_id: params.buildingId ?? null,
    channel: params.channel,
    provider_brand: credential?.brand ?? "none",
    credential_id: credential?.id ?? null,
    recipient: maskRecipient(first),
    subject: params.subject ?? null,
    status: outcome.ok ? "sent" : "failed",
    is_test: params.isTest ?? false,
    provider_message_id: outcome.providerMessageId ?? null,
    error: outcome.error ?? null,
    created_by: params.actorId ?? null,
  });
}

export async function notify(params: NotifyParams): Promise<NotifyOutcome> {
  const credential = await resolveActiveCredential(params.channel, params.orgId, params.buildingId);
  if (!credential) {
    const outcome: NotifyOutcome = {
      ok: false,
      error: `no active ${params.channel} provider configured for this organisation`,
    };
    await logSend(params, outcome, null).catch(() => undefined);
    return outcome;
  }

  let outcome: NotifyOutcome;
  try {
    const secrets = await revealSecrets(credential.id);
    const config: ProviderConfig = { ...credential.config, ...secrets };
    if (params.channel === "email") {
      const provider = createEmailProvider(credential.slug, config);
      outcome = await provider.send({
        to: params.to,
        subject: params.subject ?? "",
        html: params.html,
        text: params.text,
      });
    } else {
      const provider = createSmsProvider(credential.slug, config);
      const to = (Array.isArray(params.to) ? params.to[0] : params.to) ?? "";
      outcome = await provider.send({ to, body: params.text });
    }
  } catch (err) {
    outcome = { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }

  outcome.provider = credential.brand;
  outcome.credentialId = credential.id;
  await logSend(params, outcome, credential).catch(() => undefined);
  return outcome;
}
