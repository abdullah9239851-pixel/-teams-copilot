import { AppShell } from '@/components/layout/AppShell';
import { PostMeetingPage } from '@/components/history/PostMeetingPage';

export const dynamic = 'force-dynamic';

export default async function PostMeetingRoute({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return (
    <AppShell>
      <PostMeetingPage meetingId={meetingId} />
    </AppShell>
  );
}
