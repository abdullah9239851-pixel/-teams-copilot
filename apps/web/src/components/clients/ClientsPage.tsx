'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiJson } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  company: string;
  notes: string;
  meetings?: { count: number }[];
}

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const router = useRouter();

  const load = () =>
    apiJson<{ clients: Client[] }>('/api/clients')
      .then((d) => setClients(d.clients))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await apiJson('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company }),
      });
      setName('');
      setCompany('');
      setAdding(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Clients</h1>
          <p className="text-sm text-text-muted mt-1">Everyone you meet with, and their history</p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          {adding ? 'Cancel' : 'Add client'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {adding && (
        <div className="mb-6 p-5 rounded-xl bg-bg-secondary border border-border flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name"
            className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company / domain"
            className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
          />
          <button onClick={create} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover">
            Save
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted">No clients yet</p>
          <p className="text-sm text-text-muted mt-1">Clients are created automatically from meeting attendees, or add one manually.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/clients/${c.id}`)}
              className="text-left p-4 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 transition-colors"
            >
              <p className="text-sm font-medium text-text-primary">{c.name}</p>
              <p className="text-xs text-text-muted mt-0.5">{c.company || '—'}</p>
              <p className="text-xs text-text-muted mt-2">{c.meetings?.[0]?.count ?? 0} meetings</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
