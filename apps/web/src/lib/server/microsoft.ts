import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminSupabase, getUserFromBearer } from './supabaseAdmin';
import { encryptJson, decryptJson } from './crypto';

// Re-exported so existing route imports (`@/lib/server/microsoft`) keep working.
export { getAdminSupabase, getUserFromBearer };

export interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
}

export interface GraphEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  bodyPreview?: string;
  webLink?: string;
  onlineMeeting?: { joinUrl?: string };
  attendees?: Array<{ emailAddress?: { name?: string; address?: string } }>;
}

export function getBaseUrl(req?: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req) return new URL(req.url).origin;
  return 'http://localhost:3000';
}

export function getMicrosoftConfig(req?: Request) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    `${getBaseUrl(req)}/api/microsoft/callback`;

  if (!clientId || !tenantId || !clientSecret) {
    throw new Error('Microsoft Graph is not configured');
  }

  return { clientId, tenantId, clientSecret, redirectUri };
}

export async function exchangeCodeForTokens(code: string, req: Request) {
  const { clientId, tenantId, clientSecret, redirectUri } = getMicrosoftConfig(req);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'offline_access User.Read Calendars.Read',
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error_description || json.error || 'Microsoft token exchange failed');
  }

  return normalizeTokens(json);
}

export async function refreshMicrosoftTokens(tokens: MicrosoftTokens) {
  if (!tokens.refresh_token) throw new Error('Microsoft refresh token is missing');

  const { clientId, tenantId, clientSecret, redirectUri } = getMicrosoftConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
    redirect_uri: redirectUri,
    grant_type: 'refresh_token',
    scope: 'offline_access User.Read Calendars.Read',
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error_description || json.error || 'Microsoft token refresh failed');
  }

  return normalizeTokens(json, tokens.refresh_token);
}

export function normalizeTokens(raw: any, fallbackRefreshToken?: string): MicrosoftTokens {
  const expiresIn = Number(raw.expires_in || 3600);

  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || fallbackRefreshToken,
    expires_at: Date.now() + expiresIn * 1000,
    scope: raw.scope,
    token_type: raw.token_type,
  };
}

/** Persist tokens for a user, encrypting at rest when a key is configured. */
export async function storeMicrosoftTokens(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  name: string,
  tokens: MicrosoftTokens
) {
  return supabase.from('users').upsert({
    id: userId,
    email,
    name,
    role: 'member',
    ms_oauth_tokens: encryptJson(tokens),
  });
}

/** Read + decrypt a stored token blob (returns null if disconnected). */
export function readMicrosoftTokens(stored: unknown): MicrosoftTokens | null {
  const tokens = decryptJson<MicrosoftTokens>(stored);
  return tokens?.access_token ? tokens : null;
}

/** Encrypt tokens for a direct update (e.g. after a refresh). */
export function sealMicrosoftTokens(tokens: MicrosoftTokens): unknown {
  return encryptJson(tokens);
}
