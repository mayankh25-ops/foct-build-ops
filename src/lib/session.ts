"use client";

/**
 * Stage 2 phase 1 — the signed-in session. After auth, the app calls the
 * `current_profile()` RPC (0006) once to learn who the user is: profile,
 * org memberships (org + role), and the buildings those orgs service.
 *
 * DEMO FALLBACK: when Supabase env is absent (this build sandbox, fresh
 * clones) status is "demo" and every screen keeps running on its local
 * demo stores with the seeded Priya persona — nothing redirects, nothing
 * breaks. Live mode ("ready"/"signed-out") only activates when
 * NEXT_PUBLIC_SUPABASE_* env is configured.
 */
import * as React from "react";
import { create } from "zustand";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export interface SessionMembership {
  org_id: string;
  org_name: string;
  org_slug: string;
  org_type: string;
  role: string;
  role_name: string;
}

export interface SessionBuilding {
  id: string;
  name: string;
  slug: string;
}

export interface SessionProfile {
  userId: string;
  name: string;
  email: string;
  memberships: SessionMembership[];
  buildings: SessionBuilding[];
}

export type SessionStatus = "demo" | "loading" | "signed-out" | "ready";

interface SessionState {
  status: SessionStatus;
  profile: SessionProfile | null;
  /** the membership the UI acts as (first one until an org switcher lands) */
  activeOrgId: string | null;
  setFromProfile: (p: SessionProfile | null) => void;
  setStatus: (s: SessionStatus) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: isSupabaseConfigured ? "loading" : "demo",
  profile: null,
  activeOrgId: null,
  setFromProfile: (p) =>
    set({
      profile: p,
      activeOrgId: p?.memberships[0]?.org_id ?? null,
      status: p ? "ready" : "signed-out",
    }),
  setStatus: (s) => set({ status: s }),
}));

async function loadProfile(): Promise<SessionProfile | null> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return null;
  const { data, error } = await supabase.rpc("current_profile");
  if (error || !data?.user) {
    // authenticated but no linked profile row yet — stay signed in with a
    // minimal identity instead of bouncing back to /sign-in in a loop
    const email = sess.session.user.email ?? "";
    return {
      userId: sess.session.user.id,
      name: email.split("@")[0] ?? "Account",
      email,
      memberships: [],
      buildings: [],
    };
  }
  return {
    userId: data.user.id as string,
    name: (data.user.name as string) ?? "",
    email: (data.user.email as string) ?? "",
    memberships: (data.memberships ?? []) as SessionMembership[],
    buildings: (data.buildings ?? []) as SessionBuilding[],
  };
}

let initialised = false;

/**
 * "Continue to the demo without signing in".
 *
 * On a deployment with no Supabase env the status is already "demo" and
 * nothing redirects. On a CONFIGURED one it is "signed-out", and AppShell
 * sends every signed-out visitor to /sign-in -- so that link bounced straight
 * back to the page it was clicked on, which read as the button doing nothing.
 * This flag is the visitor saying "I know, show me the demo anyway".
 *
 * sessionStorage, so it is scoped to the tab and cannot outlive the browsing
 * session and quietly put a real signed-in user back on demo data. Reads and
 * writes are guarded: a private window can throw on access.
 */
const DEMO_OPT_IN = "foct-demo-opt-in";

export function isDemoOptIn(): boolean {
  try {
    return sessionStorage.getItem(DEMO_OPT_IN) === "1";
  } catch {
    return false;
  }
}

export function enterDemoMode(): void {
  try {
    sessionStorage.setItem(DEMO_OPT_IN, "1");
  } catch {
    // storage blocked: the status below still carries this tab
  }
  useSessionStore.getState().setStatus("demo");
}

/** Leaving the demo: /sign-in calls this, so signing in for real always wins. */
export function exitDemoMode(): void {
  if (!isDemoOptIn()) return;
  try {
    sessionStorage.removeItem(DEMO_OPT_IN);
  } catch {
    // nothing to undo
  }
  // the demo path returns before wiring the auth listener, so let the next
  // AppShell mount resolve the session properly
  initialised = false;
  useSessionStore.getState().setStatus(isSupabaseConfigured ? "loading" : "demo");
}

/** Mount once (AppShell). Resolves the session and follows auth changes. */
export function useSessionInit(): void {
  React.useEffect(() => {
    if (!isSupabaseConfigured || initialised) return;
    initialised = true;
    // the visitor chose the demo over signing in -- honour it for this tab
    if (isDemoOptIn()) {
      useSessionStore.getState().setStatus("demo");
      return;
    }
    const { setFromProfile } = useSessionStore.getState();
    void loadProfile().then(setFromProfile);
    const { data: sub } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setFromProfile(null);
      else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
        void loadProfile().then(setFromProfile);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
}

/**
 * Re-read the profile after something changes what the signed-in person can
 * reach — creating a site, accepting an invitation, being added to a building.
 *
 * Without this, `site_create()` succeeds, the row exists, and every screen that
 * reads `profile.buildings` still believes there are none until the next full
 * reload. That gap is indistinguishable from the create having failed.
 */
export async function refreshProfile(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const p = await loadProfile();
  useSessionStore.getState().setFromProfile(p);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await getSupabase().auth.signOut();
}

/** The org the app should act as — session org in live mode, else the demo pin. */
export function activeOrgIdOr(fallback: string): string {
  const { status, activeOrgId } = useSessionStore.getState();
  return status === "ready" && activeOrgId ? activeOrgId : fallback;
}
