import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/server/microsoft';
import { buildGoogleAuthUrl } from '@/lib/server/google';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  try {
    const state = `${userId}:${crypto.randomUUID()}`;
    const authUrl = buildGoogleAuthUrl(state, req);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getBaseUrl(req).startsWith('https://'),
      maxAge: 10 * 60,
      path: '/',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Google OAuth is not configured' }, { status: 500 });
  }
}
