import { NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabaseAdmin';
import { readGoogleTokens, sealGoogleTokens, refreshGoogleTokens, fetchGoogleEvents, GoogleTokens } from '@/lib/server/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getUserFromBearer(req);
    const { data: profile, error } = await supabase
      .from('users')
      .select('google_oauth_tokens')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;

    let tokens: GoogleTokens | null = readGoogleTokens(profile?.google_oauth_tokens);
    if (!tokens?.access_token) {
      return NextResponse.json({ connected: false, meetings: [] });
    }

    if (tokens.expires_at < Date.now() + 60_000) {
      tokens = await refreshGoogleTokens(tokens);
      await supabase
        .from('users')
        .update({ google_oauth_tokens: sealGoogleTokens(tokens) })
        .eq('id', user.id);
    }

    const meetings = await fetchGoogleEvents(tokens);
    return NextResponse.json({ connected: true, meetings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Google calendar fetch failed' }, { status: 500 });
  }
}
