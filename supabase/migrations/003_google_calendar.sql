-- ============================================================================
-- 003 — Google Calendar integration
-- Adds a separate encrypted token blob for Google OAuth. Teams meetings scheduled
-- into a Google Calendar carry their Teams join link inside the event body, so we
-- keep the existing Teams bot and only add Google as a calendar source.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS google_oauth_tokens JSONB;
