import { Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const dynamic = 'force-dynamic';

export default function SettingsRoute() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-text-muted">Loading…</div>}>
        <SettingsPage />
      </Suspense>
    </AppShell>
  );
}
