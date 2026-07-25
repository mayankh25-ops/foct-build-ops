# Testing and release process

The principle borrowed from the big platform teams: **automate the repeatable
checks, use humans for judgement, and release gradually so one defect can't
reach everyone.** This page maps that to what we actually run — Next.js on
Vercel, Supabase Postgres with RLS, Zustand stores, an Android kiosk tablet.

Everything marked **automated** runs in CI on every push
(`.github/workflows/ci.yml`). Everything marked **manual** is a human step on
the release checklist; pretending otherwise is how a checklist stops meaning
anything.

Run the whole automated set locally before you push:

```bash
npm run verify      # tokens, contrast, types, lint, unit, secrets, deps, build
npm run test:db     # database + RLS isolation (needs a scratch Postgres)
npm run test:e2e    # end-to-end journeys in a real browser
```

---

## 1. Requirements and design review — manual

Before code, three questions decide most of the defects:

- **Who can see this?** Every feature must express itself as
  organisation × building × module × role × permission × service_contract. If
  it can't, it's designed wrong (CLAUDE.md, non-negotiable).
- **What happens offline / twice / with missing data?** The kiosk is on
  building Wi-Fi, so "the tablet lost connection mid-punch" is a normal
  Tuesday, not an edge case.
- **What breaks downstream?** Attendance feeds timesheets, dashboards, missed
  alerts and payroll export. A change to one changes four.

Recorded in `docs/DECISIONS.md` with the date and the reason — including the
options rejected, which is the part that saves the next argument.

## 2. Unit tests — automated (`npm run test:unit`)

Vitest over the pure logic in `src/lib`. Currently 48 assertions covering the
calculations nobody can eyeball:

| File | What it protects |
|---|---|
| `tests/unit/attendance.test.ts` | late vs on-site vs missed thresholds, paired hours, in-progress shifts excluded from totals, per-shift corrections floored at zero, roster pattern expansion |
| `tests/unit/formatting.test.ts` | `18h 16m` / `+16 min` / `−2h 50m` — rounding, zero-padding, the real minus sign |
| `tests/unit/bookings.test.ts` | amenity double-booking, including back-to-back bookings that must NOT conflict |
| `tests/unit/integrations-catalogue.test.ts` | every secret field is classified as a secret (a misclassification stores an API key in plaintext), schema validation, masking |
| `tests/unit/scope-data.test.ts` | the contract dataset still reconciles to 393.0 h/wk, 222+16 items, 60.0/46.5 h/day |

Add a test here whenever a calculation gets an argument, a rounding rule, or a
threshold.

## 3. Component and module testing — partly automated

Module-level behaviour is covered by the e2e route smoke (every screen renders,
no console error, stylesheet actually loaded) plus per-module journey specs.
Truly component-level tests (React Testing Library) are **not** in place yet —
the honest gap. Priority if we add them: the timesheet review modal and the
consumables order builder, where the state is intricate enough to break
silently.

## 4. Integration testing — automated where state is real

The Service Desk spec proves the cross-surface path: a ticket raised on the
phone surface (`/support/new`) appears in the desk queue (`/service-desk`) and
survives a reload. That shape — write on one surface, read on another, reload —
is the template for every module as it goes live.

Chains still to cover as their backends land: punch → timesheet row → approval
→ payroll export; ticket closed → follower email → PDF.

## 5. API and RPC testing — automated via the database suite

We have no bespoke REST layer: the client talks to Supabase RPCs, so the
contract is the SQL function signature. `scripts/test-db.mjs` calls each RPC
the way the client does, including the failure paths:

- wrong PIN, PIN belonging to someone else, double check-in, check-out with no
  open shift
- a pair code redeemed twice
- selfie attached twice to the same event
- credential activation before a passing connection test

Parameter names are part of the contract (PostgREST matches on them). A
mismatch between `src/lib/*.ts` and the migration fails at runtime, not at
compile time, so **cross-check RPC argument names whenever a signature
changes** — the kiosk layer was verified this way.

## 6. Database testing — automated (`npm run test:db`)

This is the most important suite we have, because it is the only one that can
prove the promise the product is sold on: **Company A cannot see Company B's
data.**

It builds a throwaway database, applies `supabase/APPLY_EVERYTHING.sql`
exactly as you'd paste it into the dashboard, applies it **again** (idempotency
— you re-paste bundles routinely), then runs 81 assertions:

| Suite | Assertions | Proves |
|---|---|---|
| `isolation_check.sql` | 23 | core multi-org isolation |
| `sd_isolation_check.sql` | 15 | anon QR intake works; internal notes invisible to concierge and owner |
| `integrations_isolation_check.sql` | 19 | secrets never readable back, replace-only enforced in the DB |
| `session_profile_check.sql` | 5 | `current_profile()` returns the right memberships |
| `kiosk_isolation_check.sql` | 19 | PINs never leave the server, a device token grants no data access |

Two methodology rules learned the hard way:

- **Never test RLS as a superuser** — superusers bypass it, so the suite passes
  no matter what the policies say. Device-side steps do `set local role anon`.
- **`create table if not exists` skips an existing older table** instead of
  upgrading it. That's why a half-built project needs
  `RESET_PUBLIC_SCHEMA.sql`, and why CI asserts the bundle is regenerated.

CI also fails if `APPLY_EVERYTHING.sql` is stale — a migration authored but
left out of the bundle is caught before it reaches you.

**Still manual:** applying a migration against a *copy of real production data*
before applying it live. Do this once there is real data worth losing; the
backup/restore drill below is the same exercise.

## 7. Regression testing — automated

Every layer above runs on every push; that IS the regression suite. The rule
that keeps it useful: **a fixed bug gets a test in the same commit as the fix.**
A bug that could recur silently and has no test isn't finished.

## 8. Impact analysis — manual, with automated backstops

Before changing shared code, work out what reads it:

```bash
rg "deriveTimesheets|attendance_events" src supabase   # who depends on this
```

The backstops: TypeScript catches signature changes across the app, the
database suite catches policy changes, the e2e smoke catches a screen that
stops rendering. What none of them catch is a *semantic* change — hours that
are still a number but now mean something different. That needs a human and a
line in DECISIONS.md.

## 9. End-to-end testing — automated (`npm run test:e2e`)

Playwright against a **production build** (`next build && next start`), not the
dev server — dev-only behaviour has hidden real bugs here before.

- `e2e/smoke.spec.ts` — all 20 routes render, no console errors, no 5xx, and
  the themed background actually computed (catches the "loading like this"
  unstyled-page failure)
- `e2e/kiosk.spec.ts` — name search → PIN → 3-2-1 selfie → confirmation, plus
  wrong PIN, someone else's PIN, and double check-in
- `e2e/service-desk.spec.ts` — phone-to-desk ticket flow and reload persistence

Specs run in demo mode (no Supabase env) so a fresh clone and CI can both run
them. The **live** journey — real pairing, real punch, real Storage upload —
is a staging step in §15, because faking it here would prove nothing.

## 10. Android kiosk testing — manual, with a defined matrix

The tablet is a browser, which removes most of the APK risk, but not all of it.
Before shipping a kiosk change, on at least two physical devices:

| Check | Why it matters here |
|---|---|
| Android 10 / 13 / 14 | camera permission prompts differ across versions |
| A Samsung **and** a budget device (Xiaomi/Oppo) | aggressive battery managers kill background tabs |
| Screen pinning / kiosk launcher | a cleaner must not be able to browse away |
| Camera permission denied | sign-in must still record, without a photo |
| Wi-Fi dropped mid-punch | "No connection… check the tablet's Wi-Fi", nothing lost |
| Wi-Fi → mobile data switch | session token survives |
| Device restarted | the tablet is still paired (token is in localStorage) |
| Plain `http://` origin | camera silently blocked — the reason HTTPS is required |
| Screen size 8" and 10" | keypad reachable one-handed |
| Left idle overnight | auto-return to the idle screen, clock still ticking |

If we ever ship a real APK (rather than a home-screen shortcut), add: install /
update / uninstall, signing config, and Play Store policy review.

## 11. Web testing — partly automated

Automated: desktop Chromium across every route; a mobile Pixel 7 project for
`*.mobile.spec.ts`. Manual before a release: **Safari on iPhone** (the
concierge's phone) and one desktop Safari pass — WebKit differs on date inputs,
`gap` in flex, and camera constraints, and we have no WebKit in CI yet.

Also manual: browser back/forward through a multi-step form, two tabs open on
the same store, and a session left idle past expiry.

## 12. Security testing — partly automated

Automated on every push:

- **`npm run check:secrets`** — greps every *tracked* file for credential
  shapes (Supabase secret keys, service-role JWTs, Resend/SendGrid/Twilio/AWS
  keys, private key blocks) and fails the build. Proven against a planted key.
- **`npm run check:deps`** — `npm audit` with explicit triage. High/critical
  fails unless the package is in `security/audit-allowlist.json` **with a
  reason and an expiry date**; an expired entry fails too, so nothing stays
  "temporarily accepted" forever.
- **The database suite** — the multi-org isolation proof, §6.

Structural protections worth knowing rather than re-testing ad hoc: RLS denies
by default, `SUPABASE_SECRET_KEY` never carries a `NEXT_PUBLIC_` prefix (that
prefix publishes a value to every visitor), secrets live in Vault and are never
returned to the client, and SQL injection is largely designed out by
parameterised RPCs rather than string-built SQL.

**Not yet done, and worth doing before real client data:** a penetration test,
and a deliberate cross-org probe by a human with two real accounts.

## 13. Performance and load testing — manual, triggered by change

Not automated yet. Do it when a change plausibly affects volume:

- 40 cleaners punching within the same five minutes (shift change)
- a building with 500 tickets and two years of attendance — do the list
  queries still return under 300 ms?
- 50 photo uploads in a burst
- the Scope explorer with a much larger agreement

`explain analyze` on the query behind any screen that starts feeling slow beats
guessing. The indexes on `attendance_events(building_id, at desc)` and
`(staff_id, at desc)` exist for exactly these access patterns.

## 14. Reliability and failure testing — partly automated

Covered by design and asserted in the kiosk specs: a lost connection is a
friendly message and no lost data; a failed selfie upload does not cost the
cleaner their attendance record; a retired device token stops working
instantly.

Manual drills worth running once a quarter: Supabase unreachable (pause the
project) — does the app say something honest? Storage slow — does the punch
still complete? Duplicate submit — does it create two records?

## 15. User acceptance testing — manual, on staging

Real people, real procedures, on a deployed environment with its own Supabase
project (never production data):

- **Cleaner** — sign in and out on the actual tablet in the actual room
- **Cleaning manager** — add a cleaner, hand out a PIN, reset a forgotten one,
  approve a week of timesheets
- **Concierge** — raise a ticket, book an amenity
- **Building manager** — check they see completion status and *not* payroll
- **Company admin** — switch a theme, configure an email provider

The isolation question is a UAT question too: sit the concierge and the
cleaning manager side by side and confirm each genuinely cannot see the
other's data.

## 16. Exploratory testing — manual

Half an hour of deliberate misuse per release, by someone who didn't write the
feature. The reliably productive moves: double-tap every submit, leave a form
half-finished and navigate away, change a permission while a screen is open,
rotate the tablet mid-selfie, paste a 200-character resident name, set the
device clock forward a day, go offline during a submit.

## 17. Environments

| Environment | What it is | Data |
|---|---|---|
| Local | `npm run dev`, demo stores | seeded demo |
| Preview | every branch, auto-deployed by Vercel | its own Supabase project |
| Staging | `main`, production-like | anonymised or synthetic only |
| Production | the client's live site | real |

Production data is never copied down un-anonymised. `.env.local` never leaves
the machine — and because Vercel inlines `NEXT_PUBLIC_*` at **build** time, a
changed key needs a **redeploy**, not just a dashboard edit (`docs/DEPLOY.md`).

## 18. Controlled release — manual

We are pre-launch, so the rollout is by building, not by percentage:

1. Internal — the demo building, us using it daily
2. One pilot building, one module (CleaningOps), with us on call
3. That building's full module set
4. Additional buildings, one at a time

The kiosk gets its own gate: pair one tablet in one cleaners' room for a week
before any second building. `NEXT_PUBLIC_*_LIVE` flags already let a module go
live per environment without shipping different code.

## 19. Production monitoring — to build

The gap to close before real clients. What matters here specifically:

- failed punches and failed selfie uploads (a cleaner's pay depends on them)
- sign-in failure rate (the owner lost three days to one of these)
- Supabase error rate and slow queries
- tablets that stop reporting — `kiosk_devices.last_seen` already records
  this, so "no punch from the cleaners' room since 06:00" is an alert we can
  build from data we already keep

Until then: `audit_logs`, `notification_log` and Vercel's own logs are the
record, and the Attendance tab is the daily human check.

## 20. Rollback and recovery — partly ready

| Question | Today |
|---|---|
| Roll back the web app? | Yes — Vercel keeps every deployment; promote the previous one |
| Roll back a migration? | **Partly.** Migrations are additive and idempotent; there are no `down` scripts. Destructive changes need one written before they ship. |
| Disable a feature remotely? | Yes for module-level flags (`NEXT_PUBLIC_*_LIVE`, building_modules status) |
| Restore a backup? | Supabase takes daily backups on paid plans — **untested by us** |

**A backup that has never been restored is not a backup.** Do one restore drill
into a scratch project before the first client's data lands, and write the date
here.

---

## The release gate

Nothing ships to a client building until every line is true. The automated ones
are green or red in CI; the manual ones are a human saying yes.

- [ ] Code reviewed by someone other than the author *(manual)*
- [ ] `npm run verify` green — tokens, contrast, types, lint, unit, secrets, deps, build *(automated)*
- [ ] `npm run test:db` green — 81 isolation assertions, bundle applies and re-applies *(automated)*
- [ ] `npm run test:e2e` green — routes, kiosk, service desk *(automated)*
- [ ] `APPLY_EVERYTHING.sql` regenerated and committed *(automated check)*
- [ ] New behaviour has tests; every fixed bug has a test *(manual)*
- [ ] Migration reviewed for destructive changes; rollback plan written if any *(manual)*
- [ ] Android kiosk matrix run if the kiosk changed *(manual)*
- [ ] Safari checked if the UI changed *(manual)*
- [ ] Staging UAT by the affected role *(manual)*
- [ ] Backup restore confirmed within the last quarter *(manual)*
- [ ] Rollout plan: which building first, who is watching, how to turn it off *(manual)*
- [ ] `docs/PROJECT_STATE.md` and `docs/DECISIONS.md` updated *(manual)*

## Where we honestly stand

| Layer | State |
|---|---|
| Static checks, secrets, dependency triage | automated |
| Unit tests | automated, 48 assertions on the maths that matters |
| Database + RLS isolation | automated, 81 assertions incl. idempotency |
| End-to-end journeys | automated, demo mode, production build |
| Component tests | **not started** |
| Live-mode e2e (real Supabase) | **manual on staging** |
| Android device matrix | **manual, matrix defined above** |
| Safari / WebKit | **manual — no WebKit in CI** |
| Load and performance | **manual, change-triggered** |
| Penetration test | **not done** |
| Production monitoring and alerting | **not built** |
| Backup restore drill | **never run** |

The last four are the ones to close before a paying client's data is in here.
