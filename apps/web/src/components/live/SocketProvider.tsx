'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, BotStatus, TranscriptSegment, Suggestion, CopilotMessage } from '@teams-copilot/shared';

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  botStatus: BotStatus | null;
  transcript: TranscriptSegment[];
  suggestions: Suggestion[];
  messages: CopilotMessage[];
  joinMeeting: (meetingId: string) => void;
  leaveMeeting: (meetingId: string) => void;
  sendMessage: (content: string) => void;
}

const SocketContext = createContext<SocketContextType>(null!);

export function SocketProvider({ children, meetingId }: { children: React.ReactNode; meetingId?: string }) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);

  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000') as Socket<ServerToClientEvents, ClientToServerEvents>;

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    s.on('transcript', (segment) => {
      setTranscript((prev) => [...prev, segment]);
    });

    s.on('suggestion', (suggestion) => {
      setSuggestions((prev) => [...prev, suggestion]);
    });

    s.on('bot_status', (status) => {
      setBotStatus(status);
    });

    s.on('copilot_message', (msg) => {
      setMessages((prev) => {
        const idx = prev.findIndex(m => m.id === msg.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = msg;
          return updated;
        }
        return [...prev, msg];
      });
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (meetingId && socket?.connected) {
      socket.emit('join_meeting', meetingId);
    }
  }, [meetingId, socket?.connected]);

  const joinMeeting = (mid: string) => socket?.emit('join_meeting', mid);
  const leaveMeeting = (mid: string) => socket?.emit('leave_meeting', mid);
  const sendMessage = (content: string) => {
    if (meetingId) socket?.emit('copilot_message', meetingId, content);
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, botStatus, transcript, suggestions, messages, joinMeeting, leaveMeeting, sendMessage }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
