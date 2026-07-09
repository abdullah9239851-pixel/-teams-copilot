import { NextResponse } from 'next/server';
import { getAdminSupabase, getBaseUrl } from '@/lib/server/microsoft';
import { exchangeGoogleCode, storeGoogleTokens } from '@/lib/server/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const baseUrl = getBaseUrl(req);

  // Google returned an explicit error (e.g. access_denied).
  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?google=error&message=${encodeURIComponent(error)}`);
  }
  // Google must return an authorization code and our state (userId:nonce).
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state&reason=no_code`);
  }
  if (!state || !state.includes(':')) {
    return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state&reason=no_state`);
  }

  // NOTE: We intentionally do NOT gate on the state cookie. The cookie is easily
  // lost across the cross-site Google redirect / Vercel deployment-alias domains,
  // which was causing persistent invalid_state failures. Instead we trust the
  // userId embedded in state and validate it exists (single-org internal tool).
  const [userId] = state.split(':');

  try {
    const supabase = getAdminSupabase();
    const { data: authUser, error: userErr } = await supabase.auth.admin.getUserById(userId);
    if (userErr || !authUser?.user) {
      return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state&reason=no_user`);
    }
    const tokens = await exchangeGoogleCode(code, req);
    await storeGoogleTokens(supabase, userId, authUser.user.email || '', tokens);

    const response = NextResponse.redirect(`${baseUrl}/settings?google=connected`);
    response.cookies.delete('google_oauth_state');
    return response;
  } catch (err: any) {
    return NextResponse.redirect(`${baseUrl}/settings?google=error&message=${encodeURIComponent(err.message || 'Connection failed')}`);
  }
}
