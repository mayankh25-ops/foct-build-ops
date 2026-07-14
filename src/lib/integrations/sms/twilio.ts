import {
  describeHttpFailure,
  providerTimeout,
  requireFields,
  type DeliveryStatusResult,
  type ProviderConfig,
  type SendResult,
  type SmsMessage,
  type SmsProvider,
  type VerifyResult,
} from "@/lib/integrations/types";

/**
 * Twilio Programmable Messaging (API version 2010-04-01) —
 * https://www.twilio.com/docs/messaging/api/message-resource
 * Basic auth (AccountSid:AuthToken), form-encoded body (NOT JSON).
 * Success: 201 { "sid": "SM…", "status": "queued" }. Verify: GET the account
 * resource. Verified 2026-07-14.
 */
export function createTwilioProvider(config: ProviderConfig): SmsProvider {
  const c = requireFields(config, ["accountSid", "authToken", "from"], "Twilio");
  const base = `https://api.twilio.com/2010-04-01/Accounts/${c.accountSid}`;
  const auth = `Basic ${Buffer.from(`${c.accountSid}:${c.authToken}`).toString("base64")}`;

  const normalise = (status: string): DeliveryStatusResult => {
    const map: Record<string, DeliveryStatusResult["status"]> = {
      accepted: "queued", scheduled: "queued", queued: "queued", sending: "queued",
      sent: "sent", delivered: "delivered",
      undelivered: "failed", failed: "failed", canceled: "failed",
    };
    return { status: map[status] ?? "unknown", raw: status };
  };

  return {
    brand: "Twilio",

    async send(msg: SmsMessage): Promise<SendResult> {
      const res = await fetch(`${base}/Messages.json`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: msg.to, From: c.from, Body: msg.body }),
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (res.status !== 201) return { ok: false, error: describeHttpFailure(res.status, text) };
      return { ok: true, providerMessageId: (JSON.parse(text) as { sid?: string }).sid };
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch(`${base}.json`, {
        headers: { Authorization: auth },
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, text) };
      const account = JSON.parse(text) as { friendly_name?: string; status?: string };
      return { ok: true, detail: `Verified — account "${account.friendly_name}" (${account.status})` };
    },

    async deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult> {
      const res = await fetch(`${base}/Messages/${providerMessageId}.json`, {
        headers: { Authorization: auth },
        signal: providerTimeout(),
      });
      if (!res.ok) return { status: "unknown", raw: `HTTP ${res.status}` };
      return normalise(((await res.json()) as { status?: string }).status ?? "");
    },
  };
}
