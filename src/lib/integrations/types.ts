/**
 * Integrations framework — adapter contracts (CLAUDE.md: Integrations
 * Framework). Feature code NEVER imports a brand implementation; it calls
 * notify() (src/lib/server/notify.ts), which resolves the active provider for
 * the org/building at runtime and dispatches through these interfaces.
 *
 * Implementations are plain fetch() against each provider's REST API — no
 * brand SDKs anywhere in the dependency tree. Provider API versions and doc
 * references are recorded in docs/DECISIONS.md (2026-07-14).
 */

/** Merged credential set handed to a factory: schema `config` fields plus the
 *  Vault-decrypted secret fields. Values are exactly what the admin typed. */
export type ProviderConfig = Record<string, string>;

export interface SendResult {
  ok: boolean;
  /** Provider's own id for the accepted message (recorded in notification_log). */
  providerMessageId?: string;
  /** Human-readable failure detail — safe to surface in the admin UI. */
  error?: string;
}

export interface VerifyResult {
  ok: boolean;
  /** e.g. "Verified — 2 sending domains" or the provider's error message. */
  detail: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface TemplateEmailMessage {
  to: string | string[];
  /** Provider-side template id/alias (Postmark alias, SendGrid d- id, …). */
  templateId: string;
  variables: Record<string, string | number>;
}

export interface EmailProvider {
  readonly brand: string;
  send(msg: EmailMessage): Promise<SendResult>;
  sendTemplate(msg: TemplateEmailMessage): Promise<SendResult>;
  verifyCredentials(): Promise<VerifyResult>;
}

export interface SmsMessage {
  /** E.164 (+61…) destination. */
  to: string;
  body: string;
}

/** Normalised across providers; `raw` keeps the provider's own word. */
export type DeliveryState = "queued" | "sent" | "delivered" | "failed" | "unknown";

export interface DeliveryStatusResult {
  status: DeliveryState;
  raw?: string;
}

export interface SmsProvider {
  readonly brand: string;
  send(msg: SmsMessage): Promise<SendResult>;
  verifyCredentials(): Promise<VerifyResult>;
  deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult>;
}

/** 15s cap on every provider call — a hung integration must never hang a job. */
export const PROVIDER_TIMEOUT_MS = 15_000;

export function providerTimeout(): AbortSignal {
  return AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
}

/** Uniform fetch-error → SendResult/VerifyResult text (never leaks secrets). */
export function describeHttpFailure(status: number, body: string): string {
  const trimmed = body.length > 300 ? `${body.slice(0, 300)}…` : body;
  return `HTTP ${status}: ${trimmed || "no response body"}`;
}

/** Validates the required fields exist and returns them definitely-typed. */
export function requireFields<K extends string>(
  config: ProviderConfig,
  fields: readonly K[],
  brand: string
): Record<K, string> {
  const missing = fields.filter((f) => !config[f]);
  if (missing.length > 0) {
    throw new Error(`${brand}: missing credential field(s) ${missing.join(", ")}`);
  }
  return Object.fromEntries(fields.map((f) => [f, config[f] as string])) as Record<K, string>;
}
