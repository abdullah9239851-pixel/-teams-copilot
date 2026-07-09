import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { clientId } = await params;

    const [{ data: client }, { data: meetings }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase
        .from('meetings')
        .select('id, title, status, start_time, meeting_outputs(summary)')
        .eq('client_id', clientId)
        .order('start_time', { ascending: false }),
    ]);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json({ client, meetings: meetings || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { clientId } = await params;
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.company !== undefined) patch.company = body.company;
    if (body.notes !== undefined) patch.notes = body.notes;

    const { error } = await supabase.from('clients').update(patch).eq('id', clientId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
