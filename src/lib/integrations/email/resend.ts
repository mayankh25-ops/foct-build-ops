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
 * Resend — https://resend.com/docs/api-reference/emails/send-email
 * Unversioned REST API (api.resend.com), Bearer auth, verified 2026-07-14.
 * Success: 200 { "id": "…" }. Verify: GET /domains (no send).
 */
export function createResendProvider(config: ProviderConfig): EmailProvider {
  const c = requireFields(config, ["apiKey", "fromEmail"], "Resend");
  const from = config.fromName
    ? `${config.fromName} <${c.fromEmail}>`
    : c.fromEmail;
  const headers = {
    Authorization: `Bearer ${c.apiKey}`,
    "Content-Type": "application/json",
  };

  async function post(body: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: providerTimeout(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: describeHttpFailure(res.status, text) };
    const id = (JSON.parse(text) as { id?: string }).id;
    return { ok: true, providerMessageId: id };
  }

  return {
    brand: "Resend",

    send(msg: EmailMessage) {
      return post({
        from,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.text ? { text: msg.text } : {}),
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      });
    },

    sendTemplate(msg: TemplateEmailMessage) {
      return post({
        from,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        template: { id: msg.templateId, variables: msg.variables },
      });
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: headers.Authorization },
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, text) };
      const count = (JSON.parse(text) as { data?: unknown[] }).data?.length ?? 0;
      return { ok: true, detail: `Verified — ${count} sending domain${count === 1 ? "" : "s"}` };
    },
  };
}
