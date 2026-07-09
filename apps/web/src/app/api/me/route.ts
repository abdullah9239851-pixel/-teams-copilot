import { NextResponse } from 'next/server';
import { getUserFromBearer, getProfile } from '@/lib/server/supabaseAdmin';

export const runtime = 'nodejs';

// Current user's profile + Microsoft connection status.
export async function GET(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const profile = await getProfile(supabase, user.id, user.email || '');

    const { data } = await supabase
      .from('users')
      .select('ms_oauth_tokens')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      id: user.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      microsoftConnected: Boolean(data?.ms_oauth_tokens),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
