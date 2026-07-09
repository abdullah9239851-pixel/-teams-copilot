import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, company, notes, created_at, meetings(count)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ clients: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase } = await getUserFromBearer(req);
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { data, error } = await supabase
      .from('clients')
      .insert({ name: body.name, company: body.company || '', notes: body.notes || '' })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
