import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

/**
 * Service-role Supabase client for the backend. Returns null (and logs once) if
 * Supabase env is not configured, so the live pipeline keeps working in-memory
 * even without a database — persistence is best-effort, never blocking.
 */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — persistence disabled');
    cached = null;
    return cached;
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
