import { CopilotScreen } from '@/components/live/CopilotScreen';

export default async function LivePage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <CopilotScreen meetingId={meetingId} meetingTitle="Client Meeting" />;
}
