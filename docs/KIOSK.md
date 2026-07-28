# The kiosk, end to end — who creates what

The kiosk is the tablet in the cleaners' room. A cleaner finds their name,
types a 4-digit PIN, a 3-2-1 selfie is taken, and the sign-in lands in the
office system where a manager turns it into a timesheet.

This page covers the whole chain: who creates the building, who creates the
cleaners, how a PIN is issued, how a tablet is paired, and how to put it on an
Android device.

## Who creates what

| Thing | Created by | Where |
|---|---|---|
| Organisations, buildings, module switches | You (once per client) | `supabase/NEW_BUILDING.sql` |
| Logins (email + password) | You | Supabase → Authentication → Users → **Add user** (tick *Auto Confirm User*) |
| Cleaners + their kiosk PINs | Cleaning manager, in the app | Settings → **Cleaners & kiosks** → Cleaners |
| Kiosk tablets + pair codes | Cleaning manager, in the app | Settings → **Cleaners & kiosks** → Kiosk tablets |
| Sign-ins / sign-outs | The cleaners themselves | the tablet |

Only the first two rows need SQL, and only until the onboarding screens land
(Stage 2 phase 8). Everything a building does day to day is already
self-service in the app.

## 1. One-time setup for a building

1. **Apply the schema** — Supabase SQL editor → paste `supabase/APPLY_EVERYTHING.sql` → Run.
   (Already applied an earlier version? Paste `supabase/APPLY_STAGE2_PHASE2.sql`
   instead — it adds just the attendance and kiosk parts.)
2. **Create the logins** — Authentication → Users → Add user, one per person.
3. **Create the building** — edit the six values at the top of
   `supabase/NEW_BUILDING.sql`, paste, Run. It creates the owner org, the
   cleaning org, the building, the module switches, and your membership.
4. **Check it** — `supabase/tests/kiosk_isolation_check.sql` should print 19 `ok`
   notices. It creates two test cleaners and a test tablet on the demo
   building; delete them from the Cleaners tab afterwards if you don't want them.

## 2. Add cleaners and hand out PINs

Settings → **Cleaners & kiosks** → Cleaners → **Add cleaner**.

The system generates the PIN — nobody types one in. That is deliberate:

- **PINs are unique per building.** Two cleaners can never end up sharing one.
- **Trivial PINs never come up.** No `0000`, `1234`, `1111`.
- **The PIN is shown once.** It is not stored anywhere a person can read it —
  not in the app, not in a report, not by you. If a cleaner forgets it, use
  **Reset PIN**, which issues a new one and kills the old one immediately.

Someone leaving? **Deactivate** them. Their PIN stops working at the kiosk that
second, and their history stays intact for payroll.

## 3. Pair the tablet

Settings → **Cleaners & kiosks** → Kiosk tablets → **Add tablet**. You get a
6-digit code, valid for 24 hours.

On the tablet, open `https://<your-site>/kiosk` and type the code in. That's the
whole setup — the tablet remembers the building forever after and never needs a
login.

What the tablet can actually do once paired, and nothing more:

- search cleaner **names** at its own building
- record a check-in or check-out
- attach the selfie it just took

It cannot read rosters, timesheets, other buildings, or anyone's PIN. Even if
the tablet is stolen and taken apart, the token inside it buys none of that —
and **Retire** kills it on the spot. To move a tablet to a different building,
retire it, then pair it again from the new building's page.

## 4. The Android tablet

Any Android tablet on the building Wi-Fi works. Three ways to get it on screen,
in the order I'd try them:

1. **Chrome → Add to Home screen.** The kiosk is a normal web page; the shortcut
   opens it full-screen with no address bar. Zero build, updates automatically.
   Pair with Android's own **screen pinning** (Settings → Security → App pinning)
   so cleaners can't wander off the page.
2. **A managed kiosk launcher** (Fully Kiosk Browser and similar) if you want
   auto-restart, scheduled reboots and a locked-down home screen. Point it at
   the same URL.
3. **A WebView APK** — a thin Android wrapper around the same URL — if you want
   it in a store or want the FOCT icon on the launcher. Nothing about the kiosk
   changes; it is the same page in a native shell.

Whichever you choose:

- **HTTPS is required for the camera.** Android blocks `getUserMedia` on plain
  HTTP, so the selfie silently won't work on a bare `http://192.168.x.x` address.
  Use the deployed site (see `docs/DEPLOY.md`).
- Grant the camera permission once, on first sign-in.
- If the camera is unavailable, the sign-in **still records** — just without a
  photo. Attendance is never blocked by hardware.

## 5. Where the hours go

Every punch is stored as an attendance event with its time, its device, and its
selfie. `attendance_sessions()` pairs each check-in with its check-out and
returns worked minutes — that's what Settings → Cleaners & kiosks →
**Attendance** shows, and it is the same data the timesheet screen is being
moved onto.

An unpaired check-in (someone forgot to check out) shows as **Still on site**
rather than silently disappearing, so a manager can correct it.

## Troubleshooting

| What you see | What it means |
|---|---|
| "Pair code not recognised or expired" | Codes are single-use and last 24 hours. Issue a new one with **New pair code**. |
| "PIN not recognised" | Wrong PIN, or the cleaner was deactivated. Check the Cleaners tab. |
| "You are already checked in" | A check-out is missing. The cleaner should use **Check out**; a manager can correct the record. |
| "No connection to the office system" | The tablet lost Wi-Fi. Nothing is lost — try again once it's back. |
| Camera never appears | The page is on `http://`, not `https://`, or permission was denied. |
| "This tablet's configuration is out of date" | The site's Supabase keys changed and it hasn't been redeployed — see `docs/DEPLOY.md`. |
