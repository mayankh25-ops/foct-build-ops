# Service Desk — module PRD (v1)

> Owner-supplied brief, received 2026-07-06. Static preview screens shipped the same day
> (`/service-desk`, `/service-desk/new` — see DECISIONS.md). Backend stages are GATED on the
> platform Stage 2 foundation (Supabase + core tables + RLS), which itself is gated on the
> design-variant pick. Nothing below is built beyond the preview until the owner approves the
> Stage 1 (schema) plan at the end of this file.

## What it is

A Zendesk-inspired ticketing system for building operations. Concierge staff, the cleaning
team, **or anyone holding the site's link/QR code** lodges an issue on a per-site intake form
(created inside the company/org). Cleaners attend and close with mandatory after photos;
followers (multiple email addresses attachable per ticket) receive public updates and the
closure email with a before/after PDF.

## Core flow (owner brief, condensed)

1. **Lodge (<60s on a phone, no password):** name from site-staff dropdown → level dropdown
   (+ "Other" free text; "Add another location" for multi-location tickets) → category
   dropdown (org-admin configurable) → 1–5 photos → short description → optional priority →
   submit. Ticket ref `SD-{SITE_CODE}-{YYMM}-{seq}`. **Follower emails** addable at lodge time
   (and later): every follower gets public updates + closure email.
2. **Fan-out (Inngest on ticket.created):** Expo push to site cleaning team, email to manager
   distribution, WhatsApp *template* message (Meta pre-approval; variables: ticket ID, site,
   level, status) to on-duty numbers; per-site/per-priority routing; Urgent may add SMS.
3. **Attend & close:** Attend → In Progress (timestamped). Close requires name-from-roster +
   ≥1 after photo + optional note → Resolved. Closure notifications to lodger + followers on
   their registered channels.
4. **PDF (Inngest on ticket.resolved):** 1–2 page branded report — mono ticket ref, site,
   levels, category, priority, lodged/attended by, time-to-attend/resolve, **before/after
   pairs side by side**, resolution note. Supabase Storage; linked on ticket; attached to
   closure email; visible to manager + client viewer.

## Zendesk-lifted v1 features

Statuses New → Open → In Progress → Resolved → Closed (auto-close 48h) + Reopened (dispute
window 48h, one-tap 👍/👎 CSAT in closure notification). Saved views/queues (site, status,
priority, category, assignee, date; "Urgent open", "Unattended > 2h", "Today"). Per-priority
SLA policies with countdown chips + 80%/breach Inngest alerts. Internal notes vs public
updates. Immutable per-ticket activity timeline. Analytics dashboard (volume, avg
time-to-attend/resolve, category/level breakdown, SLA compliance %).

**Out of v1:** email-to-ticket, live chat, AI triage, macros, multi-language, billing.

## Data model (starting point)

`sd_tickets`, `sd_ticket_locations`, `sd_ticket_photos` (kind before|after),
`sd_ticket_events` (immutable timeline), `sd_categories`, `sd_site_staff` (drives name
dropdowns + notification routing; notify_channels jsonb), `sd_sla_policies`,
**`sd_ticket_followers` (ticket_id, email, added_by, created_at)** — from the owner's
follower-emails requirement. Photos compressed client-side (~1600px long edge), originals in
Storage under `org/site/ticket_ref/`, signed URLs only.

## Platform conformance — deltas from the pasted brief (BINDING)

The brief was written against an older/parallel spec. Where it conflicts with CLAUDE.md and
the current decision log, **the platform rules win**:

| Brief says | Platform reality | Resolution |
| --- | --- | --- |
| Fonts: General Sans / Hanken Grotesk / Geist Mono | Approved library (CLAUDE.md 2026-07-05/06): Bricolage Grotesque + Onest + Roboto Mono | Current pairing; ticket refs/timestamps use `font-mono` (Roboto Mono, SF Mono fallback) |
| Radix step colour tokens | Semantic token system (`design/tokens.md`), themes via `data-theme` | Semantic tokens only — already honoured in the preview screens |
| Tenancy "Org → Client → Site → Zone" | organisations × buildings (+building_organisations, service_contracts, RLS) | "Site" maps to `buildings`; zones/levels as building metadata; no parallel hierarchy. RLS helpers come from platform Stage 2 |
| Next.js 16 | Repo is on the platform's pinned Next version | Stay on repo version; upgrade is a platform decision, not a module one |
| Expo/React Native mobile app + PowerSync offline sync | Not in CLAUDE.md stack | **New stack decisions — need explicit owner sign-off in DECISIONS.md before any mobile work.** Web-mobile (responsive + PWA-ish) can cover v1 concierge flow; PowerSync/Expo added when the cleaner offline requirement is scheduled |
| Twilio WhatsApp/SMS, Resend email hardcoded | Integrations Framework: adapter interfaces + provider catalogue + Vault credentials | Notifications go through `SmsProvider`/`EmailProvider` adapters (+ a new `MessagingProvider` for WhatsApp templates); Twilio/Resend are the default catalogue entries, not hardcoded |
| "Aurora Melbourne Central B4–L92; The Muse 21 levels" | Demo seed is fixed: Aurora on Collins, 40 levels (CLAUDE.md) | Seed stays Aurora on Collins (B4–GF–L40); a second demo building can join in Stage 2 to prove multi-site |
| Chromium PDF via Playwright | Consistent with platform (no client-side PDF) | Adopt as-is, runs as an Inngest job |

## Stage plan (each stage = plan → owner approval → build → SESSION note)

1. **Schema + RLS** — all `sd_*` tables WITH RLS policies + pgTAP isolation tests in the same
   migrations (platform rule 4); seed Aurora tickets/categories/staff. *Blocked on platform
   Stage 2 (Supabase project + org/building/RLS helpers).* 
2. **Ticket creation** — public tokenised intake route (QR/link, site-scoped, rate-limited),
   in-app form, photo upload, multi-location, followers.
3. **Queue + detail** — manager/cleaner views, statuses, assignment, timeline, internal notes.
4. **Notifications** — Inngest fan-out, adapter-based email/WhatsApp/SMS/push, per-site
   routing config UI, WhatsApp template copy for Meta approval (owner to approve wording).
5. **Close flow + PDF** — after-photos gate, Chromium PDF, closure fan-out incl. followers,
   CSAT, 48h reopen window.
6. **Dashboard + SLA** — saved views, SLA timers/breach alerts, animated analytics.

## Open questions for the owner (blocking the relevant stages only)

1. **Mobile:** approve Expo + PowerSync as stack additions now, or ship v1 as responsive web
   (kiosk-style, works on phones) and add native offline later?
2. **SLA defaults** per priority (suggest: Urgent 15m/2h, High 45m/4h, Normal 2h/8h, Low
   4h/24h — attend/resolve)?
3. **WhatsApp template wording** — needs Meta approval lead time; draft copy comes with
   Stage 4 plan.
4. **Public intake exposure** — per-site tokenised URL rotating on demand OK? Any CAPTCHA
   requirement for the public form?
