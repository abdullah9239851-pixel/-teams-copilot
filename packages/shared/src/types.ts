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

// ─── Live Meeting Intelligence ───────────────────
export type MeetingMode =
  | 'sales_discovery'
  | 'technical_discovery'
  | 'project_requirements'
  | 'progress_status';

export const MEETING_MODE_LABELS: Record<MeetingMode, string> = {
  sales_discovery: 'Sales Discovery',
  technical_discovery: 'Technical Discovery',
  project_requirements: 'Project Requirements',
  progress_status: 'Progress / Status',
};

// Fields the AI tracks per meeting mode (missing-information tracker).
export const MODE_TRACKER_FIELDS: Record<MeetingMode, string[]> = {
  sales_discovery: ['Pain / problem', 'Business impact', 'Budget', 'Timeline', 'Decision maker'],
  technical_discovery: ['Systems & APIs', 'Data', 'Auth & security', 'Risks / errors', 'Volume / scale', 'Environment'],
  project_requirements: ['Users & roles', 'Process / workflow', 'Edge cases', 'Deliverables', 'Acceptance criteria'],
  progress_status: ['Done since last time', 'Blockers', 'Owners', 'Due dates', 'Decisions needed'],
};

export type TrackerStatus = 'confirmed' | 'partial' | 'missing' | 'na';

export interface TrackerItem {
  label: string;
  status: TrackerStatus;
}

export type KeyPointCategory =
  | 'pain_point'
  | 'requirement'
  | 'current_tools'
  | 'constraint'
  | 'timeline'
  | 'budget'
  | 'decision'
  | 'open_question';

export interface KeyPoint {
  category: KeyPointCategory;
  text: string;
}

export interface MeetingIntelligence {
  summary: string; // rolling live summary, newline-separated bullets
  keyPoints: KeyPoint[];
  tracker: TrackerItem[];
  completeness: number; // 0-100, weighted from tracker statuses
  missingPriorities: string[];
  updatedAt: string;
}

// Deterministic, explainable completeness (docx spec §31):
// confirmed = 1, partial = 0.5, missing = 0; "na" items are excluded.
export function computeCompleteness(tracker: TrackerItem[]): number {
  const scored = tracker.filter((t) => t.status !== 'na');
  if (scored.length === 0) return 0;
  const sum = scored.reduce(
    (acc, t) => acc + (t.status === 'confirmed' ? 1 : t.status === 'partial' ? 0.5 : 0),
    0
  );
  return Math.round((sum / scored.length) * 100);
}

// ─── Socket.io Events ────────────────────────────
export interface ServerToClientEvents {
  transcript: (segment: TranscriptSegment) => void;
  suggestion: (suggestion: Suggestion) => void;
  copilot_message: (message: CopilotMessage) => void;
  bot_status: (status: BotStatus) => void;
  checklist_update: (checklist: ChecklistItem[]) => void;
  post_meeting_ready: (meetingId: string) => void;
}

export interface ClientToServerEvents {
  join_meeting: (meetingId: string) => void;
  leave_meeting: (meetingId: string) => void;
  copilot_message: (meetingId: string, content: string) => void;
  suggestion_feedback: (meetingId: string, suggestionId: string, feedback: 'used' | 'dismissed') => void;
}

export type BotStatus = 'joining' | 'in_lobby' | 'live' | 'transcribing' | 'ai_listening' | 'left' | 'error';
