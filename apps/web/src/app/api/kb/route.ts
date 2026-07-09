import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { extractText, ingestDocument } from '@/lib/server/kb';

export const runtime = 'nodejs';

const EXT_TYPE: Record<string, string> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  txt: 'txt',
  md: 'txt',
};

// List all knowledge-base documents.
export async function GET(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { data, error } = await supabase
      .from('kb_documents')
      .select('id, title, type, status, chunk_count, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ documents: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

// Create a document from an uploaded file OR from freeform notes / a template.
export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const contentType = req.headers.get('content-type') || '';

    let title = '';
    let type = 'notes';
    let text = '';
    let storagePath: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      title = String(form.get('title') || file?.name || 'Untitled');
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      type = EXT_TYPE[ext] || 'txt';
      const buffer = Buffer.from(await file.arrayBuffer());

      // Store the original file (best-effort; text extraction is what matters).
      storagePath = `${user.id}/${Date.now()}_${file.name}`;
      await supabase.storage.from('kb-documents').upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

      text = await extractText(type, buffer);
    } else {
      const body = await req.json();
      title = String(body.title || 'Untitled');
      type = body.type === 'template' ? 'template' : 'notes';
      text = String(body.text || '');
      if (!text.trim()) return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const { data: doc, error: docErr } = await supabase
      .from('kb_documents')
      .insert({
        title,
        type,
        uploaded_by: user.id,
        storage_path: storagePath,
        status: 'processing',
      })
      .select('id')
      .single();
    if (docErr) throw docErr;

    const result = await ingestDocument(supabase, doc.id, text);
    return NextResponse.json({ id: doc.id, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
