import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, getAdminSupabase, getBaseUrl, storeMicrosoftTokens } from '@/lib/server/microsoft';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  const expectedState = req.headers.get('cookie')
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('ms_oauth_state='))
    ?.split('=')
    .slice(1)
    .join('=');
  const baseUrl = getBaseUrl(req);

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?microsoft=error&message=${encodeURIComponent(error)}`);
  }

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/settings?microsoft=invalid_state`);
  }

  const [userId] = state.split(':');

  try {
    const tokens = await exchangeCodeForTokens(code, req);
    const supabase = getAdminSupabase();
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    await storeMicrosoftTokens(
      supabase,
      userId,
      authUser?.user?.email || '',
      authUser?.user?.user_metadata?.name || '',
      tokens
    );

    const response = NextResponse.redirect(`${baseUrl}/settings?microsoft=connected`);
    response.cookies.delete('ms_oauth_state');
    return response;
  } catch (err: any) {
    return NextResponse.redirect(`${baseUrl}/settings?microsoft=error&message=${encodeURIComponent(err.message || 'Connection failed')}`);
  }
}
