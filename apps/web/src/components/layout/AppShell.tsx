'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { DashboardLayout } from './DashboardLayout';

/**
 * Auth guard + chrome for every signed-in page. Redirects to the login screen
 * (home route) when there is no session, then renders the sidebar shell.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/');
      } else {
        setAuthed(true);
      }
      setReady(true);
    });
  }, [router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!authed) return null;

  return <DashboardLayout>{children}</DashboardLayout>;
}
