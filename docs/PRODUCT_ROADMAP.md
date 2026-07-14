# PRODUCT ROADMAP — where FOCT BuildingOps can go

> Owner brainstorm session 2026-07-10. Not a commitment list — a map of the
> product territory, what each idea is worth, and what to build first.
> Priorities at the bottom. CLAUDE.md working rules still apply: nothing here
> starts before the owner picks it.

## The one-line thesis

Every competitor owns ONE party's workflow: MYBOS/BuildingLink own the
building manager, Lighthouse/freshOps/Templa own the cleaning contractor,
SINE owns the front door, CleanBid owns the quote. Nobody owns the BUILDING —
the shared workspace where owner, BM, concierge, cleaners and trades
cooperate without seeing each other's private data. Our RLS isolation model
IS the product. Every module below should reinforce "one building, many
companies, zero leakage".

---

## 1. Quoting new buildings — "Scope Studio" (the Scope module grows up)

The Scope module already proves we can turn a service agreement into a
structured dataset (222 items, 393.0 h/wk, reconciled). The quoting workflow
is the natural next step and a genuine differentiator for cleaning companies:

- **Tender import**: upload the tender/agreement PDF → structured scope
  (entities → zones → tasks → frequencies) like scope-data.ts, but authored
  in-app with an editor + AI-assisted extraction later.
- **Workloading engine**: per zone, area m² × surface type × task frequency
  × productivity rate (ISSA/BSCAA cleaning times: m²/hr for vacuuming,
  damp-mopping, auto-scrubbing, restroom fixtures/hr) → required labour
  hours calculated, not guessed. Compare calculated vs contract-stated hours
  → instantly see if a tender is under-scoped (margin risk) or fat.
- **Award-rate costing (AU)**: Cleaning Services Award level, weekday /
  evening / Saturday / Sunday / PH penalty splits straight from the
  indicative roster (the day-gantt data already models spans + breaks),
  superannuation, on-costs → true labour cost per week.
- **Machine & equipment recommendation**: from the m² by surface type —
  e.g. >1,500 m² contiguous hard floor → walk-behind scrubber-drier (size
  by m²/session), carpet m² → vacuums per cleaner + periodic extraction
  machine, entrance matting metres, consumables baseline (liners, chemicals
  per dispenser count). Output: a recommended fleet list with capex/lease
  cost feeding the quote.
- **Quote pack export**: branded PDF — scope summary, roster proposal,
  equipment list, price. The Scope explorer becomes the client-facing
  "here's how we read your building" artefact (it already looks the part).

Why it wins: nobody in the AU market connects tender → workload → award
costing → roster → THEN runs the same data as live operations after the win.
CleanBid stops at the quote; Templa starts after the win. Same dataset both
sides is the moat.

## 2. Digital maps / floor plans (upgrade from "coming soon")

- Upload floor plates (PDF/image per level) → draw zones over them
  (polygon per zone, tagged with surface type + m²).
- Zones become THE join key across the whole product: scope tasks belong to
  zones, QR codes are per zone, check-ins/tickets/audits pin to zones,
  workloading reads zone m².
- Cleaner phone app shows the map with "your zones today"; concierge lodges
  a ticket by tapping the map; BM sees a heatmap (tickets/audit fails by
  zone) that instantly shows problem floors.
- Start cheap: static image + drawn polygons (no CAD/BIM), stored per
  building. IFC/BIM import is a later enterprise feature.

## 3. Bin schedules & waste ops (small module, huge daily pain)

Chute/garbage rooms are already all through the scope data. Add:
- **Bin roster**: which bins go out when, mapped to council/private pickup
  days per stream (general/recycling/organics/glass/cardboard); cleaner or
  concierge gets the task automatically the evening before; photo proof of
  presentation + return.
- **Hard waste & bulky bookings**: residents/BM book, concierge approves,
  cleaners get the job.
- **Waste reporting for ESG**: volumes per stream per month → diversion
  rate — strata committees increasingly ask for this (NABERS Waste).

## 4. Building calendar + periodic jobs (turns Scope's planner into operations)

The periodic planner already GENERATES the 12-month schedule (206
occurrences). Next step: those occurrences become real calendar jobs —
assigned, tracked, evidenced (photos), and billed if BILLABLE EXTRA.
- One building calendar shared by all parties with per-org visibility:
  contractor visits, lift bookings/moves, amenity bookings, inspections,
  periodic works, waste pickups.
- "This week at Aurora" digest email to the BM/committee.
- This is priority #3 (Calendar) + a slice of #4 (Tasks) in the owner's
  order — building them on the periodic dataset kills two birds.

## 5. Role workflows still missing (by persona)

**Concierge / reception** (priority #2): raise + track tickets (exists),
parcels register with photo + resident notification + collection signature,
visitor/contractor sign-in with induction check, keys/fob register with
loan tracking, shift handover notes (private to concierge org — good RLS
showcase), resident requests inbox.

**Building manager**: defect/incident register with photo evidence and
contractor assignment, contractor compliance vault (insurance certificates,
SWMS, induction status — auto-expiry chasing), compliance calendar (annual
fire safety statement, ESM items, anchor points, lift rego — with evidence
uploads), inspection checklists, committee-ready monthly report export.

**Cleaning manager** (mostly built): site audits with weighted scoring
(priority #5) that feed a client-visible quality score, variance dashboard
(rostered vs actual from timesheets), consumables budget vs spend per site.

**Strata / owner**: read-only quality + compliance + spend dashboards,
module toggles, provider invitations. Never operational detail (RLS).

## 6. Head office / portfolio view (multi-building command centre)

For a cleaning company or BM firm running 20–200 buildings:
- **Portfolio dashboard**: one row/tile per building — RAG status from live
  signals (missed check-ins now, SLA breaches today, open urgent tickets,
  audit score trend, labour hours vs contract this week). Exception-first:
  the screen shows the 6 buildings that need attention, not all 80.
- **Benchmarking**: cost/m², tickets per 100 residents, audit scores across
  buildings; spot the outlier sites.
- **Drill-down**: click a building → its dashboard (already built).
- Data model already supports it (organisation ↔ many buildings via
  building_organisations); this is a UI + aggregate-query build, and the
  natural "sells to the boss" screen for demos.
- Ops details: org-level roles (area manager sees their patch only),
  building switcher in the top bar (exists) grows a "All buildings" mode.

## 7. Other candidates on the radar

- **Missed check-in alerts** (Inngest job — designed, unbuilt; part of flow #1).
- **Client portal links**: shareable read-only ticket/report links for
  committee members without accounts.
- **Induction micro-module**: contractor watches site induction, answers
  questions, gets QR pass — feeds visitor sign-in.
- **Supplier ordering**: consumables orders → email/PDF PO to supplier via
  the integrations framework.
- **NFC/QR checkpoint rounds**: security/cleaner patrol verification.
- **Multi-language for cleaner app** (big AU workforce reality).

---

## Recommended order (owner to confirm)

1. **Finish flow #1** (kiosk → real check-ins → automatic timesheets +
   missed check-in alerts + Service Desk notifications/PDF). An unfinished
   flagship undermines every demo.
2. **Portfolio/head-office dashboard** — cheap on the existing model, and
   it is THE screen that sells to decision-makers.
3. **Calendar built on the periodic planner** (owner's #3, powered by
   Scope data we already generate).
4. **Scope Studio quoting** (workloading + award costing + machine
   recommendation) — the differentiator; start with productivity-rate
   tables + m² per zone (which floor plans will later automate).
5. **Concierge desk** (owner's #2) with parcels + handover notes as the
   RLS showcase.

The through-line: every new module should read/write the SAME building
dataset (zones, people, contracts) — never a silo.
