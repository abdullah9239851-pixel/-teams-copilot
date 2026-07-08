import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PlaywrightTeamsBot } from './services/bot';
import { generateSuggestions, chatWithAI } from './services/llm';
import type { TranscriptEvent, BotStatus } from './services/bot/types';
import type { Suggestion, CopilotMessage } from '@teams-copilot/shared';

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
  transcriptBuffer: TranscriptEvent[];
  recentSuggestions: string[];
  goals: string;
  checklist: string[];
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
  const { meetingUrl, meetingId } = req.body;
  if (!meetingUrl || !meetingId) {
    return res.status(400).json({ error: 'meetingUrl and meetingId required' });
  }

  // Init meeting state
  const state: MeetingState = {
    transcriptBuffer: [],
    recentSuggestions: [],
    goals: req.body.goals || '',
    checklist: req.body.checklist || [],
    lastSuggestionTime: 0,
  };
  meetings.set(meetingId, state);

  // Start suggestion loop (every 25s)
  state.suggestionInterval = setInterval(() => runSuggestionLoop(meetingId), 25000);

  try {
    const session = await bot.joinMeeting(meetingUrl, meetingId, 'Meeting Assistant', {
      onTranscript: (event: TranscriptEvent) => {
        state.transcriptBuffer.push(event);
        // Keep last 5 min of transcript
        const cutoff = Date.now() - 300_000;
        state.transcriptBuffer = state.transcriptBuffer.filter(t => t.timestamp > cutoff);

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
        }
      },
    });

    res.json({ success: true, session });
  } catch (err: any) {
    meetings.delete(meetingId);
    res.status(500).json({ error: err.message });
  }
});

// Suggestion engine
async function runSuggestionLoop(meetingId: string) {
  const state = meetings.get(meetingId);
  if (!state || state.transcriptBuffer.length === 0) return;

  // Rate limit: at least 30s between suggestions
  if (Date.now() - state.lastSuggestionTime < 25000) return;

  const transcriptWindow = state.transcriptBuffer
    .slice(-30) // Last ~30 segments
    .map(t => `${t.speaker}: ${t.text}`)
    .join('\n');

  try {
    const suggestions = await generateSuggestions({
      transcriptWindow,
      goals: state.goals,
      checklist: state.checklist,
      kbContext: '',
      recentSuggestions: state.recentSuggestions,
    });

    for (const s of suggestions) {
      const suggestion: Suggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        meeting_id: meetingId,
        type: s.type as SuggestionType,
        content: s.content,
        created_at: new Date().toISOString(),
        was_used: false,
      };
      state.recentSuggestions.push(s.content);
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
  }
  res.json({ success: true });
});

// Get transcript for a meeting
app.get('/api/meetings/:meetingId/transcript', (req, res) => {
  const state = meetings.get(req.params.meetingId);
  res.json({ segments: state?.transcriptBuffer || [] });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_meeting', (meetingId: string) => {
    socket.join(meetingId);
    console.log(`Socket ${socket.id} joined meeting ${meetingId}`);
  });

  socket.on('leave_meeting', (meetingId: string) => {
    socket.leave(meetingId);
  });

  socket.on('copilot_message', async (meetingId: string, content: string) => {
    const state = meetings.get(meetingId);
    if (!state) return;

    // Emit user message
    const userMsg: CopilotMessage = { id: `msg_${Date.now()}`, meeting_id: meetingId, role: 'user', content, timestamp: new Date().toISOString() };
    io.to(meetingId).emit('copilot_message', userMsg);

    // Transcript for context
    const transcript = state.transcriptBuffer.slice(-50).map(t => `${t.speaker}: ${t.text}`).join('\n');

    // Stream AI response
    const msgId = `msg_${Date.now()}_ai`;
    const assistantMsg: CopilotMessage = { id: msgId, meeting_id: meetingId, role: 'assistant', content: '', timestamp: new Date().toISOString() };

    try {
      await chatWithAI(transcript, content, '', (token) => {
        assistantMsg.content += token;
        io.to(meetingId).emit('copilot_message', { ...assistantMsg });
      });
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
  for (const [id, state] of meetings) clearInterval(state.suggestionInterval);
  await bot.cleanup();
  process.exit(0);
});

const PORT = parseInt(process.env.PORT || '4000');
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
