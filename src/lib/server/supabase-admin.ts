import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY (the `server-only` import makes
 * any client-bundle inclusion a build error). Used exclusively by the
 * integrations layer: revealing Vault secrets, stamping test results and
 * writing notification_log — all things RLS deliberately denies to users.
 * Env: SUPABASE_SECRET_KEY (never NEXT_PUBLIC_*) — see .env.example.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const isAdminConfigured = Boolean(url && secretKey);

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!isAdminConfigured) {
    throw new Error(
      "Server Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (.env.example)"
    );
  }
  admin ??= createClient(url!, secretKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
