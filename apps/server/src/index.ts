import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { ServerToClientEvents, ClientToServerEvents } from '@teams-copilot/shared';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

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

  // TODO: Phase 4 - call ScreenApp meeting bot API
  // For now, emit a status update
  io.to(meetingId).emit('bot_status', 'joining');

  res.json({ success: true, message: 'Bot join request received' });
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

  socket.on('copilot_message', (meetingId, content) => {
    // TODO: Phase 5 - send to LLM and emit response
    console.log(`Copilot message in ${meetingId}: ${content}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = parseInt(process.env.PORT || '4000');
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
