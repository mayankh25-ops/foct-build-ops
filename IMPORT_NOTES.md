# Ticketing system import — integration notes

This branch contains the complete Building Support Tickets system (phone app +
admin portal + backend), copied as-is from `mayankh25-ops/subzero-facility-services`
(branch `main`, post PR #2). Nothing here is wired into a build yet — it is an
import for review/integration.

## What's in this branch

| Path | What it is |
|---|---|
| `src/support/` | The whole app: data layer (IndexedDB + sync engine), shared UI, charts, desktop portal screens, mobile app screens |
| `src/pages/Support.jsx` | Entry page — picks phone vs desktop view by screen size |
| `src/lib/supabaseClient.js` | Supabase client (non-throwing when env vars are absent → demo mode) |
| `public/support/` | FFM brand assets: logo lockups, PWA icons |
| `public/manifest.json`, `public/sw.js` | PWA manifest + offline service worker |
| `supabase/migrations/0003_support_tickets.sql` | Schema: roles, sites, tickets, photos, RLS, storage bucket |
| `supabase/functions/sendTicketReport/` | Edge function — emails the PDF report via Resend |
| `supabase/functions/_shared/` | cors / resend / supabase admin helpers the function imports |
| `SUPPORT_APP.md` | Full architecture + go-live documentation |

## To run it inside a Vite + React host app

1. npm dependencies: `@supabase/supabase-js`, `jspdf`, `lucide-react`,
   `react` / `react-dom` (18+). Everything else is vanilla.
2. Vite alias: `@` → `./src` (the code imports `@/lib/supabaseClient` and
   `@/support/...`).
3. Register the route (no layout wrapper):
   `<Route path="/Support" element={<Support />} />`
4. Env: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Without them the app
   runs fully in on-device demo mode.
5. Backend: `supabase db push`, then
   `supabase functions deploy sendTicketReport` (secrets: `RESEND_API_KEY`,
   `RESEND_FROM`, optional `SUPPORT_MANAGER_EMAIL`).

See `SUPPORT_APP.md` for the offline-sync architecture and role model.
