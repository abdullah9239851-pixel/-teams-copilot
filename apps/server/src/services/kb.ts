import { getSupabase } from './supabase';
import { embedText } from './embeddings';

/**
 * Knowledge Base retrieval used by the live suggestion engine, the copilot chat,
 * and pre-meeting prep generation.
 *
 * Strategy:
 *   1. If embeddings are configured, do semantic vector search (match_kb_chunks).
 *   2. Otherwise fall back to Postgres full-text keyword search.
 * Either way the caller gets a plain string of relevant context (or '').
 */
export async function retrieveKbContext(query: string, matchCount = 5): Promise<string> {
  const db = getSupabase();
  if (!db || !query.trim()) return '';

  // 1. Semantic search when embeddings are available.
  const embedding = await embedText(query);
  if (embedding) {
    const { data, error } = await db.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (!error && data && data.length > 0) {
      return (data as Array<{ text: string }>).map((c) => c.text).join('\n---\n');
    }
  }

  // 2. Keyword fallback — take the most informative words as an OR query.
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);
  if (terms.length === 0) return '';

  const { data, error } = await db
    .from('kb_chunks')
    .select('text')
    .textSearch('text', terms.join(' | '), { type: 'plain', config: 'english' })
    .limit(matchCount);

  if (error || !data) return '';
  return (data as Array<{ text: string }>).map((c) => c.text).join('\n---\n');
}
