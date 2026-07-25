# Deploying (Vercel) — and why the live site needs its own keys

## The one thing that trips everyone up

`.env.local` **never leaves your computer**. It is gitignored, so it is not in
the repository and Vercel never sees it. The live site needs its own copy of
the same values, entered in Vercel's dashboard.

And — exactly like the local dev server — **Vercel bakes `NEXT_PUBLIC_*`
values into the browser bundle at BUILD time**. Changing a variable in the
dashboard does nothing to the site that is already live: you must **redeploy**
afterwards. A site showing "Invalid API key" while `npm run check:supabase`
passes locally is almost always this.

## First deploy

1. https://vercel.com → **Continue with GitHub** → **Add New… → Project** →
   import `foct-build-ops`.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_…`) |

   Tick **all** environments (Production, Preview, Development) so branch
   previews work too.
3. **Deploy.** Two minutes later you have a permanent HTTPS URL.

The safest source for those two values is the `.env.local` that already works
on your machine — print it and copy from there:

```powershell
Get-Content .env.local        # Windows
```
```bash
cat .env.local                # macOS / Linux
```

## Changing a key later (or fixing a wrong one)

1. Vercel → your project → **Settings → Environment Variables** → edit the value.
2. **Deployments** tab → the most recent deployment → **⋯ → Redeploy**
   (untick "use existing build cache" if offered).
3. Hard-refresh the site (Ctrl+Shift+R / Cmd+Shift+R).

Skipping step 2 leaves the old value baked into the live bundle.

## Server-only secrets

`SUPABASE_SECRET_KEY` (used by the integrations routes) goes in the same place
but must **never** be given a `NEXT_PUBLIC_` name — that prefix publishes the
value to every visitor's browser. Only add it when live integration sends are
needed, alongside `NEXT_PUBLIC_INTEGRATIONS_LIVE=1`.

## Why deploying is worth it

- One URL for every machine, phone and the cleaners-room iPad — no local
  servers, no `.env.local` per machine.
- HTTPS, so the kiosk **selfie camera works** on the iPad (browsers block
  camera access on plain-HTTP origins).
- Every merge to `main` redeploys automatically.
