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
 * ClickSend REST v3 (AU) — https://developers.clicksend.com/docs/rest/v3/
 * Basic auth (username : API key), JSON. Gotcha: HTTP status is always 200 —
 * per-message success lives at data.messages[].status === "SUCCESS".
 * Verify: GET /v3/account. Verified 2026-07-14.
 */
export function createClickSendProvider(config: ProviderConfig): SmsProvider {
  const c = requireFields(config, ["username", "apiKey"], "ClickSend");
  const auth = `Basic ${Buffer.from(`${c.username}:${c.apiKey}`).toString("base64")}`;
  const headers = { Authorization: auth, "Content-Type": "application/json" };

  const normalise = (status: string): DeliveryStatusResult => {
    const map: Record<string, DeliveryStatusResult["status"]> = {
      Queued: "queued", Scheduled: "queued", WaitApproval: "queued",
      Sent: "sent", Completed: "delivered", Received: "delivered",
      Failed: "failed", Cancelled: "failed", CancelledAfterReview: "failed",
    };
    return { status: map[status] ?? "unknown", raw: status };
  };

  return {
    brand: "ClickSend",

    async send(msg: SmsMessage): Promise<SendResult> {
      const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{
            to: msg.to,
            body: msg.body,
            source: "foct-buildingops",
            ...(config.from ? { from: config.from } : {}),
          }],
        }),
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, error: describeHttpFailure(res.status, text) };
      const parsed = JSON.parse(text) as {
        data?: { messages?: Array<{ status?: string; message_id?: string }> };
      };
      const message = parsed.data?.messages?.[0];
      if (message?.status !== "SUCCESS") {
        return { ok: false, error: `ClickSend rejected the message: ${message?.status ?? "unknown status"}` };
      }
      return { ok: true, providerMessageId: message.message_id };
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch("https://rest.clicksend.com/v3/account", {
        headers: { Authorization: auth },
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, text) };
      const parsed = JSON.parse(text) as { response_code?: string };
      if (parsed.response_code !== "SUCCESS") {
        return { ok: false, detail: `ClickSend responded ${parsed.response_code ?? "without SUCCESS"}` };
      }
      return { ok: true, detail: "Verified — ClickSend account reachable" };
    },

    async deliveryStatus(providerMessageId: string): Promise<DeliveryStatusResult> {
      const res = await fetch(
        `https://rest.clicksend.com/v3/sms/receipts/${providerMessageId}`,
        { headers: { Authorization: auth }, signal: providerTimeout() }
      );
      if (!res.ok) return { status: "unknown", raw: `HTTP ${res.status}` };
      const parsed = (await res.json()) as { data?: { status?: string } };
      return normalise(parsed.data?.status ?? "");
    },
  };
}
