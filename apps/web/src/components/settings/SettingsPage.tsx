'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { apiJson } from '@/lib/api';

interface Me {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  microsoftConnected: boolean;
  googleConnected: boolean;
}
interface Member { id: string; email: string; name: string; role: string }

export function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const params = useSearchParams();
  const msStatus = params.get('microsoft');
  const googleStatus = params.get('google');

  const load = () =>
    apiJson<Me>('/api/me')
      .then((data) => {
        setMe(data);
        if (data.role === 'admin') {
          apiJson<{ members: Member[] }>('/api/team').then((d) => setMembers(d.members)).catch(() => {});
        }
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const connectProvider = async (provider: 'microsoft' | 'google') => {
    const { data: { session } } = await createClient().auth.getSession();
    if (session?.user?.id) {
      window.location.href = `/api/${provider}/connect?userId=${encodeURIComponent(session.user.id)}`;
    }
  };

  const disconnectProvider = async (provider: 'microsoft' | 'google') => {
    await apiJson(`/api/${provider}/disconnect`, { method: 'POST' }).catch((e) => setError(e.message));
    load();
  };

  const invite = async () => {
    if (!inviteEmail || !invitePassword) return;
    try {
      await apiJson('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, password: invitePassword, role: 'member' }),
      });
      setInviteEmail('');
      setInvitePassword('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const setRole = async (userId: string, role: string) => {
    await apiJson('/api/team', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    }).catch((e) => setError(e.message));
    load();
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Settings</h1>
      <p className="text-sm text-text-muted mb-8">Manage your account, connection, and team</p>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      {msStatus === 'connected' && <p className="mb-4 text-sm text-success">Microsoft account connected.</p>}
      {msStatus === 'error' && <p className="mb-4 text-sm text-danger">Microsoft connection failed. Try again.</p>}
      {googleStatus === 'connected' && <p className="mb-4 text-sm text-success">Google account connected.</p>}
      {googleStatus === 'error' && <p className="mb-4 text-sm text-danger">Google connection failed. Try again.</p>}

      {/* Profile */}
      <section className="mb-6 p-6 rounded-xl bg-bg-secondary border border-border">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Profile</h2>
        <div className="text-sm text-text-secondary space-y-1">
          <p>Email: <span className="text-text-primary">{me?.email || '—'}</span></p>
          <p>Role: <span className="text-text-primary capitalize">{me?.role || '—'}</span></p>
        </div>
      </section>

      {/* Google connection — works with a normal Gmail account */}
      <section className="mb-6 p-6 rounded-xl bg-bg-secondary border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Google Calendar</h2>
            <p className="text-xs text-text-muted mt-1">
              {me?.googleConnected
                ? 'Connected — meetings sync from your Google Calendar (Teams join links auto-detected).'
                : 'Not connected. Works with a normal Gmail account.'}
            </p>
          </div>
          {me?.googleConnected ? (
            <button onClick={() => disconnectProvider('google')} className="px-4 py-2 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm hover:border-danger/40">
              Disconnect
            </button>
          ) : (
            <button onClick={() => connectProvider('google')} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover">
              Connect Google
            </button>
          )}
        </div>
      </section>

      {/* Microsoft connection */}
      <section className="mb-6 p-6 rounded-xl bg-bg-secondary border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Microsoft Calendar</h2>
            <p className="text-xs text-text-muted mt-1">
              {me?.microsoftConnected ? 'Connected — meetings sync from your Teams calendar.' : 'Not connected. Requires a Microsoft 365 organization account.'}
            </p>
          </div>
          {me?.microsoftConnected ? (
            <button onClick={() => disconnectProvider('microsoft')} className="px-4 py-2 rounded-lg bg-bg-elevated border border-border text-text-primary text-sm hover:border-danger/40">
              Disconnect
            </button>
          ) : (
            <button onClick={() => connectProvider('microsoft')} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover">
              Connect Microsoft
            </button>
          )}
        </div>
      </section>

      {/* Admin: team management */}
      {me?.role === 'admin' && (
        <section className="p-6 rounded-xl bg-bg-secondary border border-border">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Team (admin)</h2>

          <div className="flex gap-2 mb-4">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@company.com"
              className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
            />
            <input
              type="password"
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              placeholder="Temp password"
              className="w-40 px-3 py-2 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent"
            />
            <button onClick={invite} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover">
              Invite
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border">
                <span className="text-sm text-text-primary">{m.email}</span>
                <select
                  value={m.role}
                  onChange={(e) => setRole(m.id, e.target.value)}
                  className="px-2 py-1 rounded bg-bg-primary border border-border text-xs text-text-secondary focus:outline-none"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
