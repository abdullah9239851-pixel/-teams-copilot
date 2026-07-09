'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export function AuthPage() {
  const publicSignupEnabled = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === 'true';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      if (!publicSignupEnabled) {
        setError('Account creation is invite-only. Ask an admin to create your account.');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const signupResult = await signupResponse.json();

      if (!signupResponse.ok) {
        setError(signupResult.error || 'Could not create account');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMessage('Account created. Please sign in.');
          setMode('login');
        } else {
          setMessage('Account created successfully.');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }

    setLoading(false);
  };

  const switchMode = () => {
    if (!publicSignupEnabled) return;
    setMode((current) => (current === 'login' ? 'signup' : 'login'));
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary">
      <div className="w-full max-w-sm p-8 rounded-xl bg-bg-secondary border border-border">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-text-primary">Teams Copilot</h1>
          <p className="text-sm text-text-muted mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              required
            />
          </div>
          {mode === 'signup' && (
            <div>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
          {message && (
            <p className="text-sm text-success">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        {publicSignupEnabled ? (
          <button
            type="button"
            onClick={switchMode}
            className="mt-5 w-full text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
        ) : (
          <p className="mt-5 text-center text-xs text-text-muted">Invite-only access</p>
        )}
      </div>
    </div>
  );
}
