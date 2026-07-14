import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * API-route caller verification. The client sends its Supabase access token
 * as `Authorization: Bearer <jwt>`; we resolve the user and ask the DATABASE
 * (public.can — self-queries only, 0004) whether they hold the required
 * permission. The database stays the authority; routes never trust the client.
 */

export interface Caller {
  userId: string;
  token: string;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isRouteAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

export async function resolveCaller(req: Request): Promise<Caller | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !isRouteAuthConfigured()) return null;
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, token };
}

/** True iff the caller is an org admin (or super admin) for the given org. */
export async function callerIsOrgAdmin(caller: Caller, orgId: string): Promise<boolean> {
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${caller.token}` } },
  });
  const { data, error } = await client.rpc("can", {
    p_user: caller.userId,
    p_org: orgId,
    p_building: null,
    p_module: null,
    p_action: "admin",
  });
  return !error && data === true;
}
