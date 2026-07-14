"use client";

/**
 * Supabase browser client (Stage 2). Reads NEXT_PUBLIC_* env — see .env.example.
 * When env is absent (or the network can't reach the project, e.g. this
 * sandboxed build environment), screens keep running on their local demo
 * stores; data-layer swaps check `isSupabaseConfigured` first.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase env missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.example)"
    );
  }
  client ??= createClient(url!, anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
