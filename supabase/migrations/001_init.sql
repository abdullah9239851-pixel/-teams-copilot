-- Enable pgvector extension (safe to run even if already enabled)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  ms_oauth_tokens JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Meetings
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ms_event_id TEXT,
  title TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  agenda TEXT,
  join_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'preparing', 'live', 'completed', 'failed')),
  bot_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Meeting Prep
CREATE TABLE IF NOT EXISTS public.meeting_prep (
  meeting_id UUID PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_goals TEXT NOT NULL DEFAULT '',
  ai_questions JSONB NOT NULL DEFAULT '[]',
  checklist JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE public.meeting_prep ENABLE ROW LEVEL SECURITY;

-- Transcript Segments
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  "timestamp" INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting ON public.transcript_segments(meeting_id, "timestamp");
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;

-- AI Suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('question', 'missed_topic', 'risk', 'commitment')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  was_used BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Copilot Chat Messages
CREATE TABLE IF NOT EXISTS public.copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

-- Meeting Outputs
CREATE TABLE IF NOT EXISTS public.meeting_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  action_items JSONB NOT NULL DEFAULT '[]',
  requirement_doc TEXT NOT NULL DEFAULT '',
  email_draft TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meeting_outputs ENABLE ROW LEVEL SECURITY;

-- Knowledge Base Documents
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'docx', 'txt', 'notes')),
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

-- Knowledge Base Chunks (with pgvector)
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding VECTOR(1536)
);

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- RLS Policies
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can read all" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.meeting_prep FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.transcript_segments FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.suggestions FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.copilot_messages FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.meeting_outputs FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.kb_documents FOR SELECT USING (true);
CREATE POLICY "Users can read all" ON public.kb_chunks FOR SELECT USING (true);
