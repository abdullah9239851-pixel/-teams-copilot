import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// Full meeting detail: meeting row + transcript + suggestions + outputs + prep.
export async function GET(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;

    const [meeting, transcript, suggestions, outputs, prep] = await Promise.all([
      supabase.from('meetings').select('*, clients(name, company)').eq('id', meetingId).maybeSingle(),
      supabase.from('transcript_segments').select('*').eq('meeting_id', meetingId).order('timestamp'),
      supabase.from('suggestions').select('*').eq('meeting_id', meetingId).order('created_at'),
      supabase.from('meeting_outputs').select('*').eq('meeting_id', meetingId).maybeSingle(),
      supabase.from('meeting_prep').select('*').eq('meeting_id', meetingId).maybeSingle(),
    ]);

    if (!meeting.data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    return NextResponse.json({
      meeting: meeting.data,
      transcript: transcript.data || [],
      suggestions: suggestions.data || [],
      outputs: outputs.data || null,
      prep: prep.data || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
