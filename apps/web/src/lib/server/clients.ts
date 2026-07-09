import type { SupabaseClient } from '@supabase/supabase-js';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com',
]);

/**
 * Best-effort: derive a client from meeting attendees' shared email domain and
 * link/create a client row. Returns the client id (or null if undeterminable).
 */
export async function resolveClientFromAttendees(
  supabase: SupabaseClient,
  attendees: Array<string | { address?: string; name?: string }>,
  ownerEmail?: string
): Promise<string | null> {
  const ownerDomain = ownerEmail?.split('@')[1]?.toLowerCase();

  const emails = attendees
    .map((a) => (typeof a === 'string' ? a : a.address || ''))
    .filter((e) => e.includes('@'));

  const domains = emails
    .map((e) => e.split('@')[1]?.toLowerCase())
    .filter((d): d is string => Boolean(d) && d !== ownerDomain && !GENERIC_DOMAINS.has(d));

  if (domains.length === 0) return null;

  // Most common external domain wins.
  const counts = new Map<string, number>();
  domains.forEach((d) => counts.set(d, (counts.get(d) || 0) + 1));
  const domain = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const company = domain.split('.')[0];
  const name = company.charAt(0).toUpperCase() + company.slice(1);

  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .ilike('company', domain)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from('clients')
    .insert({ name, company: domain, notes: '' })
    .select('id')
    .single();
  return created?.id ?? null;
}
