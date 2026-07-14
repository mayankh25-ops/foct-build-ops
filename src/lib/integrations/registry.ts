import { createPostmarkProvider } from "@/lib/integrations/email/postmark";
import { createResendProvider } from "@/lib/integrations/email/resend";
import { createSendGridProvider } from "@/lib/integrations/email/sendgrid";
import { createSesProvider } from "@/lib/integrations/email/ses";
import { createClickSendProvider } from "@/lib/integrations/sms/clicksend";
import { createMessageMediaProvider } from "@/lib/integrations/sms/messagemedia";
import { createTwilioProvider } from "@/lib/integrations/sms/twilio";
import type { EmailProvider, ProviderConfig, SmsProvider } from "@/lib/integrations/types";

/**
 * Adapter registry — catalogue slug (integration_providers.slug) → factory.
 * The ONLY place brand implementations are referenced. Server-side only:
 * factories receive decrypted secrets, so this module must never reach the
 * client bundle (notify.ts and the API routes are its only importers).
 */

const EMAIL_FACTORIES: Record<string, (config: ProviderConfig) => EmailProvider> = {
  resend: createResendProvider,
  postmark: createPostmarkProvider,
  sendgrid: createSendGridProvider,
  "aws-ses": createSesProvider,
};

const SMS_FACTORIES: Record<string, (config: ProviderConfig) => SmsProvider> = {
  twilio: createTwilioProvider,
  messagemedia: createMessageMediaProvider,
  clicksend: createClickSendProvider,
};

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("integrations registry is server-only — it handles decrypted credentials");
  }
}

export function createEmailProvider(slug: string, config: ProviderConfig): EmailProvider {
  assertServer();
  const factory = EMAIL_FACTORIES[slug];
  if (!factory) throw new Error(`no email adapter registered for provider "${slug}"`);
  return factory(config);
}

export function createSmsProvider(slug: string, config: ProviderConfig): SmsProvider {
  assertServer();
  const factory = SMS_FACTORIES[slug];
  if (!factory) throw new Error(`no SMS adapter registered for provider "${slug}"`);
  return factory(config);
}

export const REGISTERED_SLUGS = {
  email: Object.keys(EMAIL_FACTORIES),
  sms: Object.keys(SMS_FACTORIES),
} as const;
