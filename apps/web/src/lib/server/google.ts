import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptJson, decryptJson } from './crypto';
import { getBaseUrl } from './microsoft';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function getGoogleConfig(req?: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Google Calendar is not configured');
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildGoogleAuthUrl(state: string, req?: Request) {
  const { clientId, redirectUri } = getGoogleConfig(req);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  return url;
}

function normalizeTokens(raw: any, fallbackRefresh?: string): GoogleTokens {
  const expiresIn = Number(raw.expires_in || 3600);
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || fallbackRefresh,
    expires_at: Date.now() + expiresIn * 1000,
    scope: raw.scope,
    token_type: raw.token_type,
  };
}

export async function exchangeGoogleCode(code: string, req: Request): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Google token exchange failed');
  return normalizeTokens(json);
}

export async function refreshGoogleTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (!tokens.refresh_token) throw new Error('Google refresh token is missing');
  const { clientId, clientSecret } = getGoogleConfig();
  const body = new URLSearchParams({
    refresh_token: tokens.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || 'Google token refresh failed');
  return normalizeTokens(json, tokens.refresh_token);
}

export async function storeGoogleTokens(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  tokens: GoogleTokens
) {
  return supabase
    .from('users')
    .upsert({ id: userId, email, name: '', role: 'member', google_oauth_tokens: encryptJson(tokens) });
}

export function readGoogleTokens(stored: unknown): GoogleTokens | null {
  const tokens = decryptJson<GoogleTokens>(stored);
  return tokens?.access_token ? tokens : null;
}

export function sealGoogleTokens(tokens: GoogleTokens): unknown {
  return encryptJson(tokens);
}

/** Pull the Teams join link out of a calendar event (fallback: Google Meet link). */
export function extractJoinLink(event: any): string {
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
  const haystack = `${event.description || ''}\n${event.location || ''}`;
  const teams = haystack.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>)]+/i);
  if (teams) return decode(teams[0]);
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video');
  return entry?.uri || '';
}

export async function fetchGoogleEvents(tokens: GoogleTokens) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '20');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Could not fetch Google calendar');

  return (json.items || []).map((event: any) => ({
    id: event.id,
    title: event.summary || 'Untitled meeting',
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    agenda: (event.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    joinLink: extractJoinLink(event),
    attendees: (event.attendees || [])
      .map((a: any) => a.displayName || a.email)
      .filter(Boolean),
  }));
}
