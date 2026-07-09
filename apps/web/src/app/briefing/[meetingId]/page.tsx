import { AppShell } from '@/components/layout/AppShell';
import { BriefingPage } from '@/components/briefing/BriefingPage';

export const dynamic = 'force-dynamic';

export default async function BriefingRoute({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return (
    <AppShell>
      <BriefingPage meetingId={meetingId} />
    </AppShell>
  );
}
