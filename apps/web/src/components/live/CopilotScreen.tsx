'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket, SocketProvider } from './SocketProvider';
import { apiJson } from '@/lib/api';

const typeIcons: Record<string, string> = {
  question: '?',
  missed_topic: '!',
  risk: '⚠',
  commitment: '→',
};

function parseTranscriptLine(line: string, index: number) {
  const separator = line.indexOf(':');
  const speaker = separator > 0 ? line.slice(0, separator).trim() : `Speaker ${index + 1}`;
  const text = separator > 0 ? line.slice(separator + 1).trim() : line;

  return {
    id: `practice_${index}`,
    speaker,
    text,
    timestamp: Date.now() + index,
    created_at: new Date().toISOString(),
  };
}

function PracticeCopilotScreen({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  const searchParams = useSearchParams();
  const [lines, setLines] = useState<ReturnType<typeof parseTranscriptLine>[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [question, setQuestion] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const title = searchParams.get('title') || meetingTitle;

  useEffect(() => {
    const raw = localStorage.getItem(`practice_session_${meetingId}`);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as { lines?: string[] };
      setLines((saved.lines || []).map(parseTranscriptLine));
    } catch {
      setLines([]);
    }
  }, [meetingId]);

  useEffect(() => {
    if (!playing) return;
    if (visibleCount >= lines.length) {
      setPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), 1600);
    return () => window.clearTimeout(timer);
  }, [playing, visibleCount, lines.length]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleCount]);

  const transcript = lines.slice(0, visibleCount);
  const transcriptText = transcript.map((line) => `${line.speaker}: ${line.text}`).join('\n').toLowerCase();

  const checklist = useMemo(() => {
    const items = [
      ['Problem', ['problem', 'struggling', 'issue', 'pain']],
      ['Budget', ['budget', 'cost', 'price', 'finance']],
      ['Timeline', ['timeline', 'week', 'month', 'deadline']],
      ['Decision maker', ['decision maker', 'approve', 'approval']],
      ['Success criteria', ['success', 'goal', 'outcome']],
    ] as const;

    return items.map(([label, keywords]) => ({
      label,
      status: keywords.some((keyword) => transcriptText.includes(keyword)) ? 'Confirmed' : 'Missing',
    }));
  }, [transcriptText]);

  const suggestions = checklist
    .filter((item) => item.status === 'Missing')
    .slice(0, 3)
    .map((item) => `Ask about ${item.label.toLowerCase()}.`);

  const completeness = checklist.length
    ? Math.round((checklist.filter((item) => item.status === 'Confirmed').length / checklist.length) * 100)
    : 0;

  const [asking, setAsking] = useState(false);

  const askPracticeAI = async () => {
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    const transcriptStr = transcript.map((line) => `${line.speaker}: ${line.text}`).join('\n');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    setQuestion('');
    setAsking(true);
    try {
      const { answer } = await apiJson<{ answer: string }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcriptStr, message: trimmed }),
      });
      setMessages((current) => [...current, { role: 'assistant', content: answer || 'No answer.' }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'Sorry, the AI could not answer right now.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <div className="h-12 flex items-center justify-between px-5 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
            ← Back
          </a>
          <h1 className="text-sm font-medium text-text-primary">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPlaying((value) => !value)} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white">
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => setVisibleCount((count) => Math.min(lines.length, count + 1))} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated text-text-primary border border-border">
            Next
          </button>
          <button onClick={() => { setVisibleCount(0); setPlaying(false); setMessages([]); }} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated text-text-primary border border-border">
            Restart
          </button>
          <span className="text-xs text-text-muted">Practice mode</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-2/5 border-r border-border flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Simulated Transcript</h2>
            <span className="text-xs text-text-muted">{visibleCount}/{lines.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.length === 0 && <p className="text-sm text-text-muted text-center mt-12">Press Play to start the transcript.</p>}
            {transcript.map((seg) => (
              <div key={seg.id} className="text-sm leading-relaxed">
                <span className="font-semibold text-accent text-xs">{seg.speaker}</span>
                <p className="text-text-primary mt-0.5">{seg.text}</p>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        <div className="w-[35%] border-r border-border flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Meeting Coach</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="p-4 rounded-lg bg-bg-elevated border border-border">
              <p className="text-xs uppercase text-text-muted mb-1">Completeness</p>
              <p className="text-2xl font-semibold text-text-primary">{completeness}%</p>
            </div>
            <div className="space-y-2">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm p-3 rounded-lg bg-bg-elevated border border-border">
                  <span className="text-text-primary">{item.label}</span>
                  <span className={item.status === 'Confirmed' ? 'text-success' : 'text-warning'}>{item.status}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">Suggested Questions</h3>
              <div className="space-y-2">
                {suggestions.length === 0 ? <p className="text-sm text-text-muted">Core discovery items covered.</p> : suggestions.map((item) => (
                  <div key={item} className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm text-text-primary">{item}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-[25%] flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Ask AI</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && <p className="text-xs text-text-muted text-center mt-12">Ask the AI about the transcript, or anything else.</p>}
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-accent text-white' : 'bg-bg-elevated border border-border text-text-primary'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {asking && <p className="text-xs text-text-muted">AI is thinking…</p>}
          </div>
          <div className="p-3 border-t border-border">
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') askPracticeAI();
              }}
              disabled={asking}
              placeholder={asking ? 'Thinking…' : 'Ask the AI...'}
              className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent disabled:opacity-50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CopilotContent({ meetingId, meetingTitle }: { meetingId: string; meetingTitle: string }) {
  const { transcript, suggestions, messages, botStatus, checklist, sendMessage, sendFeedback } = useSocket();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const act = (id: string, feedback: 'used' | 'dismissed') => {
    sendFeedback(id, feedback);
    setDismissed((prev) => new Set(prev).add(id));
  };

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

      {/* ─── CENTER: Checklist + AI Suggestions ── */}
      <div className="w-[35%] border-r border-border flex flex-col">
        {checklist.length > 0 && (
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary mb-2">Checklist</h2>
            <div className="space-y-1.5">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={item.answered ? 'text-success' : 'text-text-muted'}>
                    {item.answered ? '✓' : '○'}
                  </span>
                  <span className={item.answered ? 'text-text-muted line-through' : 'text-text-secondary'}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">AI Suggestions</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.filter((s) => !dismissed.has(s.id)).length === 0 && (
            <p className="text-sm text-text-muted text-center mt-12">
              AI will suggest questions, risks, and topics you might have missed...
            </p>
          )}
          {suggestions
            .filter((s) => !dismissed.has(s.id))
            .map((s, i) => (
              <div
                key={s.id || i}
                className="p-3 rounded-lg bg-bg-elevated border border-border hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">{typeIcons[s.type] || '•'}</span>
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                    {s.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-text-primary">{s.content}</p>
                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => act(s.id, 'used')} className="text-[10px] px-2 py-0.5 rounded bg-success/10 text-success hover:bg-success/20">
                    Used
                  </button>
                  <button onClick={() => act(s.id, 'dismissed')} className="text-[10px] px-2 py-0.5 rounded bg-bg-primary text-text-muted hover:text-text-primary">
                    Dismiss
                  </button>
                </div>
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
  const searchParams = useSearchParams();

  if (searchParams.get('practice') === '1') {
    return <PracticeCopilotScreen meetingId={meetingId} meetingTitle={meetingTitle} />;
  }

  return (
    <SocketProvider meetingId={meetingId}>
      <div className="flex flex-col h-screen bg-bg-primary">
        <div className="h-12 flex items-center justify-between px-5 border-b border-border bg-bg-secondary">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary transition-colors">
              ← Back
            </a>
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
