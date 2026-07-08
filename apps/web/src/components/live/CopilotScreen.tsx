'use client';

import { useRef, useEffect } from 'react';
import { useSocket, SocketProvider } from './SocketProvider';

const typeIcons: Record<string, string> = {
  question: '?',
  missed_topic: '!',
  risk: '⚠',
  commitment: '→',
};

function CopilotContent({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  const { transcript, suggestions, messages, botStatus, sendMessage } = useSocket();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  const statusColor = (s: string | null) => {
    switch (s) {
      case 'joining': return 'text-warning';
      case 'in_lobby': return 'text-warning';
      case 'live': return 'text-accent';
      case 'transcribing': return 'text-success';
      case 'left': return 'text-text-muted';
      case 'error': return 'text-danger';
      default: return 'text-text-muted';
    }
  };

  return (
    <div className="flex h-full">
      {/* ─── LEFT: Live Transcript ─────────────── */}
      <div className="w-2/5 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Live Transcript</h2>
          <span className={`text-xs ${statusColor(botStatus)}`}>{botStatus || 'disconnected'}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {transcript.length === 0 && (
            <p className="text-sm text-text-muted text-center mt-12">Waiting for bot to join and transcribe...</p>
          )}
          {transcript.map((seg, i) => (
            <div key={seg.id || i} className="text-sm leading-relaxed">
              <span className="font-semibold text-accent text-xs">{seg.speaker}</span>
              <p className="text-text-primary mt-0.5">{seg.text}</p>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* ─── CENTER: AI Suggestions ────────────── */}
      <div className="w-[35%] border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">AI Suggestions</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.length === 0 && (
            <p className="text-sm text-text-muted text-center mt-12">
              AI will suggest questions, risks, and topics you might have missed...
            </p>
          )}
          {suggestions.map((s, i) => (
            <div
              key={s.id || i}
              className="p-3 rounded-lg bg-bg-elevated border border-border hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">{typeIcons[s.type] || '•'}</span>
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                  {s.type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-text-primary">{s.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT: Chat ───────────────────────── */}
      <div className="w-[25%] flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Ask AI</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-text-muted text-center mt-12">
              Ask anything about the meeting — questions, summaries, drafts...
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-white'
                    : 'bg-bg-elevated border border-border text-text-primary'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 border-t border-border">
          <input
            type="text"
            placeholder="Ask the AI..."
            className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                sendMessage(e.currentTarget.value.trim());
                e.currentTarget.value = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function CopilotScreen({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  return (
    <SocketProvider meetingId={meetingId}>
      <div className="flex flex-col h-screen bg-bg-primary">
        <div className="h-12 flex items-center justify-between px-5 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-text-primary">{meetingTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/live/${meetingId}/post-meeting`}
              className="text-xs px-3 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              Generate Package
            </a>
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-muted">AI Listening</span>
          </div>
        </div>
        <CopilotContent meetingId={meetingId} meetingTitle={meetingTitle} />
      </div>
    </SocketProvider>
  );
}
