# Kiosk Sign-in — module PRD and build prompt (v1)

> Owner brief, 2026-07-27. This is the finalised spec for the first shippable product:
> **an admin app and a tablet kiosk**, nothing else. It is written to be handed to a
> builder verbatim — the "Build prompt" section at the end is copy-pasteable.
>
> Roughly 40% of this already exists (migration `0007`, `/kiosk`, `/settings/staff`).
> Each section marks **[built]**, **[extend]** or **[new]** so nothing is rewritten by
> accident and nothing is assumed done that isn't.

---

## 1. What it is

Two surfaces over one database.

| Surface | Who | Where it runs |
|---|---|---|
| **Admin** | site/cleaning managers | web app, desktop and phone browser |
| **Kiosk** | cleaners, on arrival and departure | a wall-mounted iPad or Android tablet in the cleaners' room |

The admin creates sites, employees and the day's notices. The cleaner walks up to the
tablet, finds their name or types a 4-digit PIN, a 3-2-1 selfie is taken, they are signed
in, and their notices appear. That is the entire product. Everything else — timesheets,
rosters, reporting — consumes what this produces.

**The one hard requirement that shapes every decision below: the tablet must work with no
internet.** A cleaners' room is a basement with concrete walls. Sign-in cannot fail
because the Wi-Fi did; it queues locally and syncs when the network returns.

---

## 2. Flows

### 2.1 Kiosk — sign in / sign out

```
Idle screen (clock, site name, today's general notices scrolling)
   │
   ├─ [Find my name] → type 2+ letters → tap your name  ──┐
   └─ [Enter PIN]    → 4 digits                          ─┤
                                                          ▼
                                              PIN verified (locally offline,
                                              server when online)
                                                          ▼
                                     "Look at the camera"  3 · 2 · 1 · flash
                                                          ▼
                                   ✓ Signed in, Marcus — 06:04
                                   Your notes for today:
                                     • Loading dock closed until 06:30
                                     • [personal] See Priya about your roster
                                                          ▼
                                     auto-return to idle after 8 seconds
```

Rules:

- **Name search never reveals a PIN** and never lists who is on site. [built]
- **PIN must match the selected name** when a name was chosen. [built]
- Already signed in → "You're already signed in — use Sign out when you leave." [built]
- Sign out with no open shift → "There's no shift to sign out of." [built]
- **Camera unavailable or permission denied → the sign-in still records**, without a
  photo. Attendance is never blocked by hardware. [built]
- A cleaner may re-read their notices without signing in again: **[Today's notes]** on the
  idle screen asks for a PIN and shows notices without punching. [new]
- Everything is reachable in **≤3 taps** and readable from 1.5 m away.

### 2.2 Admin

| Task | State |
|---|---|
| Create a **site** (name, address, timezone, logo, theme) | **[new]** — SQL-only today (`NEW_BUILDING.sql`) |
| Add an **employee**, system-generated 4-digit PIN shown once | [built] |
| Reset a PIN / deactivate an employee | [built] |
| Provision a **tablet** with a 6-digit pair code; retire a lost one | [built] |
| Write **notices** — site-wide or for one employee, with date ranges and languages | **[new]** |
| See **who is on site right now** and today's sign-ins with selfies | [extend] |
| Export attendance | [extend] |

---

## 3. Notices — the new domain object

Two kinds, one table:

1. **General** — everyone at the site sees it. "Loading dock closed until 06:30."
   Scrolls on the idle screen *and* appears after sign-in.
2. **Personal** — one employee. Shown only to them, only after they sign in.
   "See Priya about your roster." Never displayed on the idle screen.

Each notice carries:

- **Effective window** — `starts_on` / `ends_on` (null = open-ended), plus an optional
  daily time window for shift-specific notes ("morning shift only").
- **Priority** — `info` / `important` / `urgent`. Urgent renders on a warning surface and
  is read out loud by the tablet if speech is available.
- **Acknowledgement** — optional `requires_ack`. When set, the cleaner must tap
  "I've read this" before the screen returns to idle, and the tap is recorded with a
  timestamp. *This is the hook the future induction module hangs on.*
- **Translations** — `body` is a JSON map of language code → text:
  `{"en": "Loading dock closed until 06:30", "hi": "लोडिंग डॉक 06:30 तक बंद है"}`.

### Multi-language display

The tablet **cycles** the languages a notice has, ~6 seconds each, with a small language
chip (EN / हिं / 简) so nobody thinks the screen is glitching. Order is
`site.default_language` first, then the rest alphabetically.

- Admin types each language by hand in v1 — a tab per language on the notice form.
- Machine translation is a **later** adapter behind the existing integrations framework
  (same pattern as email/SMS providers), never hardcoded to one vendor.
- **Fonts matter**: Devanagari needs `Noto Sans Devanagari`, CJK needs `Noto Sans SC`.
  Self-host the subsets used; do not rely on the system stack for non-Latin scripts.
- Launch languages: **English, Hindi, Punjabi, Nepali, Simplified Chinese** — the five
  most common on Melbourne CBD cleaning crews. The schema takes any BCP-47 code.

---

## 4. Offline-first — the part that must be got right

### 4.1 Principle

The tablet is the source of truth for *what happened*; the server is the source of truth
for *who exists*. So:

- **Reference data** (employees, PINs, notices, site) is **pulled and cached** whenever
  the tablet is online, and used from cache when it isn't.
- **Events** (sign-in, sign-out, acknowledgement, selfie) are **written locally first**,
  always, and pushed when a connection exists. The cleaner never waits for the network.

### 4.2 How

| Concern | Approach |
|---|---|
| Local store | **IndexedDB** via Dexie — `employees`, `notices`, `outbox`, `selfies`, `meta` |
| Queue | An **outbox** table: every punch is a row with a client-generated `client_event_id` (UUID v4) |
| Sync | On reconnect, on app focus, and every 60 s: POST the outbox oldest-first, delete rows the server confirms |
| Duplicates | The server upserts on `client_event_id` — replaying the same event is a no-op, so a flaky connection can never double-punch someone |
| Ordering | Events carry their own timestamps; late arrival never reorders history |
| Selfies | The photo is a **Blob in IndexedDB**, uploaded separately after the event syncs, then attached (`kiosk_attach_selfie` already exists). Compressed to ≤200 KB before storing |
| PIN check offline | The cache stores a **salted hash** of each PIN (Argon2id or bcrypt), never the PIN. Offline the tablet compares hashes; online the server decides. A stolen tablet yields hashes, not credentials |
| Clock | Every event records `device_time`, plus `server_offset_ms` learned at the last sync. Events created offline are flagged `offline: true` so a manager can see which times came from an unsynced device |
| Cache freshness | If reference data is older than **7 days**, the idle screen shows an amber "This tablet hasn't synced since Tuesday — tell your supervisor" strip. It keeps working; it just stops pretending it's current |
| Storage limits | The outbox is capped at 5,000 events and selfies at 500 MB; beyond that the oldest *selfies* are dropped (never the events) and a warning is raised |

### 4.3 What is deliberately NOT available offline

Say it in the UI rather than failing silently:

- **Pairing a new tablet** needs the network — it's a one-time setup step.
- **A brand-new employee** added minutes ago won't be on the tablet until it syncs. The
  admin screen warns: "This tablet last synced 3 hours ago — they may need to wait or use
  the manual sign-in sheet."
- **Sign-out of a shift that began on a different tablet** resolves server-side at sync.

### 4.4 Acceptance test for offline (must pass on real hardware)

1. Sign in normally, confirm it appears in admin.
2. Put the tablet in flight mode.
3. Sign in three different people, one with a selfie skipped.
4. Sign one of them out.
5. Force-quit the app; restart it. **The four events are still queued.**
6. Restore Wi-Fi. Within 60 s all four appear in admin with correct times, selfies
   attached, and each flagged as recorded offline.
7. Re-run the sync twice more: **no duplicates appear.**

---

## 5. Data model

Existing (migration `0007`) — reused as-is: `staff`, `kiosk_devices`, `attendance_events`,
`roster_shifts`, plus the RPCs `kiosk_pair`, `kiosk_staff_search`, `kiosk_punch`,
`kiosk_attach_selfie`, `staff_create`, `staff_reset_pin`, `kiosk_device_create`,
`attendance_sessions`.

New in `0009_kiosk_notices.sql`:

```sql
-- one row per notice; body/title hold every translation
create table public.notices (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references public.buildings(id) on delete cascade,
  org_id        uuid not null references public.organisations(id) on delete cascade,
  -- null staff_id = general (everyone at this site); set = personal
  staff_id      uuid references public.staff(id) on delete cascade,
  title         jsonb not null default '{}'::jsonb,   -- {"en": "...", "hi": "..."}
  body          jsonb not null,                       -- {"en": "...", "hi": "..."}
  priority      text not null default 'info'
                check (priority in ('info','important','urgent')),
  starts_on     date not null default current_date,
  ends_on       date,                                 -- null = until removed
  start_min     int check (start_min between 0 and 1440),  -- optional daily window
  end_min       int check (end_min between 0 and 1440),
  requires_ack  boolean not null default false,
  active        boolean not null default true,
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create table public.notice_acks (
  id           uuid primary key default gen_random_uuid(),
  notice_id    uuid not null references public.notices(id) on delete cascade,
  staff_id     uuid not null references public.staff(id) on delete cascade,
  acked_at     timestamptz not null default now(),
  device_id    uuid references public.kiosk_devices(id) on delete set null,
  unique (notice_id, staff_id)
);
```

Changes to existing tables:

```sql
alter table public.buildings   add column if not exists timezone text not null default 'Australia/Melbourne';
alter table public.buildings   add column if not exists default_language text not null default 'en';
alter table public.staff       add column if not exists preferred_language text;
alter table public.staff       add column if not exists pin_hash text;   -- for offline verification
alter table public.attendance_events
  add column if not exists client_event_id uuid,          -- idempotency key
  add column if not exists recorded_offline boolean not null default false,
  add column if not exists device_time timestamptz;
create unique index if not exists attendance_client_event_idx
  on public.attendance_events (client_event_id) where client_event_id is not null;
```

New RPCs:

- `kiosk_bootstrap(p_token uuid)` → everything the tablet caches in one call: site,
  employees (id, name, pin_hash, preferred_language), active notices, server time.
- `kiosk_sync(p_token uuid, p_events jsonb)` → accepts a batch, upserts on
  `client_event_id`, returns per-event `{client_event_id, ok, error}`.
- `notice_ack(p_token uuid, p_notice uuid, p_staff uuid)` → records an acknowledgement.
- `notices_for_staff(p_token uuid, p_staff uuid)` → what to show after a sign-in.

**RLS**: identical rules to `0007`. Notices are readable by org members who service the
building; writable by `app.manages_staff_at()`. The kiosk touches them only through
definer RPCs and holds no table privileges — verify with new checks appended to
`kiosk_isolation_check.sql`.

---

## 6. Tech stack

Keep the existing platform; add only what offline demands.

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Both apps | **Next.js 15 + TypeScript** (already in place) | One codebase, one design system, one deploy. A separate native admin app would double the work for no user gain |
| Backend | **Supabase** — Postgres, RLS, Auth, Storage (already in place) | RLS is what makes multi-company isolation provable rather than promised |
| Kiosk local store | **Dexie (IndexedDB)** | localStorage is synchronous, ~5 MB, and cannot hold selfie blobs. SQLite via Capacitor would work but locks the kiosk to the native build |
| Offline shell | **Serwist** service worker, precache the kiosk route | The tablet must boot from a cold start with no network. `next-pwa` is unmaintained |
| Sync | Hand-rolled outbox + idempotency keys | Generic sync engines (PowerSync, ElectricSQL, RxDB) are excellent but assume bidirectional replication. Our data flows one way, and one direction of hand-written sync is ~200 lines we can debug at 6am |
| Android APK | **Capacitor** wrapping the same web app | Gives kiosk-mode control (screen pinning, immersive, auto-restart, camera permission at install). A TWA/Bubblewrap build is simpler but can't lock the device down. **The PWA "Add to Home screen" path stays supported** for sites that don't want an APK |
| iPad | Safari → Add to Home Screen, Guided Access on | Apple has no kiosk mode without MDM; Guided Access is the standard answer |
| Camera | `getUserMedia` + canvas capture (already working) | Same code in Safari, Chrome and the Capacitor WebView |
| State | Zustand (already in place) | Consistent with the rest of the app |
| i18n | `next-intl` for UI chrome; notice text is data, not translation keys | UI strings are ours to translate; notice bodies are the admin's |
| Tests | Vitest + Playwright + the SQL isolation suite (already in place) | See `docs/TESTING.md`; add the §4.4 offline scenarios |

**Prior art worth copying, honestly named:** Deputy and Connecteam for the PIN-and-photo
kiosk pattern; Sine and SwipedOn for visitor/induction flow and the "notices on arrival"
idea; Damstra for site inductions. What they all get right and we must too: **one screen,
one job, enormous touch targets, and never a spinner between the cleaner and their
sign-in.**

---

## 7. Design

### 7.1 Kiosk palette — "Dawn Shift"

A wall tablet in a fluorescent-lit basement is a different problem from a laptop screen.
It needs high contrast, low glare, and to look calm at 5am. Grounded in Radix Colors
scales so it drops into our existing token architecture — **no raw hex in components**.

| Token | Light (day) | Dark (night, after 18:00) | Reference |
|---|---|---|---|
| `--bg-canvas` | `#F7F7F5` | `#121311` | Radix Sand 1 / Sand 12 |
| `--bg-surface` | `#FFFFFF` | `#1C1E1B` | card surfaces |
| `--text-primary` | `#1A1D19` | `#F2F3F0` | Radix Sage 12 / Sage 1 |
| `--text-secondary` | `#5A6156` | `#A8B0A4` | — |
| `--accent` | `#2F6F4E` | `#4E9B72` | Radix Grass 9 — the "go" colour on every primary button |
| `--accent-subtle` | `#E4EFE7` | `#1F3128` | welcome pill, chips |
| `--success` | `#2F6F4E` | `#4E9B72` | signed in |
| `--warning` | `#B5730F` | `#E0A44A` | urgent notices |
| `--critical` | `#B3261E` | `#E5645C` | wrong PIN |

The tablet **switches to the dark set automatically after sunset** — the same screen at
5am and 8pm should not be the same brightness.

### 7.2 Type and layout

- **Clock: 96px, Barlow 700** (our `--font-stack-numeric`). It is the first thing the eye
  lands on and doubles as proof the tablet is alive.
- **Names and buttons: 24–28px, semibold.** Notices: 22px, line-height 1.5.
- **Every touch target ≥ 64px** on the kiosk — twice the 44px web minimum. Wet hands,
  gloves, no reading glasses.
- Keypad: 3×4 grid, each key 96×72px minimum, with a real press animation and a click
  sound. Silence makes people press twice.
- One accent-coloured element per screen. The primary action is always bottom-centre,
  where a thumb reaches on a mounted tablet.
- **Landscape and portrait both work.** Mounts vary.

### 7.3 Sounds and feedback

A soft click on each keypress, a rising two-tone on success, a low tone on refusal.
Muted by default in the admin's device settings for sites that want silence.

---

## 8. Inductions (future — build the hooks now, not the feature)

The induction module is the same shape as notices: content shown before someone starts
work, with a mandatory acknowledgement. Design for it now by:

- keeping `requires_ack` + `notice_acks` in v1 (already above),
- giving notices a `version` column so a re-issued induction re-prompts,
- storing content as a JSON body per language so slides/pages slot in later.

Do **not** build induction screens, quizzes, or certificates now.

---

## 9. Definition of done

- [ ] Admin can create a site, add employees with generated PINs, provision a tablet, and
      write general + personal notices in at least English and Hindi.
- [ ] A cleaner can sign in by name or PIN, take a 3-2-1 selfie, and see their notices,
      in under 15 seconds, with no training.
- [ ] The §4.4 offline scenario passes on a real Android tablet **and** a real iPad.
- [ ] Sign-ins appear in admin with selfie, time, device, and an offline flag where
      relevant.
- [ ] `npm run verify`, `npm run test:db` (with new notice isolation checks) and
      `npm run test:e2e` all green.
- [ ] The kiosk device matrix in `docs/TESTING.md` §10 has been run.
- [ ] A cleaner who has never seen the app signs in successfully without being told how.
      *(If they hesitate, the design is wrong, not the cleaner.)*

---

## 10. Build order

1. `0009_kiosk_notices.sql` + RLS + isolation checks *(a day)*
2. Admin: sites screen, notices screen with language tabs *(two days)*
3. Kiosk: Dexie cache + `kiosk_bootstrap`, so the tablet works read-only offline
4. Kiosk: outbox + `kiosk_sync` + offline selfie queue — **the risky part, do it third,
   not last**
5. Notices on the idle screen and after sign-in, with language cycling
6. Dawn Shift palette + kiosk type scale + sounds
7. Capacitor APK, screen pinning, camera permission at install
8. Offline acceptance run on real hardware; then pilot one room for a week

---

## 11. Build prompt (copy-paste)

> Build a two-surface staff sign-in system on Next.js 15 + TypeScript + Supabase
> (Postgres/RLS/Storage), extending an existing codebase that already has: `staff`,
> `kiosk_devices`, `attendance_events` tables with RLS; kiosk RPCs for pairing, name
> search, punching and selfie attachment; an admin screen for creating employees with
> system-generated 4-digit PINs and pairing tablets; and a kiosk page doing PIN entry and
> a 3-2-1 selfie.
>
> **Surface A — Admin (web).** Managers create sites (name, address, timezone, default
> language), employees (PIN generated by the system, shown once, resettable, never
> readable again), tablets (6-digit single-use pair code, retirable), and **notices**.
> A notice is either general (everyone at the site) or personal (one employee); has a
> date range and optional daily time window; a priority of info/important/urgent; an
> optional "must acknowledge" flag; and a body stored as a per-language JSON map so the
> same notice carries English, Hindi and others. The notice form has a tab per language.
>
> **Surface B — Kiosk (tablet).** A single full-screen route. Idle screen shows a large
> clock, the site name, and general notices scrolling with each language cycling every
> ~6 seconds behind a language chip. A cleaner either types their 4-digit PIN or searches
> their name (2+ letters, names only — never expose PINs or who is on site), then a
> 3-2-1 countdown selfie is captured, then they are signed in and shown their notices —
> general plus personal. Notices marked "must acknowledge" require a tap that is
> recorded. Auto-return to idle after 8 seconds. Sign-out is the same flow. If the camera
> is unavailable, the sign-in still records without a photo. Every touch target is at
> least 64px; everything is readable from 1.5 m; no screen takes more than three taps.
>
> **Offline is mandatory.** The tablet caches employees (with salted PIN hashes, never
> plaintext PINs), notices and site config in IndexedDB via Dexie, refreshed from a
> `kiosk_bootstrap` RPC whenever online. Sign-ins are written to a local outbox with a
> client-generated UUID and pushed via a `kiosk_sync` RPC on reconnect, on focus, and
> every 60 seconds; the server upserts on that UUID so replays can never double-punch.
> Selfies are stored as compressed blobs in IndexedDB and uploaded separately once their
> event syncs. Events record device time plus the last known server offset and are
> flagged as recorded offline. If the cache is more than 7 days stale, show an amber
> warning strip but keep working. A cold start with no network must still boot the kiosk
> — precache the route with a Serwist service worker.
>
> **Packaging.** Ship as a PWA (iPad: Add to Home Screen + Guided Access) and as an
> Android APK via Capacitor with screen pinning and camera permission granted at install.
> Same web codebase for both.
>
> **Design.** Kiosk palette "Dawn Shift" — off-white `#F7F7F5` canvas, `#1A1D19` text,
> `#2F6F4E` accent, with an automatic dark set after sunset (`#121311` canvas, `#4E9B72`
> accent). Clock at 96px in a DIN-style numeric face; names and buttons 24–28px semibold;
> notices 22px at 1.5 line-height. Self-host Noto Sans Devanagari for Hindi. Soft click
> on keypress, rising tone on success, low tone on refusal. All colour through CSS
> variable tokens — no raw hex in components.
>
> **Security.** PINs are generated, unique per site, never trivial (`0000`, `1234`,
> repeats), shown once and only resettable. The tablet holds a device token that grants
> exactly the kiosk RPCs and no table access. A retired device stops working instantly.
> Prove multi-organisation isolation with SQL tests that run as the real `anon` role, not
> as a superuser.
>
> **Done means:** a cleaner who has never seen it signs in unaided in under 15 seconds;
> three offline sign-ins survive a force-quit and appear exactly once after reconnect;
> and the whole thing has been run on a real Android tablet and a real iPad.
>
> Leave hooks for a future induction module — versioned content and the acknowledgement
> record — but build no induction screens.
