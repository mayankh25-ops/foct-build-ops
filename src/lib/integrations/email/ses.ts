import { signV4 } from "@/lib/integrations/email/sigv4";
import {
  describeHttpFailure,
  providerTimeout,
  requireFields,
  type EmailMessage,
  type EmailProvider,
  type ProviderConfig,
  type SendResult,
  type VerifyResult,
} from "@/lib/integrations/types";

/**
 * AWS SES v2 (API version 2019-09-27) —
 * https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
 * SigV4-signed JSON over email.{region}.amazonaws.com; signing service name
 * is "ses". Success: 200 { "MessageId": … }. Verify: GET /v2/email/account
 * (also reveals sandbox status). Verified 2026-07-14.
 *
 * sendTemplate is deliberately unsupported here — the catalogue advertises
 * SES capabilities as ["send","verifyCredentials"] (seed + 0005).
 */
export function createSesProvider(config: ProviderConfig): EmailProvider {
  const c = requireFields(config, ["accessKeyId", "secretAccessKey", "region", "fromEmail"], "AWS SES");
  const host = `email.${c.region}.amazonaws.com`;

  async function call(
    method: "GET" | "POST",
    path: string,
    body: string
  ): Promise<{ status: number; text: string }> {
    const headers = signV4({
      method,
      host,
      path,
      region: c.region,
      service: "ses",
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      body,
    });
    const res = await fetch(`https://${host}${path}`, {
      method,
      headers,
      ...(method === "POST" ? { body } : {}),
      signal: providerTimeout(),
    });
    return { status: res.status, text: await res.text() };
  }

  return {
    brand: "AWS SES",

    async send(msg: EmailMessage): Promise<SendResult> {
      const body = JSON.stringify({
        FromEmailAddress: c.fromEmail,
        Destination: { ToAddresses: Array.isArray(msg.to) ? msg.to : [msg.to] },
        ...(msg.replyTo ? { ReplyToAddresses: [msg.replyTo] } : {}),
        Content: {
          Simple: {
            Subject: { Data: msg.subject, Charset: "UTF-8" },
            Body: {
              ...(msg.html ? { Html: { Data: msg.html, Charset: "UTF-8" } } : {}),
              ...(msg.text ? { Text: { Data: msg.text, Charset: "UTF-8" } } : {}),
            },
          },
        },
      });
      const res = await call("POST", "/v2/email/outbound-emails", body);
      if (res.status !== 200) return { ok: false, error: describeHttpFailure(res.status, res.text) };
      return { ok: true, providerMessageId: (JSON.parse(res.text) as { MessageId?: string }).MessageId };
    },

    async sendTemplate(): Promise<SendResult> {
      return { ok: false, error: "AWS SES adapter does not support template sends (see catalogue capabilities)" };
    },

    async verifyCredentials(): Promise<VerifyResult> {
      const res = await call("GET", "/v2/email/account", "");
      if (res.status !== 200) return { ok: false, detail: describeHttpFailure(res.status, res.text) };
      const account = JSON.parse(res.text) as {
        ProductionAccessEnabled?: boolean;
        SendingEnabled?: boolean;
      };
      if (account.SendingEnabled === false) {
        return { ok: false, detail: "Credentials valid but SES sending is DISABLED on this account" };
      }
      return {
        ok: true,
        detail: account.ProductionAccessEnabled
          ? "Verified — production access enabled"
          : "Verified — note: account is in the SES SANDBOX (verified recipients only)",
      };
    },
  };
}
