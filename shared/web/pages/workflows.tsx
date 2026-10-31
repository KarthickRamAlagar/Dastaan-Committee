'use client';
import { RoleGuard } from '../components/role-guard';
import { PageHeader } from '../components/ui/misc';
import { TicketsGrid } from '../components/tickets/grid';

export default function Page() {
  return (
    <RoleGuard roles={['convenor']}>
      <PageHeader title="Workflows" subtitle="Every request and the committees it has passed through. Open one to see its full journey." />
      <TicketsGrid title="All requests" scope="all" sort="newest" emptyText="Requests will appear here as soon as a committee raises one." />
    </RoleGuard>
  );
}
