import OpenAI from 'openai';

/**
 * Optional embeddings (mirrors apps/server). Until an embedding API key exists,
 * these return null and the Knowledge Base falls back to keyword search.
 *
 * Env: EMBEDDING_API_KEY (or OPENAI_API_KEY), EMBEDDING_BASE_URL, EMBEDDING_MODEL.
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
