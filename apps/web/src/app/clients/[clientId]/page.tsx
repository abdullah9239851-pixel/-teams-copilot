import { AppShell } from '@/components/layout/AppShell';
import { ClientDetail } from '@/components/clients/ClientDetail';

export const dynamic = 'force-dynamic';

export default async function ClientDetailRoute({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <AppShell>
      <ClientDetail clientId={clientId} />
    </AppShell>
  );
}
