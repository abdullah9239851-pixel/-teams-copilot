// Alias for the Microsoft OAuth callback.
//
// The configured MICROSOFT_REDIRECT_URI points at /api/auth/microsoft/callback,
// while the primary handler lives at /api/microsoft/callback. Re-export the same
// GET handler here so Microsoft's redirect resolves regardless of which path the
// Azure app registration uses.
export { GET } from '@/app/api/microsoft/callback/route';

export const runtime = 'nodejs';
