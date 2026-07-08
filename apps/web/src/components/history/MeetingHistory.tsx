'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function MeetingHistory() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('http://localhost:4000/api/meetings')
      .then(r => r.json())
      .then(setMeetings)
      .catch(() => {});
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Meeting History</h1>
        <p className="text-sm text-text-muted mt-1">All past copilot sessions</p>
      </div>

      {meetings.length === 0 ? (
        <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted">No meetings yet</p>
          <p className="text-sm text-text-muted mt-1">Start a copilot session from the dashboard</p>
        </div>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div
              key={m.id}
              onClick={() => router.push(`/live/${m.id}`)}
              className="p-4 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <p className="text-sm text-text-primary font-medium">{m.id}</p>
                <span className="text-xs text-text-muted">{m.segments} transcript segments</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Post-Meeting Package</h2>
        <p className="text-sm text-text-muted mb-4">
          Generate a summary, action items, requirement doc, and email draft for any completed meeting.
        </p>
        <div className="p-6 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted">
            Select a meeting from the list above, then click "Generate Package" to create your post-meeting deliverables.
          </p>
        </div>
      </div>
    </div>
  );
}
