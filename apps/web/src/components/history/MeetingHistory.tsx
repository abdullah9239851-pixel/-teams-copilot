'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

interface MeetingRow {
  id: string;
  title: string;
  status: string;
  mode: string;
  start_time: string;
  clients?: { name: string; company: string } | null;
}

export function MeetingHistory() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    apiJson<{ meetings: MeetingRow[] }>('/api/meetings')
      .then((d) => setMeetings(d.meetings))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = meetings.filter(
    (m) =>
      m.title?.toLowerCase().includes(query.toLowerCase()) ||
      m.clients?.name?.toLowerCase().includes(query.toLowerCase())
  );

  const open = (m: MeetingRow) =>
    router.push(m.status === 'completed' ? `/live/${m.id}/post-meeting` : `/briefing/${m.id}`);

  const statusColor = (s: string) =>
    s === 'completed' ? 'text-success' : s === 'live' ? 'text-accent' : s === 'failed' ? 'text-danger' : 'text-text-muted';

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Meeting History</h1>
        <p className="text-sm text-text-muted mt-1">All past copilot sessions</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title or client…"
        className="w-full mb-5 px-4 py-2.5 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
      />

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted">No meetings yet</p>
          <p className="text-sm text-text-muted mt-1">Prepare a meeting from the dashboard to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => open(m)}
              className="w-full text-left p-4 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-text-primary font-medium">{m.title}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {m.clients?.name ? `${m.clients.name} · ` : ''}
                    {m.start_time ? new Date(m.start_time).toLocaleString() : ''}
                  </p>
                </div>
                <span className={`text-xs capitalize ${statusColor(m.status)}`}>{m.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
