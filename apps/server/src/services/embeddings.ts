import OpenAI from 'openai';

/**
 * Embeddings are optional. Until an embedding API key is configured the whole
 * Knowledge Base still works via keyword search — these helpers just return null
 * and callers fall back. When the key is added later, ingestion + retrieval
 * upgrade to semantic vector search with no other code changes.
 *
 * Env:
 *   EMBEDDING_API_KEY   (falls back to OPENAI_API_KEY)
 *   EMBEDDING_BASE_URL  (default https://api.openai.com/v1)
 *   EMBEDDING_MODEL     (default text-embedding-3-small → 1536 dims, matches schema)
 */

export const EMBEDDING_DIMS = 1536;

function getClient(): OpenAI | null {
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'not-needed') return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1',
  });
}

export function embeddingsEnabled(): boolean {
  return getClient() !== null;
}

export async function embedText(text: string): Promise<number[] | null> {
  const [vec] = (await embedTexts([text])) ?? [];
  return vec ?? null;
}

export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const client = getClient();
  if (!client || texts.length === 0) return null;
  try {
    const res = await client.embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
    });
    return res.data.map((d) => d.embedding as number[]);
  } catch (err: any) {
    console.error('[embeddings] failed:', err.message);
    return null;
  }
}
