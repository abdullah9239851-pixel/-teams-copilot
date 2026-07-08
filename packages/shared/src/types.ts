// ─── Users ───────────────────────────────────────
export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// ─── Clients ─────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  company: string;
  notes: string;
  created_at: string;
}

// ─── Meetings ────────────────────────────────────
export type MeetingStatus = 'scheduled' | 'preparing' | 'live' | 'completed' | 'failed';

export interface Meeting {
  id: string;
  ms_event_id?: string;
  title: string;
  client_id?: string;
  start_time: string;
  end_time?: string;
  agenda?: string;
  join_link?: string;
  status: MeetingStatus;
  bot_session_id?: string;
  created_at: string;
}

// ─── Transcript ──────────────────────────────────
export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker: string;
  text: string;
  timestamp: number;
  created_at: string;
}

// ─── AI Suggestions ──────────────────────────────
export type SuggestionType = 'question' | 'missed_topic' | 'risk' | 'commitment';

export interface Suggestion {
  id: string;
  meeting_id: string;
  type: SuggestionType;
  content: string;
  created_at: string;
  was_used: boolean;
}

// ─── Copilot Chat ────────────────────────────────
export interface CopilotMessage {
  id: string;
  meeting_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Meeting Outputs ─────────────────────────────
export interface MeetingOutputs {
  id: string;
  meeting_id: string;
  summary: string;
  action_items: ActionItem[];
  requirement_doc: string;
  email_draft: string;
  created_at: string;
}

export interface ActionItem {
  text: string;
  owner: 'yours' | 'client';
  done: boolean;
}

// ─── Knowledge Base ──────────────────────────────
export interface KBDocument {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'txt' | 'notes';
  file_url?: string;
  created_at: string;
}

export interface KBChunk {
  id: string;
  doc_id: string;
  text: string;
  embedding?: number[];
}

// ─── Meeting Prep ────────────────────────────────
export interface MeetingPrep {
  meeting_id: string;
  user_goals: string;
  ai_questions: string[];
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  text: string;
  answered: boolean;
}

// ─── Socket.io Events ────────────────────────────
export interface ServerToClientEvents {
  transcript: (segment: TranscriptSegment) => void;
  suggestion: (suggestion: Suggestion) => void;
  copilot_message: (message: CopilotMessage) => void;
  bot_status: (status: BotStatus) => void;
  checklist_update: (checklist: ChecklistItem[]) => void;
}

export interface ClientToServerEvents {
  join_meeting: (meetingId: string) => void;
  leave_meeting: (meetingId: string) => void;
  copilot_message: (meetingId: string, content: string) => void;
}

export type BotStatus = 'joining' | 'live' | 'transcribing' | 'ai_listening' | 'left' | 'error';
