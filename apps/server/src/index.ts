import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PlaywrightTeamsBot } from './services/bot';
import type { TranscriptEvent, BotStatus } from './services/bot/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const bot = new PlaywrightTeamsBot();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bot join endpoint
app.post('/api/meetings/join', async (req, res) => {
  const { meetingUrl, meetingId } = req.body;
  if (!meetingUrl || !meetingId) {
    return res.status(400).json({ error: 'meetingUrl and meetingId required' });
  }

  try {
    const session = await bot.joinMeeting(meetingUrl, meetingId, 'Meeting Assistant', {
      onTranscript: (event: TranscriptEvent) => {
        io.to(meetingId).emit('transcript', {
          meeting_id: meetingId,
          speaker: event.speaker,
          text: event.text,
          timestamp: event.timestamp,
          id: `seg_${event.timestamp}`,
          created_at: new Date().toISOString(),
        });
      },
      onStatus: (status: BotStatus) => {
        io.to(meetingId).emit('bot_status', status);
      },
    });

    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bot leave endpoint
app.post('/api/meetings/leave', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  await bot.leaveMeeting(sessionId);
  res.json({ success: true });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_meeting', (meetingId) => {
    socket.join(meetingId);
    console.log(`Socket ${socket.id} joined meeting ${meetingId}`);
  });

  socket.on('leave_meeting', (meetingId) => {
    socket.leave(meetingId);
  });

  socket.on('copilot_message', async (meetingId, content) => {
    // TODO: Phase 5 - send to LLM
    console.log(`Copilot message in ${meetingId}: ${content}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Cleanup on exit
process.on('SIGINT', async () => {
  await bot.cleanup();
  process.exit(0);
});

const PORT = parseInt(process.env.PORT || '4000');
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
