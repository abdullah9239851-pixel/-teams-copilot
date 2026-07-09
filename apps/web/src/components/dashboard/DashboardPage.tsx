'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { apiFetch, apiJson } from '@/lib/api';

const sampleTranscript = `Client: We are struggling to track project requests across email and spreadsheets.
You: What happens when a request is missed?
Client: The team loses time and sometimes commits to work without confirming budget.
You: What timeline are you hoping for?
Client: We need a first version in about six weeks.
Client: The decision maker is Sara from operations, but finance must approve the budget.`;

export function DashboardPage() {
  const [meetingTitle, setMeetingTitle] = useState('Practice Client Discovery');
  const [practiceTranscript, setPracticeTranscript] = useState(sampleTranscript);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [msConnected, setMsConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [recorded, setRecorded] = useState<any[]>([]);
  const [preparingId, setPreparingId] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const calendarConnected = msConnected || googleConnected;

  useEffect(() => {
    loadCalendar();
    apiJson<{ meetings: any[] }>('/api/meetings').then((d) => setRecorded(d.meetings)).catch(() => {});
  }, []);

  const loadCalendar = async () => {
    setCalendarLoading(true);
    setCalendarError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setCalendarLoading(false); return; }

      // Pull from both calendar sources and merge. A Teams meeting invited to a
      // Google Calendar carries its Teams join link inside the event body.
      const [ms, google] = await Promise.all([
        apiFetch('/api/microsoft/events').then((r) => r.json()).catch(() => ({})),
        apiFetch('/api/google/events').then((r) => r.json()).catch(() => ({})),
      ]);

      setMsConnected(Boolean(ms.connected));
      setGoogleConnected(Boolean(google.connected));

      const merged = [
        ...(ms.meetings || []).map((m: any) => ({ ...m, source: 'microsoft' })),
        ...(google.meetings || []).map((m: any) => ({ ...m, source: 'google' })),
      ].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());
      setEvents(merged);

      if (ms.error && google.error) setCalendarError(google.error);
    } catch (error: any) {
      setCalendarError(error.message || 'Could not load calendar');
    } finally {
      setCalendarLoading(false);
    }
  };

  const connect = async (provider: 'microsoft' | 'google') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { setCalendarError('Sign in before connecting a calendar.'); return; }
    window.location.href = `/api/${provider}/connect?userId=${encodeURIComponent(session.user.id)}`;
  };

  const prepare = async (event: any, thenJoin = false) => {
    setPreparingId(event.id);
    try {
      const { id } = await apiJson<{ id: string }>('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msEventId: event.id,
          title: event.title,
          agenda: event.agenda,
          attendees: event.attendees,
          joinLink: event.joinLink,
          start: event.start,
        }),
      });
      router.push(thenJoin ? `/briefing/${id}` : `/briefing/${id}`);
    } catch (err: any) {
      setCalendarError(err.message);
      setPreparingId('');
    }
  };

  const startPractice = () => {
    const lines = practiceTranscript.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const meetingId = `practice_${Date.now()}`;
    localStorage.setItem(`practice_session_${meetingId}`, JSON.stringify({
      title: meetingTitle || 'Practice Meeting',
      lines,
      createdAt: new Date().toISOString(),
    }));
    router.push(`/live/${meetingId}?practice=1&title=${encodeURIComponent(meetingTitle || 'Practice Meeting')}`);
  };

  const completed = recorded.filter((m) => m.status === 'completed').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Your meetings and activity overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Upcoming (14 days)" value={events.length} />
        <Stat label="Meetings recorded" value={recorded.length} />
        <Stat label="Completed packages" value={completed} />
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-text-primary">Calendar</h2>
          <div className="flex gap-2">
            {calendarConnected && (
              <button onClick={loadCalendar} className="px-4 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary hover:border-accent/40 transition-colors text-sm">
                Refresh
              </button>
            )}
            <button
              onClick={() => connect('google')}
              className="px-4 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary hover:border-accent/40 transition-colors text-sm"
            >
              {googleConnected ? 'Google ✓' : 'Connect Google'}
            </button>
            <button
              onClick={() => connect('microsoft')}
              className="px-4 py-2 rounded-lg bg-bg-secondary border border-border text-text-primary hover:border-accent/40 transition-colors text-sm"
            >
              {msConnected ? 'Microsoft ✓' : 'Connect Microsoft'}
            </button>
          </div>
        </div>
        <div className="p-6 rounded-xl bg-bg-secondary border border-border">
          {calendarLoading && <p className="text-sm text-text-muted">Loading calendar...</p>}
          {!calendarLoading && calendarError && <p className="text-sm text-danger">{calendarError}</p>}
          {!calendarLoading && !calendarConnected && !calendarError && (
            <p className="text-sm text-text-muted">Connect Google or Microsoft to pull your meetings, attendees, agenda, and Teams join links.</p>
          )}
          {!calendarLoading && calendarConnected && events.length === 0 && (
            <p className="text-sm text-text-muted">No upcoming meetings found in the next 14 days.</p>
          )}
          {!calendarLoading && events.length > 0 && (
            <div className="space-y-3">
              {events.map((meeting) => (
                <div key={meeting.id} className="p-4 rounded-lg bg-bg-primary border border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-primary">{meeting.title}</p>
                      <p className="text-xs text-text-muted mt-1">
                        {meeting.start ? new Date(meeting.start).toLocaleString() : 'Time unavailable'}
                      </p>
                      {meeting.agenda && <p className="text-xs text-text-muted mt-2 line-clamp-2">{meeting.agenda}</p>}
                    </div>
                    <button
                      onClick={() => prepare(meeting)}
                      disabled={preparingId === meeting.id}
                      className="px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {preparingId === meeting.id ? 'Opening…' : 'Prepare'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Practice Meeting Simulator</h2>
        <div className="p-6 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted mb-4">Paste or edit transcript lines, then play them like a live meeting.</p>
          <div className="space-y-3">
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Meeting title"
              className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm"
            />
            <textarea
              value={practiceTranscript}
              onChange={(e) => setPracticeTranscript(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm resize-none"
              placeholder="Speaker: transcript line"
            />
            <button
              onClick={startPractice}
              disabled={!practiceTranscript.trim()}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm disabled:opacity-50"
            >
              Start Practice Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-xl bg-bg-secondary border border-border">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="text-2xl font-semibold text-text-primary mt-1">{value}</p>
    </div>
  );
}
