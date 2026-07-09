import { NextResponse } from 'next/server';
import { getBaseUrl, getMicrosoftConfig } from '@/lib/server/microsoft';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  try {
    const { clientId, tenantId, redirectUri } = getMicrosoftConfig(req);
    const nonce = crypto.randomUUID();
    const state = `${userId}:${nonce}`;
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);

    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', 'offline_access User.Read Calendars.Read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('ms_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getBaseUrl(req).startsWith('https://'),
      maxAge: 10 * 60,
      path: '/',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Microsoft OAuth is not configured' }, { status: 500 });
  }
}
