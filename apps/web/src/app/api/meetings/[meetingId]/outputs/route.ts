import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// Save edited post-meeting outputs.
export async function PUT(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;
    const body = await req.json();

    const { error } = await supabase.from('meeting_outputs').upsert(
      {
        meeting_id: meetingId,
        summary: body.summary ?? '',
        action_items: body.actionItems ?? [],
        requirement_doc: body.requirementDoc ?? '',
        email_draft: body.emailDraft ?? '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id' }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
