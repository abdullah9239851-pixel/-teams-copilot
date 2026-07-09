'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';

interface KBDoc {
  id: string;
  title: string;
  type: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export function KnowledgeBase() {
  const [docs, setDocs] = useState<KBDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'note' | 'template'>('note');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ documents: KBDoc[] }>('/api/kb');
      setDocs(data.documents);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', file.name);
      const res = await apiFetch('/api/kb', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addText = async () => {
    if (!noteText.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiJson('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle || (tab === 'template' ? 'Question Template' : 'Note'),
          type: tab === 'template' ? 'template' : 'notes',
          text: noteText,
        }),
      });
      setNoteTitle('');
      setNoteText('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await apiJson(`/api/kb/${id}`, { method: 'DELETE' });
      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Knowledge Base</h1>
        <p className="text-sm text-text-muted mt-1">
          Upload documents, notes, and question templates. The AI retrieves these during briefings and live calls.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Upload files */}
        <div className="p-5 rounded-xl bg-bg-secondary border border-border">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Upload a document</h2>
          <p className="text-xs text-text-muted mb-4">PDF, DOCX, or TXT — pricing sheets, portfolio, case studies.</p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
            disabled={busy}
            className="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent file:text-white file:text-sm file:font-medium hover:file:bg-accent-hover file:cursor-pointer disabled:opacity-50"
          />
        </div>

        {/* Add notes / templates */}
        <div className="p-5 rounded-xl bg-bg-secondary border border-border">
          <div className="flex gap-1 mb-3">
            {(['note', 'template'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-xs ${tab === t ? 'bg-accent text-white' : 'bg-bg-elevated text-text-secondary border border-border'}`}
              >
                {t === 'note' ? 'Freeform note' : 'Question template'}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title"
            className="w-full mb-2 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
          />
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder={tab === 'template' ? 'New web project discovery: budget, timeline, decision maker…' : 'Our hosting starts at…'}
            className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm resize-none focus:outline-none focus:border-accent"
          />
          <button
            onClick={addText}
            disabled={busy || !noteText.trim()}
            className="mt-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Add to knowledge base'}
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-text-primary mb-3">Documents ({docs.length})</h2>
      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted">No documents yet</p>
          <p className="text-sm text-text-muted mt-1">Upload a file or add a note to build your knowledge base</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-bg-secondary border border-border">
              <div>
                <p className="text-sm font-medium text-text-primary">{doc.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  <span className="uppercase">{doc.type}</span> · {doc.chunk_count} chunks
                  {doc.status !== 'ready' && <span className="text-warning"> · {doc.status}</span>}
                </p>
              </div>
              <button
                onClick={() => remove(doc.id)}
                className="text-xs px-3 py-1.5 rounded-md text-danger hover:bg-danger/10 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
