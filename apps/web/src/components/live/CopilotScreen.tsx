'use client';

import { useSocket, SocketProvider } from './SocketProvider';

function CopilotContent({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  const { transcript, suggestions, botStatus, sendMessage } = useSocket();

  const getStatusColor = (s: string | null) => {
    switch (s) {
      case 'joining': return 'text-warning';
      case 'live': return 'text-accent';
      case 'transcribing': return 'text-success';
      case 'ai_listening': return 'text-accent';
      case 'error': return 'text-danger';
      default: return 'text-text-muted';
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: Transcript */}
      <div className="w-2/5 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">Live Transcript</h2>
          <span className={`text-xs ${getStatusColor(botStatus)}`}>
            {botStatus || 'disconnected'}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {transcript.length === 0 && (
            <p className="text-sm text-text-muted text-center mt-8">Waiting for transcript...</p>
          )}
          {transcript.map((seg, i) => (
            <div key={seg.id || i} className="text-sm">
              <span className="font-medium text-accent">{seg.speaker}</span>
              <p className="text-text-primary mt-0.5">{seg.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Center: Suggestions */}
      <div className="w-[35%] border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-medium text-text-primary">AI Suggestions</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {suggestions.length === 0 && (
            <p className="text-sm text-text-muted text-center mt-8">AI suggestions will appear here...</p>
          )}
          {suggestions.map((s, i) => (
            <div key={s.id || i} className="p-3 rounded-lg bg-bg-elevated border border-border">
              <p className="text-xs text-text-muted mb-1 uppercase">{s.type}</p>
              <p className="text-sm text-text-primary">{s.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Chat */}
      <div className="w-[25%] flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-medium text-text-primary">Chat with AI</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <p className="text-xs text-text-muted text-center mt-8">Ask the AI anything about the meeting...</p>
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
        {/* Top bar */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-text-primary">{meetingTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-text-muted">AI Listening</span>
          </div>
        </div>
        {/* Main */}
        <CopilotContent meetingId={meetingId} meetingTitle={meetingTitle} />
      </div>
    </SocketProvider>
  );
}
