import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// Delete a document (its chunks cascade) and remove the stored file.
export async function DELETE(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { docId } = await params;

    const { data: doc } = await supabase
      .from('kb_documents')
      .select('storage_path')
      .eq('id', docId)
      .maybeSingle();

    if (doc?.storage_path) {
      await supabase.storage.from('kb-documents').remove([doc.storage_path]);
    }

    const { error } = await supabase.from('kb_documents').delete().eq('id', docId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
