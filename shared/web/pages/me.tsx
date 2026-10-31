'use client';
import { Building2, Inbox, Send, UserRound } from 'lucide-react';
import { ROLE_LABEL } from '@dastaan/shared';
import { useMe } from '../lib/auth';
import { RoleGuard } from '../components/role-guard';
import { PageHeader, Skeleton } from '../components/ui/misc';
import { TicketsGrid } from '../components/tickets/grid';
import { useStats } from '../components/tickets/stats';

export default function Page() {
  return <RoleGuard roles={['lead', 'member']}><MePage /></RoleGuard>;
}

function MePage() {
  const me = useMe();
  const stats = useStats();
  const mine = stats.data?.mine;
  const member = me.role === 'member';
  const cards = [
    { label: 'Name', value: me.name, sub: ROLE_LABEL[me.role], Icon: UserRound },
    { label: 'Committee', value: me.committeeName ?? '', sub: me.email, Icon: Building2 },
    { label: member ? 'Work assigned to you' : 'Requests received', value: mine ? String(mine.received) : null, sub: mine ? `${mine.receivedOpen} still open` : '', Icon: Inbox },
    ...(member ? [] : [{ label: 'Requests sent', value: mine ? String(mine.sent) : null, sub: 'by you', Icon: Send }]),
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={member ? 'My work' : 'My page'} subtitle={member ? 'Work your Committee Lead assigned to you. Press Work done when you finish.' : 'Requests sent to you and requests you have sent.'} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, sub, Icon }) => (
          <div key={label} className="panel p-4">
            <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-muted-foreground">{label}</span><Icon className="size-4 text-primary" aria-hidden /></div>
            {value === null ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 truncate font-display text-2xl font-semibold">{value}</p>}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
      <TicketsGrid title={member ? 'Assigned to you' : 'Received by you'} scope="inbox" sort="priority" filters={false} emptyText={member ? 'Nothing is assigned to you yet. Your Committee Lead assigns work to you.' : 'Nothing has been sent to you yet. High priority requests will appear first.'} />
      {!member && <TicketsGrid title="Sent by you" scope="sent" sort="newest" filters={false} emptyText="You have not sent a request yet." />}
    </div>
  );
}
