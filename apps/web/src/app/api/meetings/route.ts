import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { resolveClientFromAttendees } from '@/lib/server/clients';

export const runtime = 'nodejs';

function sanitizeId(raw: string) {
  return `meeting_${raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
}

// List meetings (most recent first), with client + output presence.
export async function GET(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, status, mode, start_time, end_time, client_id, clients(name, company)')
      .order('start_time', { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ meetings: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

// Create/prepare a meeting record (from a calendar event or ad-hoc).
export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const body = await req.json();

    const id = body.msEventId ? sanitizeId(body.msEventId) : `meeting_${Date.now()}`;
    const attendees: any[] = Array.isArray(body.attendees) ? body.attendees : [];

    const clientId = await resolveClientFromAttendees(supabase, attendees, user.email || '').catch(() => null);

    const { error } = await supabase.from('meetings').upsert(
      {
        id,
        ms_event_id: body.msEventId || null,
        title: body.title || 'Client Meeting',
        agenda: body.agenda || null,
        join_link: body.joinLink || null,
        attendees,
        client_id: clientId,
        user_id: user.id,
        mode: 'live',
        start_time: body.start || new Date().toISOString(),
        status: 'preparing',
      },
      { onConflict: 'id' }
    );
    if (error) throw error;

    return NextResponse.json({ id, clientId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
