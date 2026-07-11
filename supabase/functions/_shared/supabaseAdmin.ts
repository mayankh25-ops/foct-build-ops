import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Service-role client — bypasses RLS. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically into Edge Functions.
export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client scoped to the caller's JWT — used to identify the requesting user.
export function getUserClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
