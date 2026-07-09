import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { generatePostMeeting } from '@/lib/server/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Generate the post-meeting package from the persisted transcript, then save it.
export async function POST(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;

    const [{ data: segments }, { data: prep }] = await Promise.all([
      supabase.from('transcript_segments').select('speaker, text').eq('meeting_id', meetingId).order('timestamp'),
      supabase.from('meeting_prep').select('user_goals').eq('meeting_id', meetingId).maybeSingle(),
    ]);

    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'No transcript data for this meeting yet' }, { status: 400 });
    }

    const transcript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
    const pkg = await generatePostMeeting(transcript, prep?.user_goals || '');

    await supabase.from('meeting_outputs').upsert(
      {
        meeting_id: meetingId,
        summary: pkg.summary,
        action_items: pkg.actionItems,
        requirement_doc: pkg.requirementDoc,
        email_draft: pkg.emailDraft,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id' }
    );
    await supabase.from('meetings').update({ status: 'completed' }).eq('id', meetingId);

    return NextResponse.json(pkg);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
