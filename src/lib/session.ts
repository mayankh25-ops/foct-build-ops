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
  if (error || !data?.user) return null;
  return {
    userId: data.user.id as string,
    name: (data.user.name as string) ?? "",
    email: (data.user.email as string) ?? "",
    memberships: (data.memberships ?? []) as SessionMembership[],
    buildings: (data.buildings ?? []) as SessionBuilding[],
  };
}

let initialised = false;

/** Mount once (AppShell). Resolves the session and follows auth changes. */
export function useSessionInit(): void {
  React.useEffect(() => {
    if (!isSupabaseConfigured || initialised) return;
    initialised = true;
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

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured) return;
  await getSupabase().auth.signOut();
}

/** The org the app should act as — session org in live mode, else the demo pin. */
export function activeOrgIdOr(fallback: string): string {
  const { status, activeOrgId } = useSessionStore.getState();
  return status === "ready" && activeOrgId ? activeOrgId : fallback;
}
