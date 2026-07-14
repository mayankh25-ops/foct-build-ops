"use client";

/**
 * Typed wrapper for app.can(user, org, building, module, action) — the single
 * authorisation function every core RLS policy routes through (0004).
 *
 * SECURITY POSTURE:
 * - With Supabase configured, the ONLY authority is the database function.
 * - Without Supabase (local design review), can() returns FALSE unless the
 *   explicit env flag NEXT_PUBLIC_AUTHZ_DEMO_ALLOW_ALL=1 is set at build
 *   time. The flag defaults OFF, is named to be un-mistakable in a prod env
 *   file, and logs a loud warning on every page load while enabled.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type AuthzAction = "read" | "manage" | "admin";

export interface CanScope {
  org?: string;
  building?: string;
  module?: string;
}

const DEMO_ALLOW_ALL = process.env.NEXT_PUBLIC_AUTHZ_DEMO_ALLOW_ALL === "1";

let warned = false;
function warnDemoMode() {
  if (warned || typeof window === "undefined") return;
  warned = true;
  console.warn(
    "%c[authz] NEXT_PUBLIC_AUTHZ_DEMO_ALLOW_ALL=1 — every can() check returns TRUE. " +
      "This must NEVER be set in a deployed environment.",
    "color: white; background: red; font-weight: bold; padding: 2px 6px;"
  );
}
if (DEMO_ALLOW_ALL) warnDemoMode();

/**
 * Ask the database whether the CURRENT user may act on the given scope.
 * Fails closed: no session, no Supabase, or an RPC error all return false
 * (unless the explicit demo flag is on).
 */
export async function can(action: AuthzAction, scope: CanScope = {}): Promise<boolean> {
  if (!isSupabaseConfigured) {
    if (DEMO_ALLOW_ALL) {
      warnDemoMode();
      return true;
    }
    return false;
  }
  try {
    const supabase = getSupabase();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return false;
    const { data, error } = await supabase.rpc("can", {
      p_user: userId,
      p_org: scope.org ?? null,
      p_building: scope.building ?? null,
      p_module: scope.module ?? null,
      p_action: action,
    });
    if (error) {
      console.warn("[authz] can() rpc failed — denying:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.warn("[authz] can() threw — denying:", e);
    return false;
  }
}
