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
import { generateSuggestions, chatWithAI, evaluateChecklist } from './services/llm';
import { retrieveKbContext } from './services/kb';
import {
  upsertMeeting,
  setMeetingStatus,
  saveTranscriptSegment,
  saveSuggestion,
  saveCopilotMessage,
  updateSuggestionFeedback,
  saveMeetingPrep,
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
}

const meetings = new Map<string, MeetingState>();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bot join
app.post('/api/meetings/join', async (req, res) => {
  const { meetingUrl, meetingId, title, goals, checklist, userId } = req.body;
  if (!meetingUrl || !meetingId) {
    return res.status(400).json({ error: 'meetingUrl and meetingId required' });
  }

  const checklistItems: ChecklistItem[] = Array.isArray(checklist)
    ? checklist.map((c: any) => (typeof c === 'string' ? { text: c, answered: false } : c))
    : [];

  // Init meeting state
  const state: MeetingState = {
    transcriptBuffer: [],
    recentSuggestions: [],
    goals: goals || '',
    checklist: checklistItems,
    lastSuggestionTime: 0,
  };
  meetings.set(meetingId, state);

  // Persist meeting (best-effort)
  await upsertMeeting({
    id: meetingId,
    title: title || 'Client Meeting',
    mode: 'live',
    join_link: meetingUrl,
    user_id: userId || null,
    status: 'live',
  });

  // Start suggestion + checklist loop (every 25s)
  state.suggestionInterval = setInterval(() => runSuggestionLoop(meetingId), 25000);

  try {
    const session = await bot.joinMeeting(meetingUrl, meetingId, 'Meeting Assistant', {
      onTranscript: (event: TranscriptEvent) => {
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
        io.to(meetingId).emit('bot_status', status);
        if (status === 'left' || status === 'error') {
          clearInterval(state.suggestionInterval);
          void setMeetingStatus(meetingId, status === 'error' ? 'failed' : 'completed', {
            end_time: new Date().toISOString(),
          });
        }
      },
    });

    state.sessionId = session.sessionId;
    void setMeetingStatus(meetingId, 'live', { bot_session_id: session.sessionId });
    res.json({ success: true, session });
  } catch (err: any) {
    meetings.delete(meetingId);
    clearInterval(state.suggestionInterval);
    void setMeetingStatus(meetingId, 'failed');
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

// Bot leave
app.post('/api/meetings/leave', async (req, res) => {
  const { sessionId, meetingId } = req.body;
  if (sessionId) await bot.leaveMeeting(sessionId);
  if (meetingId) {
    const state = meetings.get(meetingId);
    if (state) clearInterval(state.suggestionInterval);
    meetings.delete(meetingId);
    void setMeetingStatus(meetingId, 'completed', { end_time: new Date().toISOString() });
  }
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
