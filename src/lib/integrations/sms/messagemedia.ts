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
 * Sinch MessageMedia Messages API v1 (AU) —
 * https://messagemedia.github.io/documentation/
 * Basic auth (API key : API secret), JSON snake_case. Success: 202 with
 * messages[0].message_id + status "queued". delivery_report:true is required
 * to ever see "delivered". Verify: GET /v1/delivery_reports (side-effect
 * free). Verified 2026-07-14.
 */
export function createMessageMediaProvider(config: ProviderConfig): SmsProvider {
  const c = requireFields(config, ["apiKey", "apiSecret"], "MessageMedia");
  const auth = `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString("base64")}`;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  const normalise = (status: string): DeliveryStatusResult => {
    const map: Record<string, DeliveryStatusResult["status"]> = {
      queued: "queued", processed: "queued", scheduled: "queued",
      enroute: "sent", submitted: "sent",
      delivered: "delivered",
      expired: "failed", rejected: "failed", undeliverable: "failed",
      cancelled: "failed", failed: "failed",
    };
    return { status: map[status] ?? "unknown", raw: status };
  };

  return {
    brand: "MessageMedia",

    async send(msg: SmsMessage): Promise<SendResult> {
      const res = await fetch("https://api.messagemedia.com/v1/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{
            content: msg.body,
            destination_number: msg.to,
            delivery_report: true,
            ...(config.from
              ? { source_number: config.from, source_number_type: /^\+?\d+$/.test(config.from) ? "INTERNATIONAL" : "ALPHANUMERIC" }
              : {}),
          }],
        }),
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (res.status !== 202) return { ok: false, error: describeHttpFailure(res.status, text) };
      const parsed = JSON.parse(text) as { messages?: Array<{ message_id?: string }> };
      return { ok: true, providerMessageId: parsed.messages?.[0]?.message_id };
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch("https://api.messagemedia.com/v1/delivery_reports", {
        headers: { Authorization: auth },
        signal: providerTimeout(),
      });
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, await res.text()) };
      return { ok: true, detail: "Verified — MessageMedia API reachable with these keys" };
    },

    async deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult> {
      const res = await fetch(`https://api.messagemedia.com/v1/messages/${providerMessageId}`, {
        headers: { Authorization: auth },
        signal: providerTimeout(),
      });
      if (!res.ok) return { status: "unknown", raw: `HTTP ${res.status}` };
      return normalise(((await res.json()) as { status?: string }).status ?? "");
    },
  };
}
