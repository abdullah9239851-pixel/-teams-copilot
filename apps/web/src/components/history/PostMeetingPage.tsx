'use client';

import { useState } from 'react';

export function PostMeetingPage({ meetingId }: { meetingId: string }) {
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState('summary');
  const [packageData, setPackageData] = useState<any>(null);

  const generatePackage = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`http://localhost:4000/api/meetings/${meetingId}/post-meeting`, {
        method: 'POST',
      });
      const data = await res.json();
      setPackageData(data);
    } catch (err) {
      console.error('Failed to generate package:', err);
    }
    setGenerating(false);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Post-Meeting Package</h1>
        <p className="text-sm text-text-muted mt-1">Generated deliverables for this meeting</p>
      </div>

      {!packageData ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted mb-4">Generate a complete post-meeting package</p>
          <button
            onClick={generatePackage}
            disabled={generating}
            className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Package'}
          </button>
        </div>
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {['summary', 'actionItems', 'requirementDoc', 'emailDraft'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  tab === t ? 'border-accent text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                {t === 'actionItems' ? 'Action Items' : t === 'requirementDoc' ? 'Requirements' : t === 'emailDraft' ? 'Email Draft' : 'Summary'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 rounded-xl bg-bg-secondary border border-border">
            {tab === 'summary' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Executive Summary</h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{packageData.summary || 'No summary generated'}</p>
              </div>
            )}
            {tab === 'actionItems' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Action Items</h3>
                {packageData.actionItems?.length > 0 ? (
                  <ul className="space-y-2">
                    {packageData.actionItems.map((item: any, i: number) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <input type="checkbox" className="mt-0.5 accent-accent" />
                        <span className="text-text-primary">{item.text}</span>
                        <span className="text-xs text-text-muted ml-auto">({item.owner})</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-text-muted">No action items</p>}
              </div>
            )}
            {tab === 'requirementDoc' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Requirements Document</h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{packageData.requirementDoc || 'No requirements doc'}</p>
              </div>
            )}
            {tab === 'emailDraft' && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Follow-up Email</h3>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{packageData.emailDraft || 'No email draft'}</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={generatePackage}
              disabled={generating}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
