'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  company: string;
  notes: string;
}
interface MeetingRow {
  id: string;
  title: string;
  status: string;
  start_time: string;
  meeting_outputs?: { summary: string } | null;
}

export function ClientDetail({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    apiJson<{ client: Client; meetings: MeetingRow[] }>(`/api/clients/${clientId}`)
      .then((d) => {
        setClient(d.client);
        setNotes(d.client.notes || '');
        setMeetings(d.meetings);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientId]);

  const saveNotes = () => {
    apiJson(`/api/clients/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).catch(() => {});
  };

  if (loading) return <div className="p-8 text-text-muted">Loading…</div>;
  if (!client) return <div className="p-8 text-danger">{error || 'Client not found'}</div>;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.push('/clients')} className="text-xs text-text-muted hover:text-text-primary mb-4">
        ← Clients
      </button>
      <h1 className="text-2xl font-semibold text-text-primary">{client.name}</h1>
      <p className="text-sm text-text-muted mt-1">{client.company || '—'}</p>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-primary mb-2">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={3}
          placeholder="Anything worth remembering about this client…"
          className="w-full px-4 py-3 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted text-sm resize-none focus:outline-none focus:border-accent"
        />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-text-primary mb-3">Meetings ({meetings.length})</h2>
        {meetings.length === 0 ? (
          <p className="text-sm text-text-muted">No meetings recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(m.status === 'completed' ? `/live/${m.id}/post-meeting` : `/briefing/${m.id}`)}
                className="w-full text-left p-4 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">{m.title}</p>
                  <span className="text-xs text-text-muted">{new Date(m.start_time).toLocaleDateString()}</span>
                </div>
                {m.meeting_outputs?.summary && (
                  <p className="text-xs text-text-muted mt-1 line-clamp-2">{m.meeting_outputs.summary}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
