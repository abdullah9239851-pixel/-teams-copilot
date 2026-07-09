import type { SupabaseClient } from '@supabase/supabase-js';
import { embedTexts } from './embeddings';

/** Split text into overlapping chunks sized for embedding + retrieval. */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    i += size - overlap;
  }
  return chunks;
}

/** Extract raw text from an uploaded file buffer. */
export async function extractText(type: string, buffer: Buffer, rawText?: string): Promise<string> {
  if (rawText != null) return rawText;

  if (type === 'txt') return buffer.toString('utf8');

  if (type === 'pdf') {
    try {
      // Import the inner module directly to avoid pdf-parse's debug harness.
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      return parsed.text || '';
    } catch (err) {
      console.error('[kb] pdf extract failed:', err);
      return '';
    }
  }

  if (type === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (err) {
      console.error('[kb] docx extract failed:', err);
      return '';
    }
  }

  return buffer.toString('utf8');
}

/** Chunk → embed (if key present) → store chunks, then mark the doc ready. */
export async function ingestDocument(
  supabase: SupabaseClient,
  docId: string,
  text: string
): Promise<{ chunkCount: number; embedded: boolean }> {
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await supabase.from('kb_documents').update({ status: 'ready', chunk_count: 0 }).eq('id', docId);
    return { chunkCount: 0, embedded: false };
  }

  const embeddings = await embedTexts(chunks);
  const rows = chunks.map((chunk, i) => ({
    doc_id: docId,
    text: chunk,
    embedding: embeddings ? embeddings[i] : null,
  }));

  // Clear any previous chunks (supports re-index) then insert fresh.
  await supabase.from('kb_chunks').delete().eq('doc_id', docId);
  const { error } = await supabase.from('kb_chunks').insert(rows);
  if (error) {
    await supabase.from('kb_documents').update({ status: 'failed' }).eq('id', docId);
    throw error;
  }

  await supabase
    .from('kb_documents')
    .update({ status: 'ready', chunk_count: chunks.length })
    .eq('id', docId);

  return { chunkCount: chunks.length, embedded: Boolean(embeddings) };
}

/** Retrieve relevant KB context for a query (semantic if embeddings exist, else keyword). */
export async function retrieveKbContext(
  supabase: SupabaseClient,
  query: string,
  matchCount = 5
): Promise<string> {
  if (!query.trim()) return '';

  const [embedding] = (await embedTexts([query])) ?? [];
  if (embedding) {
    const { data, error } = await supabase.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_count: matchCount,
    });
    if (!error && data && data.length > 0) {
      return (data as Array<{ text: string }>).map((c) => c.text).join('\n---\n');
    }
  }

  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 8);
  if (terms.length === 0) return '';

  const { data } = await supabase
    .from('kb_chunks')
    .select('text')
    .textSearch('text', terms.join(' | '), { type: 'plain', config: 'english' })
    .limit(matchCount);

  return (data as Array<{ text: string }> | null)?.map((c) => c.text).join('\n---\n') || '';
}
