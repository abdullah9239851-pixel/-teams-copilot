'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DashboardPage() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    if (!meetingUrl.trim()) return;
    setJoining(true);

    // Create a meeting in DB and redirect to live page
    const meetingId = `meeting_${Date.now()}`;
    const encodedUrl = encodeURIComponent(meetingUrl);

    // Call backend to start bot
    try {
      await fetch('http://localhost:4000/api/meetings/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl, meetingId }),
      });
    } catch (err) {
      console.error('Bot join failed:', err);
    }

    router.push(`/live/${meetingId}?title=${encodeURIComponent('Client Meeting')}&url=${encodedUrl}`);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Your meetings and activity overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted">Meetings This Week</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">0</p>
        </div>
        <div className="p-4 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted">Action Items</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">0</p>
        </div>
        <div className="p-4 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted">Recent Summaries</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">0</p>
        </div>
      </div>

      {/* Quick Join */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Start a Copilot Session</h2>
        <div className="p-6 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted mb-4">
            Paste a Teams meeting link to start a copilot session
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="flex-1 px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm"
            />
            <button
              onClick={handleJoin}
              disabled={joining || !meetingUrl.trim()}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join with Copilot'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
