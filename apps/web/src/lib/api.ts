'use client';

import { createClient } from '@/lib/supabase';

/**
 * fetch() wrapper that attaches the current Supabase access token as a Bearer
 * header so server routes can authenticate the caller.
 */
export async function apiFetch(input: string, init: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);

  return fetch(input, { ...init, headers });
}

export async function apiJson<T = any>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
