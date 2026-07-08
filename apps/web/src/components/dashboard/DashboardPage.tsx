'use client';

export function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Your meetings and activity overview</p>
      </div>

      {/* Stats */}
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

      {/* Upcoming Meetings */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-text-primary mb-4">Upcoming Meetings</h2>
        <div className="p-8 rounded-xl bg-bg-secondary border border-border text-center">
          <p className="text-text-muted">No upcoming meetings</p>
          <p className="text-sm text-text-muted mt-1">Connect your calendar or add a meeting manually</p>
        </div>
      </div>

      {/* Quick Start */}
      <div>
        <h2 className="text-lg font-medium text-text-primary mb-4">Quick Start</h2>
        <div className="p-6 rounded-xl bg-bg-secondary border border-border">
          <p className="text-sm text-text-muted mb-4">
            Paste a Teams meeting link to start a copilot session
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="flex-1 px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent text-sm"
            />
            <button className="px-5 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-sm">
              Join with Copilot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
