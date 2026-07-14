# Ticketing import — comparison & integration plan

> Source: branch `import/ticketing-system` (commit c3c5959, pushed from the
> owner's other Claude Code session — the "subzero repo" FFM Building Support
> app). Read 2026-07-10. NOTHING merged yet — this doc is the decision gate.

## What the import is
Vite + React (JSX) offline-first ticketing: `src/support/` holds an IndexedDB
data layer (`db.js`), an idempotent outbox **sync engine** (`sync.js`), shared
UI + charts, a desktop admin console (dashboards, tickets list/detail, create,
**billing with Xero-invoice locks**, **PDF report + admin template**, settings
with user invites) and the mobile crew app (2-tap create wizard, jobs,
insights). Backend: `supabase/migrations/0003_support_tickets.sql`
(support_profiles/companies/sites/tickets/photos + RLS + `ticket-photos`
bucket + offline-number renumber trigger) and a `sendTicketReport` edge
function (Resend, PDF attached). Same Subzero design lineage as our /support
surface — the two UIs are siblings.

## Side-by-side

| Capability | Import (FFM) | Ours (Service Desk) | Verdict |
|---|---|---|---|
| Offline-first (IndexedDB + outbox sync, offline ticket numbers, photo blob queue) | ✅ battle-designed | ❌ (localStorage demo / online Supabase) | **TAKE THEIRS** — this was our Stage-4 PWA plan, already built |
| PDF report (client-side jspdf, admin-configurable template, works offline) | ✅ | simulated only | **TAKE THEIRS** |
| Email PDF via edge function + Resend | ✅ | simulated | **TAKE THEIRS** (route through our integrations adapter) |
| Billing: chargeable jobs locked until invoice # (Xero stubbed) | ✅ | ❌ | **TAKE THEIRS** |
| Insights/analytics screens + charts | ✅ | basic queue metrics | **TAKE THEIRS**, re-chart with --chart tokens |
| Auth roles + user invites | 3 flat roles (concierge/cleaning/admin) | full org × building × module × contract RLS (23+15 assertions) | **KEEP OURS** — theirs collapses into our role model |
| Data model | support_companies/sites (flat) | organisations/buildings/service_contracts (isolation-first) | **KEEP OURS** (sd_* tables) |
| Public QR/link intake (anon, token-gated RPC) | ❌ | ✅ | keep ours |
| Followers, internal notes, CSAT, reopen, SLA policies | ❌/partial | ✅ | keep ours |
| Theming | hardcoded Subzero styling | 12-theme token system | **KEEP OURS** (their functionality restyled) |
| Statuses | open/assigned/inprogress/attended/completed | new/open/in-progress/resolved/closed/reopened | map: assigned→open(+assignee), attended→in-progress event, completed→resolved |
| Priorities | Low/Medium/High/Urgent | low/normal/high/urgent | map Medium→normal |

## Recommended integration (functionality theirs, skeleton + skin ours)
1. **Offline core (biggest win):** port `db.js` + `sync.js` to TypeScript as
   `src/lib/sd-offline.ts`, targeting OUR `sd_*` schema — IndexedDB truth,
   outbox replay, client-UUID idempotent upserts, auto-sync (online event /
   60 s / refocus) + manual sync pill in both SD surfaces. Add their
   offline-ref renumber trigger to `app.sd_next_ref` in a `0004` migration.
2. **PDF + email:** port `pdf.js` + template settings; adapt `sendTicketReport`
   edge function to `sd_*` + the email adapter (needs owner's Resend key).
3. **Billing:** add `chargeable` / `invoice_no` to sd_tickets (0004), port the
   Billing screen + closed-until-invoiced lock into the desk (restyled).
4. **Insights:** port the charts into a desk Analytics tab using --chart-1/2/3.
5. **Styling:** every ported screen rebuilt on our components/tokens; the
   import branch stays untouched as reference.
Order: 1 → 2 → 3 → 4 (each committed + e2e'd separately).

## Open questions for the owner
- Approve "functionality theirs, schema + isolation + design ours"? (vs
  adopting their support_* schema wholesale, which would drop the multi-org
  isolation model — not recommended.)
- Billing: keep Xero-stub behaviour (manual invoice number) for now?
- Their status vocabulary ("Attended") already matches our phone surface —
  any wording you want kept exactly?
