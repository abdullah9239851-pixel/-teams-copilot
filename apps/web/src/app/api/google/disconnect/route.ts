import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const { error } = await supabase
      .from('users')
      .update({ google_oauth_tokens: null })
      .eq('id', user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
