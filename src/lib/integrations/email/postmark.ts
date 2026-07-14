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
 * Postmark — https://postmarkapp.com/developer/api/email-api
 * Unversioned REST API (api.postmarkapp.com), X-Postmark-Server-Token auth,
 * PascalCase fields, `To` is a comma-separated string. Verified 2026-07-14.
 * Success: 200 { "MessageID": …, "ErrorCode": 0 }. Verify: GET /server.
 */
export function createPostmarkProvider(config: ProviderConfig): EmailProvider {
  const c = requireFields(config, ["serverToken", "fromEmail"], "Postmark");
  const stream = config.messageStream || "outbound";
  const headers = {
    "X-Postmark-Server-Token": c.serverToken,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function post(path: string, body: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch(`https://api.postmarkapp.com${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: providerTimeout(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: describeHttpFailure(res.status, text) };
    const parsed = JSON.parse(text) as { MessageID?: string; ErrorCode?: number; Message?: string };
    if (parsed.ErrorCode) return { ok: false, error: `Postmark error ${parsed.ErrorCode}: ${parsed.Message}` };
    return { ok: true, providerMessageId: parsed.MessageID };
  }

  const toString = (to: string | string[]) => (Array.isArray(to) ? to.join(",") : to);

  return {
    brand: "Postmark",

    send(msg: EmailMessage) {
      return post("/email", {
        From: c.fromEmail,
        To: toString(msg.to),
        Subject: msg.subject,
        ...(msg.html ? { HtmlBody: msg.html } : {}),
        ...(msg.text ? { TextBody: msg.text } : {}),
        ...(msg.replyTo ? { ReplyTo: msg.replyTo } : {}),
        MessageStream: stream,
      });
    },

    sendTemplate(msg: TemplateEmailMessage) {
      return post("/email/withTemplate", {
        From: c.fromEmail,
        To: toString(msg.to),
        TemplateAlias: msg.templateId,
        TemplateModel: msg.variables,
        MessageStream: stream,
      });
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await fetch("https://api.postmarkapp.com/server", {
        headers: { "X-Postmark-Server-Token": c.serverToken, Accept: "application/json" },
        signal: providerTimeout(),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, detail: describeHttpFailure(res.status, text) };
      const name = (JSON.parse(text) as { Name?: string }).Name;
      return { ok: true, detail: `Verified — server "${name ?? "unnamed"}"` };
    },
  };
}
