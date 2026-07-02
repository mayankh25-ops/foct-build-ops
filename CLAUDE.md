# FOCT BuildingOps — Project Memory

## What this product is
Multi-tenant SaaS for Australian high-rise building operations. Melbourne CBD premium building feel. First commercial module: **CleaningOps** (cleaner sign-in/out, kiosk + QR check-in, rosters, missed check-in alerts, timesheets, variance reports, consumables/chemical ordering, cleaning tasks with photos, site audit forms). All other modules (ConciergeDesk, Parcels, ResidentRequests, Contractors, FloorPlans, BuildingCalendar, Audits, Integrations, Robots/Cameras/BMS) exist ONLY as registered-but-disabled modules with polished "Coming soon" / "Not enabled for this building" states. Never overbuild them. Never let a disabled module look broken.

## Tech stack (do not deviate without writing to docs/DECISIONS.md)
- Next.js (App Router), TypeScript strict
- Supabase (Sydney region): Postgres, Auth, RLS, Storage, Vault/pgsodium for secrets
- TanStack Query, Zustand (client state only)
- Tailwind with CSS-variable design tokens (no raw hex in components, ever)
- Inngest for jobs (missed check-in alerts, report scheduling)
- Adapter pattern for all third-party integrations (see Integrations Framework)

## The multi-org isolation rule (NON-NEGOTIABLE)
Buildings are serviced by multiple UNRELATED companies. A building owner org, a cleaning company org, a concierge/BM org, and other subcontractor orgs all touch the same building but must not see each other's private data. This is NOT a simple role system. Access = organisation × building × module × role × permission × service_contract. Enforce in Postgres RLS first, UI second. If a feature can't express who sees what through this model, the feature is designed wrong — stop and redesign.

### Core tables
organisations, organisation_types, buildings, building_organisations,
users, organisation_memberships, building_memberships,
roles, permissions, role_permissions,
modules, building_modules, organisation_module_access,
service_contracts, audit_logs, integration_providers, integration_credentials,
themes, building_theme_assignments

### Isolation acceptance tests (must always pass)
- Cleaning manager (FOCT Cleaning) sees: own org users, assigned buildings, cleaning shifts/check-ins/timesheets/consumables/tasks/audits. Sees NOTHING of: concierge handover notes, parcels, resident data, other contractors' inductions, BM private notes, any other cleaning company's staff or payroll.
- Concierge sees: calendar, parcels/resident requests/contractor arrivals when enabled, cleaning COMPLETION STATUS only when building admin grants it. Never cleaner payroll, timesheets, roster internals, or cleaning staff records.
- Subcontractor sees: only its own staff, inductions, assigned jobs.
- Building owner/strata: owns building record, toggles modules, invites providers, high-level reports only.
- Every cross-org grant is an explicit row (service_contracts / organisation_module_access / permission grant), never an implicit default. Every sensitive read/write hits audit_logs.

## Design system (EXTREME priority — this is what sells the product)
The product must look design-agency built: Stripe / Linear / Apple calibre. Calm, generous spacing, clear hierarchy, premium commercial-building feel.

### Token architecture
- Semantic tokens only in components: `--bg-canvas`, `--bg-surface`, `--bg-raised`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-hover`, `--accent-subtle`, `--success`, `--warning`, `--critical`, `--focus-ring`.
- Themes are token SETS applied via `data-theme="<name>"` on the app root. A building admin picks a theme per building/client; switching themes must never require touching component code.
- Neutrals referenced against real systems: Apple HIG semantic colours (systemBackground/label hierarchy), Radix Colors scales (Slate/Sand/Sage), Figma/Material tonal ramps. Document the reference next to each token in `design/tokens.md`.

### The 5 shipping themes (fixed names, tune values in Stage 1)
1. **Graphite** (default) — warm off-white canvas (#FAFAF8 family / Radix Sand 1-2), charcoal-slate text (Radix Slate 12), deep graphite-blue accent. Apple HIG neutral discipline.
2. **Harbour** — light grey canvas, ink-navy text, deep teal accent (FOCT signal teal #00B4A6 desaturated for UI, full strength for brand moments only).
3. **Eucalypt** — warm neutral canvas, muted green accent (Radix Sage/Grass low-chroma), for ESG/green-building clients.
4. **Sandstone** — warm stone canvas, bronze/amber-leaning accent, restrained; heritage/premium strata feel.
5. **Ink** — the one dark theme: deep charcoal surfaces (never pure black), soft off-white text, teal accent; for concierge desk night mode and kiosks.

All five share identical semantic token names, spacing, radius, and status colours (amber warning, restrained red critical, muted green success) — only the ramp values change.

### Typography
- Display/headings: General Sans (fallback: Inter Display / SF Pro Display feel)
- Body/UI: Hanken Grotesk (fallback: Inter)
- Numerics, timestamps, IDs, table figures: Geist Mono — ONLY for numeric/tabular data
- Type scale documented in design/tokens.md; no ad-hoc font sizes in components.

### Layout rules
8px spacing grid. Card radius 12–16px. White/surface cards with 1px subtle border + very soft shadow. Tables readable, not dense. Buttons calm and obvious. Max 2 accent-coloured elements per view. FORBIDDEN: harsh admin-template blue, cheap gradients, Material demo look, Bootstrap look, crowded card grids, fake charts, more than one font personality per surface.

## Integrations Framework (dynamic, GUI-configured, brand-agnostic)
Nothing third-party is hardcoded. Every integration category has a TypeScript adapter interface + provider implementations + an admin GUI where a super admin (or org admin where delegated) selects the provider and enters credentials. Changing provider = form change, not code change.

Categories and genuine launch providers (verify current APIs before implementing each):
- **Email**: Resend (default), Postmark, SendGrid, AWS SES — `EmailProvider` interface: send, sendTemplate, verifyCredentials
- **SMS**: Twilio, MessageMedia (AU), ClickSend (AU) — `SmsProvider` interface: send, verifyCredentials, deliveryStatus
- **Storage** (future): Supabase Storage default, S3-compatible optional
- **Accounting/Payroll export** (future greyed): Xero, MYOB, Employment Hero
- **Push/alerts** (future): Expo push

Rules:
- `integration_providers` table = catalogue (category, brand, capabilities, config schema as JSON Schema → auto-rendered form).
- `integration_credentials` = per-org or per-building credential sets, encrypted at rest via Supabase Vault; never stored plaintext, never returned to the client after save (masked, "replace" only).
- Every credential form has a **Test connection** button calling `verifyCredentials`.
- Fallback + audit: provider changes are audit_logged; sends record which provider handled them.

## Working rules for Claude Code
1. Read docs/PROJECT_STATE.md before doing anything. Update it before ending any session.
2. Plan before building: for any stage, present the plan and wait for approval before writing code.
3. Small commits per logical unit; conventional commit messages.
4. RLS policies ship WITH the tables in the same migration, plus a SQL/pgTAP isolation test.
5. Any deviation from this file goes in docs/DECISIONS.md with date and reason.
6. Never generate placeholder lorem-ipsum UI — always use the demo seed data (Section: Demo dataset).
7. Do not start future modules beyond their "Coming soon" shell, even if asked casually — flag it and ask.

## Demo dataset (seed, keep consistent everywhere)
- Building: "Aurora on Collins" — fictional 40-level Melbourne CBD tower (do not use real client names in seed data)
- Orgs: "Meridian Strata Group" (owner/strata), "FOCT Cleaning" (cleaning company), "Concierge Collective" (concierge/BM), "BrightSpark Electrical" (subcontractor)
- Modules: Core + CleaningOps enabled; ConciergeDesk visible-disabled for Concierge Collective; Parcels/ResidentRequests/Integrations coming-soon
- Users: 1 super admin, 1 strata manager, 1 cleaning manager, 3 cleaners, 1 concierge, 1 subcontractor admin
- Theme: Aurora on Collins assigned "Harbour"; a second demo building later can use "Graphite" to prove theme switching.
