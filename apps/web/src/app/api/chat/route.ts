import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { chatOverTranscript } from '@/lib/server/llm';
import { retrieveKbContext } from '@/lib/server/kb';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Transcript-grounded AI chat (used by the practice simulator's "Ask AI").
export async function POST(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const body = await req.json();
    const transcript: string = body.transcript || '';
    const message: string = (body.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

    const kbContext = await retrieveKbContext(supabase, `${message}\n${transcript.slice(-500)}`).catch(() => '');
    const answer = await chatOverTranscript(transcript, message, kbContext);
    return NextResponse.json({ answer });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
