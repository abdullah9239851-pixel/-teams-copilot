import { NextResponse } from 'next/server';
import { getAdminSupabase, getBaseUrl } from '@/lib/server/microsoft';
import { exchangeGoogleCode, storeGoogleTokens } from '@/lib/server/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const expectedState = req.headers.get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('google_oauth_state='))
    ?.split('=')
    .slice(1)
    .join('=');
  const baseUrl = getBaseUrl(req);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?google=error&message=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state`);
  }
  // Reject only an ACTIVE mismatch. If the state cookie is absent (it can be lost
  // across the cross-site Google redirect or a domain switch), fall back to
  // validating the userId embedded in the state below.
  if (expectedState && state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state`);
  }

  const [userId] = state.split(':');

  try {
    const supabase = getAdminSupabase();
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    if (!authUser?.user) {
      return NextResponse.redirect(`${baseUrl}/settings?google=invalid_state`);
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
