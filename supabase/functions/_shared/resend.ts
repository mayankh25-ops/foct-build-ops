// Minimal Resend email helper. Requires the RESEND_API_KEY secret and a
// verified sending domain. Configure the default "from" via RESEND_FROM.
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const DEFAULT_FROM =
  Deno.env.get('RESEND_FROM') ??
  'Sub-Zero Facility Services <hello@subzerofacilityservices.com.au>';

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  body: string;        // plain text
  from?: string;
  from_name?: string;
}

export async function sendEmail({ to, subject, body, from, from_name }: SendEmailArgs) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  // Allow overriding just the display name while keeping the verified address.
  let fromAddress = from ?? DEFAULT_FROM;
  if (from_name && !from) {
    const match = DEFAULT_FROM.match(/<([^>]+)>/);
    const addr = match ? match[1] : DEFAULT_FROM;
    fromAddress = `${from_name} <${addr}>`;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend error ${res.status}: ${errText}`);
  }

  return await res.json();
}
