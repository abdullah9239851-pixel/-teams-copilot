'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

interface ActionItem { text: string; owner: 'yours' | 'client'; done?: boolean }
interface Pkg {
  summary: string;
  actionItems: ActionItem[];
  requirementDoc: string;
  emailDraft: string;
}

const EMPTY: Pkg = { summary: '', actionItems: [], requirementDoc: '', emailDraft: '' };

export function PostMeetingPage({ meetingId }: { meetingId: string }) {
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [title, setTitle] = useState('Meeting');
  const [tab, setTab] = useState<'summary' | 'actionItems' | 'requirementDoc' | 'emailDraft'>('summary');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    apiJson<{ meeting: any; outputs: any }>(`/api/meetings/${meetingId}`)
      .then((d) => {
        if (d.meeting?.title) setTitle(d.meeting.title);
        if (d.outputs) {
          setPkg({
            summary: d.outputs.summary || '',
            actionItems: d.outputs.action_items || [],
            requirementDoc: d.outputs.requirement_doc || '',
            emailDraft: d.outputs.email_draft || '',
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const generate = async () => {
    setGenerating(true);
    setError('');
    try {
      const data = await apiJson<Pkg>(`/api/meetings/${meetingId}/post-meeting`, { method: 'POST' });
      setPkg({ ...EMPTY, ...data });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!pkg) return;
    setSaving(true);
    try {
      await apiJson(`/api/meetings/${meetingId}/outputs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toMarkdown = (p: Pkg) =>
    `# ${title}\n\n## Executive Summary\n${p.summary}\n\n## Action Items\n${p.actionItems
      .map((a) => `- [${a.done ? 'x' : ' '}] (${a.owner}) ${a.text}`)
      .join('\n')}\n\n## Requirements\n${p.requirementDoc}\n\n## Follow-up Email\n${p.emailDraft}\n`;

  const copyAll = async () => {
    if (!pkg) return;
    await navigator.clipboard.writeText(toMarkdown(pkg));
    setCopied('all');
    setTimeout(() => setCopied(''), 1500);
  };

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMd = () => pkg && download(toMarkdown(pkg), `${title}.md`, 'text/markdown');
  const downloadDoc = () => {
    if (!pkg) return;
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'></head><body>${toMarkdown(pkg)
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/\n/g, '<br/>')}</body></html>`;
    download(html, `${title}.doc`, 'application/msword');
  };

  if (loading) return <div className="p-8 text-text-muted">Loading…</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Post-Meeting Package</h1>
        <p className="text-sm text-text-muted mt-1">{title}</p>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {!pkg ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted mb-4">Generate a complete package from the meeting transcript.</p>
          <button
            onClick={generate}
            disabled={generating}
            className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate Package'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={copyAll} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-primary hover:border-accent/40">
              {copied === 'all' ? 'Copied!' : 'Copy all'}
            </button>
            <button onClick={downloadMd} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-primary hover:border-accent/40">
              Download .md
            </button>
            <button onClick={downloadDoc} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-primary hover:border-accent/40">
              Download Word
            </button>
            <button onClick={generate} disabled={generating} className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-primary hover:border-accent/40 disabled:opacity-50">
              {generating ? 'Regenerating…' : 'Regenerate'}
            </button>
            <button onClick={save} disabled={saving} className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 ml-auto">
              {saving ? 'Saving…' : 'Save edits'}
            </button>
          </div>

          <div className="flex gap-1 mb-4 border-b border-border">
            {(['summary', 'actionItems', 'requirementDoc', 'emailDraft'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
              >
                {t === 'actionItems' ? 'Action Items' : t === 'requirementDoc' ? 'Requirements' : t === 'emailDraft' ? 'Email' : 'Summary'}
              </button>
            ))}
          </div>

          <div className="p-5 rounded-xl bg-bg-secondary border border-border">
            {tab === 'summary' && (
              <textarea
                value={pkg.summary}
                onChange={(e) => setPkg({ ...pkg, summary: e.target.value })}
                rows={8}
                className="w-full bg-transparent text-sm text-text-primary resize-none focus:outline-none"
              />
            )}
            {tab === 'requirementDoc' && (
              <textarea
                value={pkg.requirementDoc}
                onChange={(e) => setPkg({ ...pkg, requirementDoc: e.target.value })}
                rows={16}
                className="w-full bg-transparent text-sm text-text-primary font-mono resize-none focus:outline-none"
              />
            )}
            {tab === 'emailDraft' && (
              <textarea
                value={pkg.emailDraft}
                onChange={(e) => setPkg({ ...pkg, emailDraft: e.target.value })}
                rows={14}
                className="w-full bg-transparent text-sm text-text-primary resize-none focus:outline-none"
              />
            )}
            {tab === 'actionItems' && (
              <div className="space-y-2">
                {pkg.actionItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(item.done)}
                      onChange={(e) => {
                        const items = [...pkg.actionItems];
                        items[i] = { ...item, done: e.target.checked };
                        setPkg({ ...pkg, actionItems: items });
                      }}
                      className="accent-accent"
                    />
                    <input
                      value={item.text}
                      onChange={(e) => {
                        const items = [...pkg.actionItems];
                        items[i] = { ...item, text: e.target.value };
                        setPkg({ ...pkg, actionItems: items });
                      }}
                      className="flex-1 px-2 py-1 rounded bg-bg-primary border border-border text-sm text-text-primary focus:outline-none focus:border-accent"
                    />
                    <select
                      value={item.owner}
                      onChange={(e) => {
                        const items = [...pkg.actionItems];
                        items[i] = { ...item, owner: e.target.value as 'yours' | 'client' };
                        setPkg({ ...pkg, actionItems: items });
                      }}
                      className="px-2 py-1 rounded bg-bg-primary border border-border text-xs text-text-secondary focus:outline-none"
                    >
                      <option value="yours">yours</option>
                      <option value="client">client</option>
                    </select>
                    <button
                      onClick={() => setPkg({ ...pkg, actionItems: pkg.actionItems.filter((_, j) => j !== i) })}
                      className="text-xs text-danger px-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setPkg({ ...pkg, actionItems: [...pkg.actionItems, { text: '', owner: 'yours' }] })}
                  className="text-xs px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-text-primary"
                >
                  + Add action item
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
