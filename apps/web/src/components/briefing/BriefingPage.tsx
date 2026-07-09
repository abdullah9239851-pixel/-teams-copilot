'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

interface Meeting {
  id: string;
  title: string;
  agenda?: string;
  join_link?: string;
  start_time?: string;
  attendees?: any[];
  clients?: { id: string; name: string; company: string } | null;
}

export function BriefingPage({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [goals, setGoals] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;

  useEffect(() => {
    apiJson<{ meeting: Meeting; prep: any }>(`/api/prep/${meetingId}`)
      .then((data) => {
        setMeeting(data.meeting);
        setGoals(data.prep?.user_goals || '');
        setQuestions(data.prep?.ai_questions || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const saveGoals = () => {
    apiJson(`/api/prep/${meetingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goals, questions, checklist: questions.map((q) => ({ text: q, answered: false })) }),
    }).catch(() => {});
  };

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await apiJson<{ questions: string[] }>(`/api/prep/${meetingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals }),
      });
      setQuestions(data.questions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const joinWithCopilot = async () => {
    if (!meeting) return;
    setJoining(true);
    try {
      const {
        data: { session },
      } = await (await import('@/lib/supabase')).createClient().auth.getSession();

      if (backendUrl && meeting.join_link) {
        await fetch(`${backendUrl}/api/meetings/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            meetingUrl: meeting.join_link,
            meetingId: meeting.id,
            title: meeting.title,
            goals,
            checklist: questions,
            userId: session?.user?.id,
          }),
        });
      }
      router.push(`/live/${meeting.id}?title=${encodeURIComponent(meeting.title)}`);
    } catch (err: any) {
      setError(err.message);
      setJoining(false);
    }
  };

  if (loading) return <div className="p-8 text-text-muted">Loading briefing…</div>;
  if (!meeting) return <div className="p-8 text-danger">{error || 'Meeting not found'}</div>;

  const attendeeNames = (meeting.attendees || []).map((a) =>
    typeof a === 'string' ? a : a?.name || a?.address || ''
  ).filter(Boolean);

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.push('/')} className="text-xs text-text-muted hover:text-text-primary mb-4">
        ← Dashboard
      </button>

      <h1 className="text-2xl font-semibold text-text-primary">{meeting.title}</h1>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-text-muted">
        {meeting.start_time && <span>{new Date(meeting.start_time).toLocaleString()}</span>}
        {meeting.clients && <span>Client: {meeting.clients.name}</span>}
        {attendeeNames.length > 0 && <span>{attendeeNames.length} attendees</span>}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {meeting.agenda && (
        <div className="mt-6 p-4 rounded-xl bg-bg-secondary border border-border">
          <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">Agenda</h2>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{meeting.agenda}</p>
        </div>
      )}

      {attendeeNames.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {attendeeNames.map((n, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-bg-elevated border border-border text-text-secondary">
              {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-primary mb-2">Your goals for this meeting</h2>
        <textarea
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          onBlur={saveGoals}
          rows={3}
          placeholder="e.g. Understand their budget range and decision timeline; confirm the decision maker."
          className="w-full px-4 py-3 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted text-sm resize-none focus:outline-none focus:border-accent"
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-text-primary">AI-prepared discovery questions</h2>
          <button
            onClick={generate}
            disabled={generating}
            className="text-xs px-3 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating…' : questions.length ? 'Regenerate' : 'Generate questions'}
          </button>
        </div>
        {questions.length === 0 ? (
          <div className="p-6 rounded-xl bg-bg-secondary border border-border text-center text-sm text-text-muted">
            Add your goals, then generate questions grounded in the agenda and your knowledge base.
          </div>
        ) : (
          <ol className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg bg-bg-secondary border border-border text-sm text-text-primary">
                <span className="text-accent font-medium">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={joinWithCopilot}
          disabled={joining}
          className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join with Copilot'}
        </button>
        {!meeting.join_link && (
          <span className="self-center text-xs text-text-muted">No join link — open from a Teams calendar event.</span>
        )}
      </div>
    </div>
  );
}
