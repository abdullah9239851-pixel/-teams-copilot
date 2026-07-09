import { AppShell } from '@/components/layout/AppShell';
import { MeetingHistory } from '@/components/history/MeetingHistory';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <AppShell>
      <MeetingHistory />
    </AppShell>
  );
}
