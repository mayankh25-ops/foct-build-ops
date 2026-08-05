"use client";

/**
 * Signing in (0015). Two ways in, and one thing that happens after both.
 *
 * MAGIC LINK is the default: there is no password to set, forget, or hand out,
 * and for a product where most people sign in from a phone once a fortnight
 * that is the right trade. A password remains available because magic links
 * depend on email delivery, and a supervisor locked out at 5am needs a way in
 * that does not involve an inbox.
 *
 * `claim_access()` runs after EITHER path. It is what turns an account into
 * access: the profile row, any invitation waiting for that address, and — on a
 * project nobody has ever signed in to — the first-arrival bootstrap. Before
 * this existed, a correct password signed you in to nothing and the fix was
 * hand-written SQL.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ClaimOutcome {
  ok: boolean;
  claimed?: number;
  bootstrapped?: boolean;
  has_access?: boolean;
  error?: string;
}

/** Where a magic link should land. Absolute, because the email opens fresh. */
export function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase env is not configured for this deployment." };
  }
  const { error } = await getSupabase().auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: callbackUrl(),
      // An account is created if there isn't one, because on a brand-new
      // project the FIRST person has no account yet and requiring one would
      // send them back to the dashboard to hand-make it — the manual step this
      // whole flow exists to remove. Creating an account grants nothing on its
      // own: `claim_access()` gives the first arrival the project and every
      // later uninvited one an explicit "ask an admin".
      shouldCreateUser: true,
    },
  });
  if (error) return { ok: false, error: explainAuthError(error.message) };
  return { ok: true };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase env is not configured for this deployment." };
  }
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: explainAuthError(error.message) };
  return { ok: true };
}

/**
 * Turns an account into access. Safe to call more than once — invitations are
 * single-use server-side, and the bootstrap only ever fires once per project.
 */
export async function claimAccess(): Promise<ClaimOutcome> {
  if (!isSupabaseConfigured) return { ok: false, error: "not configured" };
  const { data, error } = await getSupabase().rpc("claim_access");
  if (error) return { ok: false, error: error.message };
  return (data as ClaimOutcome) ?? { ok: false, error: "no answer" };
}

/**
 * Raw auth errors are cryptic, and two of them mean OPPOSITE things:
 * "Invalid API key" is a configuration fault (the password was never checked),
 * "Invalid login credentials" is the password itself. Say which, and what to do.
 */
export function explainAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("api key")) {
    const ref =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\./i)?.[1] ?? "your project";
    return `Configuration problem, not your password: this app's key was rejected by Supabase project "${ref}". If you just changed the environment variables, redeploy — they are baked in at build time.`;
  }
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account here. Try the emailed link instead — it works even when no password has been set.";
  }
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "This account hasn't been confirmed yet. Use the emailed link — opening it confirms the address and signs you in.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts for now. Supabase limits how many sign-in emails a project can send per hour; wait a few minutes, or use a password.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "This project has sign-ups disabled, so a link can only be sent to an address that already exists. Ask an admin to invite you, or add the account in Supabase → Authentication → Users.";
  }
  if (m.includes("failed to fetch") || m.includes("load failed")) {
    return "Couldn't reach Supabase. Check your connection, and that the project isn't paused.";
  }
  return raw;
}

/**
 * What to tell someone whose sign-in worked but who has no access yet. This is
 * the state that used to look like a broken product.
 */
export function accessMessage(outcome: ClaimOutcome): string | null {
  if (!outcome.ok) return null;
  if (outcome.has_access) return null;
  return "You're signed in, but nobody has given this address access to a site yet. Ask an admin to invite you from Settings → People — you'll get in the moment they do.";
}

/**
 * When `claim_access()` itself FAILED, rather than reporting no access.
 *
 * This is the gap that made "login is still broken" so hard to pin down: the
 * callback asked `accessMessage()` for something to say, got null (because the
 * outcome was not ok at all), and redirected to the dashboard anyway. The
 * person landed on an empty app having been told nothing — and the actual
 * cause, an RPC that is not in their database, was sitting in a rejected
 * promise nobody read.
 *
 * The missing-function case is the one that matters and it has a named fix, so
 * it gets its own sentence.
 */
export function claimFailureMessage(outcome: ClaimOutcome): string | null {
  if (outcome.ok) return null;
  const raw = outcome.error ?? "";
  if (/could not find the function|does not exist|42883|PGRST202/i.test(raw)) {
    return "Your email and link are fine — this project's database is missing the sign-in setup. Open Supabase → SQL Editor and run supabase/APPLY_EVERYTHING.sql, then open the link again. (Settings → System health lists exactly what's missing.)";
  }
  if (/jwt|token/i.test(raw)) {
    return "The link signed you in but the session was rejected. Ask for a fresh link and open it in this browser.";
  }
  return `You're signed in, but setting up your access failed: ${raw}`;
}
