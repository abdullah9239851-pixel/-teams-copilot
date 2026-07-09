import { AppShell } from '@/components/layout/AppShell';
import { KnowledgeBase } from '@/components/kb/KnowledgeBase';

export const dynamic = 'force-dynamic';

export default function KnowledgeBasePage() {
  return (
    <AppShell>
      <KnowledgeBase />
    </AppShell>
  );
}
