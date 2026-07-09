import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
// Load the repo-root .env (shared with the web app) as well as a local one.
dotenv.config();
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PlaywrightTeamsBot } from './services/bot';
import { generateSuggestions, chatWithAI, evaluateChecklist, generatePostMeeting } from './services/llm';
import { retrieveKbContext } from './services/kb';
import {
  upsertMeeting,
  setMeetingStatus,
  saveTranscriptSegment,
  saveSuggestion,
  saveCopilotMessage,
  updateSuggestionFeedback,
  saveMeetingPrep,
  saveMeetingOutputs,
  getFullTranscript,
  hasMeetingOutputs,
  getMeetingRow,
  getMeetingPrep,
} from './services/persistence';
import type { TranscriptEvent, BotStatus } from './services/bot/types';
import type { Suggestion, SuggestionType, CopilotMessage, ChecklistItem } from '@teams-copilot/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const bot = new PlaywrightTeamsBot();

// ─── Meeting state ────────────────────────────────
interface MeetingState {
  sessionId?: string;
  transcriptBuffer: TranscriptEvent[];
  recentSuggestions: string[];
  goals: string;
  checklist: ChecklistItem[];
  suggestionInterval?: ReturnType<typeof setInterval>;
  lastSuggestionTime: number;
  finalizing: boolean;
}

const meetings = new Map<string, MeetingState>();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Shared bot-start logic for join + rejoin.
interface StartBotOptions {
  meetingUrl: string;
  meetingId: string;
  title?: string;
  goals?: string;
  checklist?: ChecklistItem[];
  userId?: string | null;
  persistMeeting?: boolean;
}

async function startBot(opts: StartBotOptions) {
  const { meetingId, meetingUrl } = opts;

  // Init meeting state
  const state: MeetingState = {
    transcriptBuffer: [],
    recentSuggestions: [],
    goals: opts.goals || '',
    checklist: opts.checklist || [],
    lastSuggestionTime: 0,
    finalizing: false,
  };
  meetings.set(meetingId, state);

  // Persist meeting (best-effort). Skipped on rejoin so we don't overwrite
  // fields (client, agenda) already set when the meeting was prepared.
  if (opts.persistMeeting !== false) {
    await upsertMeeting({
      id: meetingId,
      title: opts.title || 'Client Meeting',
      mode: 'live',
      join_link: meetingUrl,
      user_id: opts.userId || null,
      status: 'live',
    });
  }

  // Start suggestion + checklist loop (every 25s)
  state.suggestionInterval = setInterval(() => runSuggestionLoop(meetingId), 25000);

  try {
    const session = await bot.joinMeeting(meetingUrl, meetingId, 'Meeting Assistant', {
      onTranscript: (event: TranscriptEvent) => {
        if (meetings.get(meetingId) !== state) return; // stale session after a rejoin

        state.transcriptBuffer.push(event);
        // Keep last 5 min of transcript in memory
        const cutoff = Date.now() - 300_000;
        state.transcriptBuffer = state.transcriptBuffer.filter((t) => t.timestamp > cutoff);

        void saveTranscriptSegment(meetingId, event);

        io.to(meetingId).emit('transcript', {
          id: `seg_${event.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
          meeting_id: meetingId,
          speaker: event.speaker,
          text: event.text,
          timestamp: event.timestamp,
          created_at: new Date().toISOString(),
        });
      },
      onStatus: (status: BotStatus) => {
        if (meetings.get(meetingId) !== state) return; // stale session after a rejoin

        io.to(meetingId).emit('bot_status', status);
        if (status === 'left' || status === 'error') {
          void finalizeMeeting(meetingId, status === 'error' ? 'failed' : 'completed');
        }
      },
    });

    state.sessionId = session.sessionId;
    void setMeetingStatus(meetingId, 'live', { bot_session_id: session.sessionId });
    return session;
  } catch (err) {
    if (meetings.get(meetingId) === state) meetings.delete(meetingId);
    clearInterval(state.suggestionInterval);
    void setMeetingStatus(meetingId, 'failed');
    throw err;
  }
}

// Bot join
app.post('/api/meetings/join', async (req, res) => {
  const { meetingUrl, meetingId, title, goals, checklist, userId } = req.body;
  if (!meetingUrl || !meetingId) {
    return res.status(400).json({ error: 'meetingUrl and meetingId required' });
  }

  const checklistItems: ChecklistItem[] = Array.isArray(checklist)
    ? checklist.map((c: any) => (typeof c === 'string' ? { text: c, answered: false } : c))
    : [];

  try {
    const session = await startBot({ meetingUrl, meetingId, title, goals, checklist: checklistItems, userId });
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot rejoin — recovery after a bot failure or drop, using the stored join link.
app.post('/api/meetings/rejoin', async (req, res) => {
  const { meetingId } = req.body;
  if (!meetingId) return res.status(400).json({ error: 'meetingId required' });

  // Drop any stale session without finalizing (we're recovering, not ending).
  const existing = meetings.get(meetingId);
  if (existing) {
    clearInterval(existing.suggestionInterval);
    existing.finalizing = true;
    meetings.delete(meetingId);
    if (existing.sessionId) await bot.leaveMeeting(existing.sessionId).catch(() => {});
  }

  const row = await getMeetingRow(meetingId);
  if (!row?.join_link) {
    return res.status(404).json({ error: 'No stored join link for this meeting' });
  }
  const prep = await getMeetingPrep(meetingId);
  const checklistItems: ChecklistItem[] = Array.isArray(prep?.checklist)
    ? (prep!.checklist as any[]).map((c: any) => (typeof c === 'string' ? { text: c, answered: false } : c))
    : [];

  try {
    const session = await startBot({
      meetingUrl: row.join_link,
      meetingId,
      title: row.title,
      goals: prep?.user_goals || '',
      checklist: checklistItems,
      userId: row.user_id,
      persistMeeting: false,
    });
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Suggestion + live-checklist engine
async function runSuggestionLoop(meetingId: string) {
  const state = meetings.get(meetingId);
  if (!state || state.transcriptBuffer.length === 0) return;
  if (Date.now() - state.lastSuggestionTime < 25000) return;

  const transcriptWindow = state.transcriptBuffer
    .slice(-30)
    .map((t) => `${t.speaker}: ${t.text}`)
    .join('\n');

  // Retrieve knowledge-base context relevant to the recent conversation.
  const kbContext = await retrieveKbContext(transcriptWindow).catch(() => '');

  // 1. Live checklist auto-tick
  if (state.checklist.length > 0) {
    try {
      const answered = await evaluateChecklist(
        transcriptWindow,
        state.checklist.map((c) => c.text)
      );
      let changed = false;
      answered.forEach((idx) => {
        if (state.checklist[idx] && !state.checklist[idx].answered) {
          state.checklist[idx].answered = true;
          changed = true;
        }
      });
      if (changed) {
        io.to(meetingId).emit('checklist_update', state.checklist);
        void saveMeetingPrep(meetingId, {
          user_goals: state.goals,
          ai_questions: state.checklist.map((c) => c.text),
          checklist: state.checklist,
        });
      }
    } catch (err) {
      console.error(`Checklist eval error for ${meetingId}:`, err);
    }
  }

  // 2. Proactive suggestions
  try {
    const suggestions = await generateSuggestions({
      transcriptWindow,
      goals: state.goals,
      checklist: state.checklist.map((c) => c.text),
      kbContext,
      recentSuggestions: state.recentSuggestions,
    });

    for (const s of suggestions) {
      const persistedId = await saveSuggestion(meetingId, s.type, s.content);
      const suggestion: Suggestion = {
        id: persistedId || `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        meeting_id: meetingId,
        type: s.type as SuggestionType,
        content: s.content,
        created_at: new Date().toISOString(),
        was_used: false,
      };
      state.recentSuggestions.push(s.content);
      if (state.recentSuggestions.length > 20) state.recentSuggestions.shift();
      state.lastSuggestionTime = Date.now();
      io.to(meetingId).emit('suggestion', suggestion);
    }
  } catch (err) {
    console.error(`Suggestion error for ${meetingId}:`, err);
  }
}

// Meeting end: mark final status, then auto-generate the post-meeting package
// (requirement: full package ready within ~2 minutes of meeting end).
async function finalizeMeeting(meetingId: string, finalStatus: 'completed' | 'failed') {
  const state = meetings.get(meetingId);
  if (state) {
    if (state.finalizing) return;
    state.finalizing = true;
    clearInterval(state.suggestionInterval);
  }

  await setMeetingStatus(meetingId, finalStatus, { end_time: new Date().toISOString() });

  try {
    if (await hasMeetingOutputs(meetingId)) return; // already generated (e.g. manually)

    let segments: Array<{ speaker: string; text: string }> = await getFullTranscript(meetingId);
    if (segments.length === 0 && state) segments = state.transcriptBuffer; // DB-down fallback
    if (segments.length === 0) return; // nothing was transcribed

    const transcript = segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
    const pkg = await generatePostMeeting(transcript, state?.goals || '');
    if (!pkg) return;

    await saveMeetingOutputs(meetingId, {
      summary: pkg.summary,
      action_items: pkg.actionItems,
      requirement_doc: pkg.requirementDoc,
      email_draft: pkg.emailDraft,
    });
    io.to(meetingId).emit('post_meeting_ready', meetingId);
    console.log(`[post-meeting] Package auto-generated for ${meetingId}`);
  } catch (err) {
    console.error(`[post-meeting] Auto-generation failed for ${meetingId}:`, err);
  } finally {
    meetings.delete(meetingId);
  }
}

// Bot leave
app.post('/api/meetings/leave', async (req, res) => {
  const { sessionId, meetingId } = req.body;
  if (sessionId) await bot.leaveMeeting(sessionId);
  if (meetingId) void finalizeMeeting(meetingId, 'completed');
  res.json({ success: true });
});

// Live in-memory transcript (fast path for the active meeting)
app.get('/api/meetings/:meetingId/transcript', (req, res) => {
  const state = meetings.get(req.params.meetingId);
  res.json({ segments: state?.transcriptBuffer || [] });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_meeting', (meetingId: string) => {
    socket.join(meetingId);
    const state = meetings.get(meetingId);
    if (state && state.checklist.length > 0) {
      socket.emit('checklist_update', state.checklist);
    }
  });

  socket.on('leave_meeting', (meetingId: string) => {
    socket.leave(meetingId);
  });

  socket.on('suggestion_feedback', (_meetingId: string, suggestionId: string, feedback: 'used' | 'dismissed') => {
    if (!suggestionId) return;
    void updateSuggestionFeedback(suggestionId, {
      was_used: feedback === 'used',
      dismissed: feedback === 'dismissed',
    });
  });

  socket.on('copilot_message', async (meetingId: string, content: string) => {
    const state = meetings.get(meetingId);
    if (!state) return;

    const userMsg: CopilotMessage = {
      id: `msg_${Date.now()}`,
      meeting_id: meetingId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    io.to(meetingId).emit('copilot_message', userMsg);
    void saveCopilotMessage(meetingId, 'user', content);

    const transcript = state.transcriptBuffer.slice(-50).map((t) => `${t.speaker}: ${t.text}`).join('\n');
    const kbContext = await retrieveKbContext(`${content}\n${transcript.slice(-500)}`).catch(() => '');

    const msgId = `msg_${Date.now()}_ai`;
    const assistantMsg: CopilotMessage = {
      id: msgId,
      meeting_id: meetingId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    try {
      await chatWithAI(transcript, content, kbContext, (token) => {
        assistantMsg.content += token;
        io.to(meetingId).emit('copilot_message', { ...assistantMsg });
      });
      void saveCopilotMessage(meetingId, 'assistant', assistantMsg.content);
    } catch (err) {
      assistantMsg.content = 'Sorry, I encountered an error processing your question.';
      io.to(meetingId).emit('copilot_message', { ...assistantMsg });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup
process.on('SIGINT', async () => {
  for (const [, state] of meetings) clearInterval(state.suggestionInterval);
  await bot.cleanup();
  process.exit(0);
});

const PORT = parseInt(process.env.PORT || '4000');
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
