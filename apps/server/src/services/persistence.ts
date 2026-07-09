import { getSupabase } from './supabase';
import type { TranscriptEvent } from './bot/types';

/**
 * Best-effort persistence helpers. Every function swallows/logs errors so a
 * database hiccup can never take down a live meeting (non-functional
 * requirement: the meeting is unaffected if storage fails).
 */

export interface MeetingRow {
  id: string;
  title?: string;
  mode?: 'live' | 'practice';
  join_link?: string;
  user_id?: string | null;
  client_id?: string | null;
  agenda?: string;
  attendees?: string[];
  status?: 'scheduled' | 'preparing' | 'live' | 'completed' | 'failed';
}

export async function upsertMeeting(row: MeetingRow): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('meetings').upsert(
    {
      id: row.id,
      title: row.title ?? 'Client Meeting',
      mode: row.mode ?? 'live',
      join_link: row.join_link ?? null,
      user_id: row.user_id ?? null,
      client_id: row.client_id ?? null,
      agenda: row.agenda ?? null,
      attendees: row.attendees ?? [],
      status: row.status ?? 'live',
    },
    { onConflict: 'id' }
  );
  if (error) console.error('[persist] upsertMeeting:', error.message);
}

export async function setMeetingStatus(
  meetingId: string,
  status: MeetingRow['status'],
  extra: { end_time?: string; bot_session_id?: string } = {}
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('meetings')
    .update({ status, ...extra })
    .eq('id', meetingId);
  if (error) console.error('[persist] setMeetingStatus:', error.message);
}

export async function saveTranscriptSegment(
  meetingId: string,
  event: TranscriptEvent
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('transcript_segments').insert({
    meeting_id: meetingId,
    speaker: event.speaker,
    text: event.text,
    timestamp: event.timestamp,
  });
  if (error) console.error('[persist] saveTranscriptSegment:', error.message);
}

export async function saveSuggestion(
  meetingId: string,
  type: string,
  content: string
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from('suggestions')
    .insert({ meeting_id: meetingId, type, content })
    .select('id')
    .single();
  if (error) {
    console.error('[persist] saveSuggestion:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function updateSuggestionFeedback(
  suggestionId: string,
  patch: { was_used?: boolean; dismissed?: boolean }
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('suggestions').update(patch).eq('id', suggestionId);
  if (error) console.error('[persist] updateSuggestionFeedback:', error.message);
}

export async function saveCopilotMessage(
  meetingId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db
    .from('copilot_messages')
    .insert({ meeting_id: meetingId, role, content });
  if (error) console.error('[persist] saveCopilotMessage:', error.message);
}

export async function saveMeetingOutputs(
  meetingId: string,
  outputs: {
    summary: string;
    action_items: unknown[];
    requirement_doc: string;
    email_draft: string;
  }
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('meeting_outputs').upsert(
    {
      meeting_id: meetingId,
      summary: outputs.summary,
      action_items: outputs.action_items,
      requirement_doc: outputs.requirement_doc,
      email_draft: outputs.email_draft,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'meeting_id' }
  );
  if (error) console.error('[persist] saveMeetingOutputs:', error.message);
}

export async function saveMeetingPrep(
  meetingId: string,
  prep: { user_goals: string; ai_questions: unknown[]; checklist: unknown[] }
): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { error } = await db.from('meeting_prep').upsert(
    {
      meeting_id: meetingId,
      user_goals: prep.user_goals,
      ai_questions: prep.ai_questions,
      checklist: prep.checklist,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'meeting_id' }
  );
  if (error) console.error('[persist] saveMeetingPrep:', error.message);
}
