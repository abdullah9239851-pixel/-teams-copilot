import { PostMeetingPage } from '@/components/history/PostMeetingPage';

export default async function PostMeetingRoute({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <PostMeetingPage meetingId={meetingId} />;
}
