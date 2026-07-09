-- ============================================================================
-- 002 — Persistence, Knowledge Base retrieval, security policies
--
-- Purpose:
--   1. Switch meeting identifiers to TEXT so they match the app-generated ids
--      (`meeting_1699...`, `practice_1699...`) that flow through sockets + URLs.
--   2. Add ownership + prep/briefing columns used by the live pipeline.
--   3. Add a pgvector similarity RPC + KB ingestion columns for the Knowledge Base.
--   4. Replace the permissive placeholder RLS with authenticated, role-aware policies.
--   5. Create the private storage bucket for KB uploads.
--
-- Safe to run on the existing project: the meeting-scoped tables held no data
-- (everything was in-memory before this migration), so they are recreated.
-- ============================================================================

-- ─── Meeting-scoped tables: recreate with TEXT ids ──────────────────────────
DROP TABLE IF EXISTS public.meeting_outputs CASCADE;
DROP TABLE IF EXISTS public.copilot_messages CASCADE;
DROP TABLE IF EXISTS public.suggestions CASCADE;
DROP TABLE IF EXISTS public.transcript_segments CASCADE;
DROP TABLE IF EXISTS public.meeting_prep CASCADE;
DROP TABLE IF EXISTS public.meetings CASCADE;

CREATE TABLE public.meetings (
  id TEXT PRIMARY KEY,
  ms_event_id TEXT,
  title TEXT NOT NULL DEFAULT 'Meeting',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'practice')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  agenda TEXT,
  join_link TEXT,
  attendees JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'preparing', 'live', 'completed', 'failed')),
  bot_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meeting_prep (
  meeting_id TEXT PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_goals TEXT NOT NULL DEFAULT '',
  ai_questions JSONB NOT NULL DEFAULT '[]',
  checklist JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.meeting_prep ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  "timestamp" BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_transcript_segments_meeting
  ON public.transcript_segments(meeting_id, "timestamp");
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('question', 'missed_topic', 'risk', 'commitment')),
  content TEXT NOT NULL,
  was_used BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_suggestions_meeting ON public.suggestions(meeting_id);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_copilot_messages_meeting ON public.copilot_messages(meeting_id);
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meeting_outputs (
  meeting_id TEXT PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  action_items JSONB NOT NULL DEFAULT '[]',
  requirement_doc TEXT NOT NULL DEFAULT '',
  email_draft TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.meeting_outputs ENABLE ROW LEVEL SECURITY;

-- ─── Knowledge Base: ingestion columns ──────────────────────────────────────
ALTER TABLE public.kb_documents
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('processing', 'ready', 'failed'));

-- The `type` check needs a 'template' option for question templates.
ALTER TABLE public.kb_documents DROP CONSTRAINT IF EXISTS kb_documents_type_check;
ALTER TABLE public.kb_documents
  ADD CONSTRAINT kb_documents_type_check
  CHECK (type IN ('pdf', 'docx', 'txt', 'notes', 'template'));

CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON public.kb_chunks(doc_id);
-- Keyword fallback index (used until embeddings are populated).
CREATE INDEX IF NOT EXISTS idx_kb_chunks_text_trgm
  ON public.kb_chunks USING gin (to_tsvector('english', text));

-- Vector similarity search RPC (returns [] until embeddings are populated).
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, doc_id uuid, text text, similarity float)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT c.id, c.doc_id, c.text, 1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kb_chunks c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── Role helper ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

-- ─── RLS policies ───────────────────────────────────────────────────────────
-- Single-org tool: any authenticated team member may read shared data; the
-- Microsoft tokens on `users` stay private to the owner. The server uses the
-- service-role key and bypasses RLS for its writes.

-- users: read/update only your own row (tokens never exposed to other members)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (public.is_admin());

-- clients: team-shared read; any member may write; admin may delete
DROP POLICY IF EXISTS "Users can read all" ON public.clients;
CREATE POLICY "clients_member_read"  ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_member_write" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_member_update" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "clients_admin_delete" ON public.clients FOR DELETE USING (public.is_admin());

-- Shared read-only-for-members tables (writes go through the service role).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'meetings', 'meeting_prep', 'transcript_segments',
    'suggestions', 'copilot_messages', 'meeting_outputs',
    'kb_documents', 'kb_chunks'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users can read all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "%s_member_read" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- Admins manage the knowledge base directly from the client.
CREATE POLICY "kb_documents_admin_write" ON public.kb_documents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── Storage bucket for KB uploads ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('kb-documents', 'kb-documents', false)
ON CONFLICT (id) DO NOTHING;
