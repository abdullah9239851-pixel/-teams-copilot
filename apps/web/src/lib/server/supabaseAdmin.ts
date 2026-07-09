import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Service-role Supabase client (bypasses RLS) for trusted server routes. */
export function getAdminSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service role is not configured');
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Resolve the authenticated user from the `Authorization: Bearer <supabase jwt>` header. */
export async function getUserFromBearer(req: Request) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (!token) throw new Error('Missing Supabase session');

  const supabase = getAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid Supabase session');

  return { supabase, user: data.user };
}

/** Fetch the caller's app profile (role, name) — creating a default row if missing. */
export async function getProfile(supabase: SupabaseClient, userId: string, email: string) {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .maybeSingle();
  if (data) return data;

  const fallback = { id: userId, email, name: '', role: 'member' as const };
  await supabase.from('users').upsert(fallback);
  return fallback;
}

/** Throw unless the caller is an admin. */
export async function requireAdmin(req: Request) {
  const { supabase, user } = await getUserFromBearer(req);
  const profile = await getProfile(supabase, user.id, user.email || '');
  if (profile.role !== 'admin') throw new Error('Admin role required');
  return { supabase, user, profile };
}
