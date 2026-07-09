import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { generatePrepQuestions } from '@/lib/server/llm';
import { retrieveKbContext } from '@/lib/server/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Load meeting + prep.
export async function GET(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;

    const { data: meeting } = await supabase
      .from('meetings')
      .select('*, clients(id, name, company)')
      .eq('id', meetingId)
      .maybeSingle();
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    const { data: prep } = await supabase
      .from('meeting_prep')
      .select('*')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    return NextResponse.json({ meeting, prep: prep || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

// Generate AI discovery questions (agenda + goals + client history + KB).
export async function POST(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;
    const body = await req.json().catch(() => ({}));
    const goals: string = body.goals || '';

    const { data: meeting } = await supabase
      .from('meetings')
      .select('title, agenda, client_id')
      .eq('id', meetingId)
      .maybeSingle();
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    // Prior meetings with the same client → history context.
    let clientHistory = '';
    if (meeting.client_id) {
      const { data: past } = await supabase
        .from('meetings')
        .select('title, meeting_outputs(summary)')
        .eq('client_id', meeting.client_id)
        .neq('id', meetingId)
        .limit(5);
      clientHistory = (past || [])
        .map((m: any) => `${m.title}: ${m.meeting_outputs?.summary || ''}`)
        .join('\n');
    }

    const kbContext = await retrieveKbContext(
      supabase,
      `${meeting.title} ${meeting.agenda || ''} ${goals}`
    ).catch(() => '');

    const questions = await generatePrepQuestions({
      title: meeting.title,
      agenda: meeting.agenda || '',
      goals,
      clientHistory,
      kbContext,
    });

    const checklist = questions.map((q) => ({ text: q, answered: false }));
    await supabase.from('meeting_prep').upsert(
      { meeting_id: meetingId, user_goals: goals, ai_questions: questions, checklist, updated_at: new Date().toISOString() },
      { onConflict: 'meeting_id' }
    );

    return NextResponse.json({ questions, checklist });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Save goals / edited checklist.
export async function PUT(req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { meetingId } = await params;
    const body = await req.json();

    const { error } = await supabase.from('meeting_prep').upsert(
      {
        meeting_id: meetingId,
        user_goals: body.goals ?? '',
        ai_questions: body.questions ?? [],
        checklist: body.checklist ?? [],
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
