'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { AuthPage } from '@/components/auth/AuthPage';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardPage } from '@/components/dashboard/DashboardPage';

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="animate-pulse text-text-muted">Loading...</div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
