import { AppShell } from '@/components/layout/AppShell';
import { ClientsPage } from '@/components/clients/ClientsPage';

export const dynamic = 'force-dynamic';

export default function ClientsRoute() {
  return (
    <AppShell>
      <ClientsPage />
    </AppShell>
  );
}
