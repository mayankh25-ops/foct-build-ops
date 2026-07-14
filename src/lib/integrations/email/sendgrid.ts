import {
  describeHttpFailure,
  providerTimeout,
  requireFields,
  type EmailMessage,
  type EmailProvider,
  type ProviderConfig,
  type SendResult,
  type TemplateEmailMessage,
  type VerifyResult,
} from "@/lib/integrations/types";

/**
 * Twilio SendGrid v3 — https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
 * Bearer auth. Success: 202 with an EMPTY body — the message id comes back in
 * the X-Message-Id response header. Verify: GET /v3/scopes (also proves the
 * key holds mail.send). Verified 2026-07-14.
 */
export function createSendGridProvider(config: ProviderConfig): EmailProvider {
  const c = requireFields(config, ["apiKey", "fromEmail"], "SendGrid");
  const headers = {
    Authorization: `Bearer ${c.apiKey}`,
    "Content-Type": "application/json",
  };
  const from = { email: c.fromEmail, ...(config.fromName ? { name: config.fromName } : {}) };
  const toList = (to: string | string[]) =>
    (Array.isArray(to) ? to : [to]).map((email) => ({ email }));

  async function post(body: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: providerTimeout(),
    });
    if (!res.ok) {
      return { ok: false, error: describeHttpFailure(res.status, await res.text()) };
    }
    return { ok: true, providerMessageId: res.headers.get("x-message-id") ?? undefined };
  }

  return {
    brand: "SendGrid",

    send(msg: EmailMessage) {
      const content = [
        ...(msg.text ? [{ type: "text/plain", value: msg.text }] : []),
        ...(msg.html ? [{ type: "text/html", value: msg.html }] : []),
      ];
      return post({
        personalizations: [{ to: toList(msg.to) }],
        from,
        subject: msg.subject,
        content: content.length > 0 ? content : [{ type: "text/plain", value: "" }],
        ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
      });
    },

    sendTemplate(msg: TemplateEmailMessage) {
      return post({
        personalizations: [{ to: toList(msg.to), dynamic_template_data: msg.variables }],
        from,
        template_id: msg.templateId,
      });
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: headers.Authorization },
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, text) };
      const scopes = (JSON.parse(text) as { scopes?: string[] }).scopes ?? [];
      if (!scopes.includes("mail.send")) {
        return { ok: false, detail: "Key is valid but is MISSING the mail.send scope" };
      }
      return { ok: true, detail: `Verified — key holds mail.send (${scopes.length} scopes)` };
    },
  };
}
