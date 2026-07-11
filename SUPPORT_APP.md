# Building Support Tickets

Offline-first support ticketing for Focused Facilities Management, implemented from
the Claude Design handoff (`Mobile App.dc.html` + `Building Support Tickets.dc.html`).

## Where it lives

| URL | What you get |
|---|---|
| `/Support` | Auto-selects by screen size |
| `/Support?view=mobile` | Phone app (concierge & cleaning crews) |
| `/Support?view=desktop` | Admin console (dashboards, billing, settings) |

Everything is inside `src/support/` — the marketing site is untouched apart
from the route registration in `src/App.jsx`.

## Try it instantly (no backend needed)

Open `/Support` and pick a **demo role** on the sign-in screen:

- **Concierge** — create tickets (2-tap wizard on mobile), track delivery
- **Cleaning team** — work the job queue, attach after photos, complete jobs
- **Admin** — analytics dashboard, billing/invoice locks, PDF template, users & sites

Demo data is seeded on this device (IndexedDB) and every flow — including
photos and PDF export — works completely offline.

## Architecture: built to survive no reception

```
UI (mobile + desktop React views)
        │  reads/writes instantly
        ▼
IndexedDB (tickets, photo blobs, outbox, settings)   ← single source of truth
        │  replayed in order, idempotently
        ▼
Sync engine (src/support/sync.js)
  • auto: back-online event, 60 s interval, tab re-focus
  • manual: tap the SYNCED / QUEUED pill or the sidebar status
        ▼
Supabase (Postgres + RLS, Storage bucket `ticket-photos`, Edge Functions)
```

Key reliability decisions:

- **Every write lands locally first** — creating a ticket, changing status,
  attaching a photo. The app never blocks on the network.
- **Idempotent sync** — tickets and photos are keyed by client-generated
  UUIDs and upserted, so replaying a flaky queue can never duplicate data.
- **Ticket numbers offline** — a phone allocates the next local number
  (e.g. `AUR-1044`); if two offline devices collide, a DB trigger renumbers
  the second on sync instead of failing.
- **Photos** are stored as blobs in IndexedDB and uploaded to Supabase
  Storage when connected; PDFs embed them from either place.
- **Service worker** (`public/sw.js`) caches the app shell so `/Support`
  opens with zero connectivity; API traffic is never intercepted.

## Features

- **Roles** — concierge / cleaning / admin (`support_profiles.role`), enforced
  by Postgres RLS; admins invite users from Settings → Users.
- **Photos** — camera capture on mobile (`capture="environment"`), before/after
  sets, upload retry, on-device badge until synced.
- **PDF reports** — generated client-side with jspdf (`src/support/pdf.js`),
  matching the design's report layout; the admin-controlled template chooses
  which fields appear. Works offline.
- **Email** — “Email PDF” calls the `sendTicketReport` edge function, which
  sends via Resend with the PDF attached to the building manager
  (`SUPPORT_MANAGER_EMAIL` secret, defaults to the business address) and the
  sender.
- **Billing** — chargeable jobs are locked until a Xero invoice number is
  recorded (per design); Xero API integration is stubbed for later.
- **PWA** — `manifest.json` + icons; “Add to Home Screen” installs the phone
  app. To ship on the App/Play Store later, wrap this same codebase with
  Capacitor or reuse `src/support/` logic in an Expo shell.

## Going live

1. Apply the migration: `supabase db push` (adds `support_*` tables, RLS,
   the `ticket-photos` bucket, and a seed site — see
   `supabase/migrations/0003_support_tickets.sql`).
2. Deploy the edge function: `supabase functions deploy sendTicketReport`
   (uses the existing `RESEND_API_KEY` / `RESEND_FROM` secrets; optionally set
   `SUPPORT_MANAGER_EMAIL`).
3. Create users in Supabase Auth — each new auth user automatically gets a
   `support_profiles` row as *concierge*; promote admins with
   `update support_profiles set role='admin' where email='…'`.
4. Sign in on `/Support` with email + password. Live mode drops demo data and
   starts syncing.
