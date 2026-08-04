"use client";

/**
 * Who can sign in (0015) — the portal logins, not the cleaners with PINs.
 *
 * Access is granted by INVITING an email address. When that person signs in,
 * `claim_access()` turns the invitation into a membership. Nobody edits the
 * database to add a colleague, and nobody is added by typing a password into
 * somebody else's account.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const PEOPLE_LIVE = isSupabaseConfigured;

export interface OrgMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  role_name: string;
  last_seen_at: string | null;
  never_signed_in: boolean;
}

export interface OrgInvite {
  id: string;
  email: string;
  role: string;
  role_name: string;
  created_at: string;
  expires_at: string;
  expired: boolean;
}

/** What a manager may hand out. Ranked server-side too — this only shapes the form. */
export const INVITABLE_ROLES = [
  { value: "staff", label: "Staff — sees their own work" },
  { value: "manager", label: "Manager — rosters, timesheets, alerts" },
  { value: "org_admin", label: "Admin — everything, including people" },
];

export async function fetchPeople(
  orgId: string
): Promise<{ members: OrgMember[]; invites: OrgInvite[] }> {
  const { data, error } = await getSupabase().rpc("org_people", { p_org: orgId });
  if (error) throw new Error(error.message);
  const res = data as { ok: boolean; members?: OrgMember[]; invites?: OrgInvite[] } | null;
  if (!res?.ok) throw new Error("Could not load people");
  return { members: res.members ?? [], invites: res.invites ?? [] };
}

export async function invitePerson(args: {
  orgId: string;
  email: string;
  role: string;
  buildingId?: string | null;
}): Promise<{ ok: boolean; email?: string; error?: string }> {
  const { data, error } = await getSupabase().rpc("invite_create", {
    p_org: args.orgId,
    p_email: args.email,
    p_role_key: args.role,
    p_building: args.buildingId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean }) ?? { ok: false, error: "No answer from the server" };
}

export async function revokeInvite(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getSupabase().rpc("invite_revoke", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return (data as { ok: boolean }) ?? { ok: false, error: "No answer from the server" };
}

/** "invited 3 days ago · expires in 11 days" — plain, and honest when overdue. */
export function inviteAge(invite: OrgInvite, now = new Date()): string {
  if (invite.expired) return "expired — invite again";
  const days = Math.max(
    0,
    Math.round((new Date(invite.expires_at).getTime() - now.getTime()) / 86_400_000)
  );
  return days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`;
}
