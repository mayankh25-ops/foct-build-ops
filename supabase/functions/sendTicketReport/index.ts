// sendTicketReport — emails a support-ticket PDF report (generated client-side)
// to the building manager and, optionally, the ticket creator.
// Body: { ticketNo, summary, pdfBase64, fileName, to? }
import { corsHeaders, json } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseAdmin.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM =
  Deno.env.get('RESEND_FROM') ??
  'Sub-Zero Facility Services <hello@subzerofacilityservices.com.au>';
const MANAGER_EMAIL =
  Deno.env.get('SUPPORT_MANAGER_EMAIL') ?? 'hello@subzerofacilityservices.com.au';

const MAX_PDF_BYTES = 8 * 1024 * 1024; // keep attachments well under Resend's cap

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY is not configured' }, 500);
    }

    // Require a signed-in support member — this function sends outbound email.
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Not authenticated' }, 401);

    const admin = getServiceClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: 'Not authenticated' }, 401);

    const { data: profile } = await admin
      .from('support_profiles')
      .select('id, email, full_name')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!profile) return json({ error: 'No support profile for this account' }, 403);

    const { ticketNo, summary, pdfBase64, fileName, to } = await req.json();
    if (!ticketNo || !pdfBase64) {
      return json({ error: 'ticketNo and pdfBase64 are required' }, 400);
    }
    // Rough decoded size check (base64 inflates ~4/3).
    if (pdfBase64.length * 0.75 > MAX_PDF_BYTES) {
      return json({ error: 'PDF too large to email — download it instead' }, 413);
    }

    const recipients = new Set<string>([MANAGER_EMAIL]);
    if (profile.email) recipients.add(profile.email);
    if (typeof to === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      recipients.add(to);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [...recipients],
        subject: `Support ticket report — ${ticketNo}`,
        text: [
          `Attached is the PDF report for ${ticketNo}.`,
          summary ? `\n${summary}` : '',
          `\nSent from Building Support Tickets by ${profile.full_name ?? 'a team member'}.`,
        ].join('\n'),
        attachments: [
          {
            filename: fileName || `${ticketNo}_report.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `Resend error ${res.status}: ${errText}` }, 502);
    }

    const result = await res.json();
    return json({ ok: true, id: result?.id ?? null, to: [...recipients] });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
