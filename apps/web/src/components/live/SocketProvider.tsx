'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, BotStatus, TranscriptSegment, Suggestion, CopilotMessage, ChecklistItem } from '@teams-copilot/shared';

interface SocketContextType {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  botStatus: BotStatus | null;
  transcript: TranscriptSegment[];
  suggestions: Suggestion[];
  messages: CopilotMessage[];
  checklist: ChecklistItem[];
  outputsReady: boolean;
  joinMeeting: (meetingId: string) => void;
  leaveMeeting: (meetingId: string) => void;
  sendMessage: (content: string) => void;
  sendFeedback: (suggestionId: string, feedback: 'used' | 'dismissed') => void;
}

const SocketContext = createContext<SocketContextType>(null!);

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

const segmentKey = (s: { timestamp: number; speaker: string; text: string }) =>
  `${s.timestamp}_${s.speaker}_${s.text}`;

export function SocketProvider({ children, meetingId }: { children: React.ReactNode; meetingId?: string }) {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [outputsReady, setOutputsReady] = useState(false);

  useEffect(() => {
    const s = io(SERVER_URL) as Socket<ServerToClientEvents, ClientToServerEvents>;

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    s.on('transcript', (segment) => {
      setTranscript((prev) => {
        // Skip duplicates (a reconnect backfill may overlap with live pushes).
        if (prev.some((p) => segmentKey(p) === segmentKey(segment))) return prev;
        return [...prev, segment];
      });
    });

    s.on('suggestion', (suggestion) => {
      setSuggestions((prev) => [...prev, suggestion]);
    });

    s.on('bot_status', (status) => {
      setBotStatus(status);
    });

    s.on('checklist_update', (items) => {
      setChecklist(items);
    });

    s.on('post_meeting_ready', () => {
      setOutputsReady(true);
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

  // (Re)join the meeting room on every connect, and backfill the recent
  // transcript so a websocket drop doesn't leave a hole on screen.
  useEffect(() => {
    if (!meetingId || !isConnected || !socket) return;
    socket.emit('join_meeting', meetingId);

    fetch(`${SERVER_URL}/api/meetings/${meetingId}/transcript`)
      .then((r) => r.json())
      .then((d) => {
        const segments: Array<{ speaker: string; text: string; timestamp: number }> = d.segments || [];
        if (segments.length === 0) return;
        setTranscript((prev) => {
          const known = new Set(prev.map(segmentKey));
          const merged = [...prev];
          for (const seg of segments) {
            if (known.has(segmentKey(seg))) continue;
            merged.push({
              id: `seg_${seg.timestamp}_backfill`,
              meeting_id: meetingId,
              speaker: seg.speaker,
              text: seg.text,
              timestamp: seg.timestamp,
              created_at: new Date(seg.timestamp).toISOString(),
            });
          }
          return merged.sort((a, b) => a.timestamp - b.timestamp);
        });
      })
      .catch(() => {});
  }, [meetingId, isConnected, socket]);

  const joinMeeting = (mid: string) => socket?.emit('join_meeting', mid);
  const leaveMeeting = (mid: string) => socket?.emit('leave_meeting', mid);
  const sendMessage = (content: string) => {
    if (meetingId) socket?.emit('copilot_message', meetingId, content);
  };
  const sendFeedback = (suggestionId: string, feedback: 'used' | 'dismissed') => {
    if (meetingId) socket?.emit('suggestion_feedback', meetingId, suggestionId, feedback);
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, botStatus, transcript, suggestions, messages, checklist, outputsReady, joinMeeting, leaveMeeting, sendMessage, sendFeedback }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
