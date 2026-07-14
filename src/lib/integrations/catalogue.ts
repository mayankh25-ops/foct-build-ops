/**
 * Client-safe mirror of the integration_providers catalogue seeded by
 * supabase/migrations/0005_integrations_framework.sql. KEEP THE TWO IN SYNC —
 * the migration is the authority; this copy powers the admin GUI in local
 * demo mode and typed access to schema extensions everywhere. Contains no
 * secrets (it is literally the shape of the credential FORM, not its values).
 */

export type IntegrationCategory = "email" | "sms";

export interface SchemaField {
  type: "string";
  title: string;
  description?: string;
  pattern?: string;
  format?: "email";
  enum?: string[];
  default?: string;
  /** true → stored in Supabase Vault, rendered as a password field, never returned after save. */
  "x-secret"?: boolean;
}

export interface ProviderConfigSchema {
  title: string;
  type: "object";
  required: string[];
  "x-field-order": string[];
  /** Field whose last 4 characters become the masked display string. */
  "x-mask": string;
  properties: Record<string, SchemaField>;
}

export interface CatalogueProvider {
  slug: string;
  brand: string;
  category: IntegrationCategory;
  capabilities: string[];
  docsUrl: string;
  configSchema: ProviderConfigSchema;
}

export const CATALOGUE: CatalogueProvider[] = [
  {
    slug: "resend",
    brand: "Resend",
    category: "email",
    capabilities: ["send", "sendTemplate", "verifyCredentials"],
    docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
    configSchema: {
      title: "Resend",
      type: "object",
      required: ["apiKey", "fromEmail"],
      "x-field-order": ["apiKey", "fromEmail", "fromName"],
      "x-mask": "apiKey",
      properties: {
        apiKey: {
          type: "string",
          title: "API key",
          pattern: "^re_",
          description: "Starts with re_ — Resend dashboard, API Keys.",
          "x-secret": true,
        },
        fromEmail: {
          type: "string",
          title: "From address",
          format: "email",
          description: "Must belong to a domain verified in Resend.",
        },
        fromName: { type: "string", title: "From name" },
      },
    },
  },
  {
    slug: "postmark",
    brand: "Postmark",
    category: "email",
    capabilities: ["send", "sendTemplate", "verifyCredentials"],
    docsUrl: "https://postmarkapp.com/developer/api/email-api",
    configSchema: {
      title: "Postmark",
      type: "object",
      required: ["serverToken", "fromEmail"],
      "x-field-order": ["serverToken", "fromEmail", "messageStream"],
      "x-mask": "serverToken",
      properties: {
        serverToken: {
          type: "string",
          title: "Server API token",
          description: "Postmark server → API Tokens.",
          "x-secret": true,
        },
        fromEmail: {
          type: "string",
          title: "From address",
          format: "email",
          description: "A confirmed Sender Signature or verified domain.",
        },
        messageStream: {
          type: "string",
          title: "Message stream",
          default: "outbound",
          description: "Transactional stream id (default: outbound).",
        },
      },
    },
  },
  {
    slug: "sendgrid",
    brand: "SendGrid",
    category: "email",
    capabilities: ["send", "sendTemplate", "verifyCredentials"],
    docsUrl: "https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send",
    configSchema: {
      title: "SendGrid",
      type: "object",
      required: ["apiKey", "fromEmail"],
      "x-field-order": ["apiKey", "fromEmail", "fromName"],
      "x-mask": "apiKey",
      properties: {
        apiKey: {
          type: "string",
          title: "API key",
          pattern: "^SG\\.",
          description: "Starts with SG. — needs the mail.send scope.",
          "x-secret": true,
        },
        fromEmail: {
          type: "string",
          title: "From address",
          format: "email",
          description: "A verified sender identity or authenticated domain.",
        },
        fromName: { type: "string", title: "From name" },
      },
    },
  },
  {
    slug: "aws-ses",
    brand: "AWS SES",
    category: "email",
    capabilities: ["send", "verifyCredentials"],
    docsUrl: "https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html",
    configSchema: {
      title: "AWS SES",
      type: "object",
      required: ["accessKeyId", "secretAccessKey", "region", "fromEmail"],
      "x-field-order": ["accessKeyId", "secretAccessKey", "region", "fromEmail"],
      "x-mask": "secretAccessKey",
      properties: {
        accessKeyId: {
          type: "string",
          title: "Access key ID",
          description: "IAM user with ses:SendEmail + ses:GetAccount.",
        },
        secretAccessKey: { type: "string", title: "Secret access key", "x-secret": true },
        region: {
          type: "string",
          title: "Region",
          default: "ap-southeast-2",
          enum: ["ap-southeast-2", "ap-southeast-1", "us-east-1", "us-west-2", "eu-west-1", "eu-central-1"],
          description: "SES v2 endpoint region (Sydney default).",
        },
        fromEmail: {
          type: "string",
          title: "From address",
          format: "email",
          description: "A verified SES identity.",
        },
      },
    },
  },
  {
    slug: "twilio",
    brand: "Twilio",
    category: "sms",
    capabilities: ["send", "verifyCredentials", "deliveryStatus", "whatsapp"],
    docsUrl: "https://www.twilio.com/docs/messaging/api/message-resource",
    configSchema: {
      title: "Twilio",
      type: "object",
      required: ["accountSid", "authToken", "from"],
      "x-field-order": ["accountSid", "authToken", "from"],
      "x-mask": "authToken",
      properties: {
        accountSid: {
          type: "string",
          title: "Account SID",
          pattern: "^AC",
          description: "Starts with AC — Twilio Console home.",
        },
        authToken: { type: "string", title: "Auth token", "x-secret": true },
        from: {
          type: "string",
          title: "From number / Messaging Service SID",
          description: "E.164 number (+61…), alphanumeric sender ID, or MG… service SID.",
        },
      },
    },
  },
  {
    slug: "messagemedia",
    brand: "MessageMedia",
    category: "sms",
    capabilities: ["send", "verifyCredentials", "deliveryStatus"],
    docsUrl: "https://messagemedia.github.io/documentation/",
    configSchema: {
      title: "MessageMedia",
      type: "object",
      required: ["apiKey", "apiSecret"],
      "x-field-order": ["apiKey", "apiSecret", "from"],
      "x-mask": "apiSecret",
      properties: {
        apiKey: {
          type: "string",
          title: "API key",
          description: "MessageMedia Hub → Configuration → API Settings.",
        },
        apiSecret: { type: "string", title: "API secret", "x-secret": true },
        from: {
          type: "string",
          title: "Sender ID (optional)",
          description: "Alphanumeric sender or dedicated AU number; leave blank for shared.",
        },
      },
    },
  },
  {
    slug: "clicksend",
    brand: "ClickSend",
    category: "sms",
    capabilities: ["send", "verifyCredentials", "deliveryStatus"],
    docsUrl: "https://developers.clicksend.com/docs/messaging/sms/",
    configSchema: {
      title: "ClickSend",
      type: "object",
      required: ["username", "apiKey"],
      "x-field-order": ["username", "apiKey", "from"],
      "x-mask": "apiKey",
      properties: {
        username: {
          type: "string",
          title: "Username",
          description: "ClickSend dashboard username (API subaccount supported).",
        },
        apiKey: { type: "string", title: "API key", "x-secret": true },
        from: {
          type: "string",
          title: "Sender ID (optional)",
          description: "Alphanumeric sender or dedicated AU number; leave blank for shared.",
        },
      },
    },
  },
];

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  email: "Email",
  sms: "SMS",
};

/** Future categories shown greyed-out in the GUI (CLAUDE.md list). */
export const COMING_SOON_CATEGORIES = [
  { key: "storage", label: "Storage", brands: "Supabase Storage · S3-compatible" },
  { key: "accounting", label: "Accounting & payroll", brands: "Xero · MYOB · Employment Hero" },
  { key: "push", label: "Push & alerts", brands: "Expo push" },
];

export function providerBySlug(slug: string): CatalogueProvider | undefined {
  return CATALOGUE.find((p) => p.slug === slug);
}

export function secretFieldKeys(schema: ProviderConfigSchema): string[] {
  return Object.entries(schema.properties)
    .filter(([, field]) => field["x-secret"])
    .map(([key]) => key);
}

/** Splits form values into { config, secrets } the way 0005 stores them. */
export function splitSecretValues(
  schema: ProviderConfigSchema,
  values: Record<string, string>
): { config: Record<string, string>; secrets: Record<string, string> } {
  const secretKeys = new Set(secretFieldKeys(schema));
  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    (secretKeys.has(key) ? secrets : config)[key] = value;
  }
  return { config, secrets };
}

/** Field-level validation for the auto-rendered form. */
export function validateSchemaValues(
  schema: ProviderConfigSchema,
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of schema["x-field-order"]) {
    const field = schema.properties[key];
    if (!field) continue;
    const value = (values[key] ?? "").trim();
    if (schema.required.includes(key) && !value) {
      errors[key] = `${field.title} is required`;
      continue;
    }
    if (!value) continue;
    if (field.pattern && !new RegExp(field.pattern).test(value)) {
      errors[key] = `${field.title} doesn't match the expected format (${field.pattern})`;
    }
    if (field.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[key] = "Enter a valid email address";
    }
    if (field.enum && !field.enum.includes(value)) {
      errors[key] = `Choose one of the listed options`;
    }
  }
  return errors;
}

export function maskValue(value: string): string {
  return `•••• ${value.slice(-4)}`;
}
