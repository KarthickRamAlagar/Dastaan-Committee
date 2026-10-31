'use client';
import { FilePlus2, Mail, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ROLE_LABEL } from '@dastaan/shared';
import { useMe } from '../lib/auth';
import { useShell } from '../components/shell/shell';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { PageHeader } from '../components/ui/misc';
import { TicketsGrid } from '../components/tickets/grid';
import { CommitteeStatGrid, StatCards, useStats } from '../components/tickets/stats';
import { Building2 } from 'lucide-react';
import { Redirect } from '../components/redirect';

const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export function HomeView() {
  const me = useMe();
  const { openMail } = useShell();
  const params = useSearchParams();
  const stats = useStats(undefined, me.role !== 'admin');
  if (me.role === 'admin') return <Redirect to="/admin" />;
  const convenor = me.role === 'convenor';
  const first = me.name.split(' ')[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet()}, ${first}`}
        subtitle={convenor ? 'Every committee’s requests, in one place.' : <span className="inline-flex flex-wrap items-center gap-2">{ROLE_LABEL[me.role]} <Chip tone="primary" icon={Building2}>{me.committeeName}</Chip></span>}
        actions={
          <>
            {me.role === 'lead' && <Link href="/members/new" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/70 px-4 text-sm font-semibold hover:bg-muted"><UserPlus className="size-4" />Add committee members</Link>}
            {me.role === 'lead' && <Link href="/requests/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"><FilePlus2 className="size-4" />New request</Link>}
            {(convenor || me.role === 'lead') && <Button variant="secondary" onClick={openMail}><Mail /> Send email</Button>}
          </>
        }
      />
      <StatCards stats={stats.data?.committee} loading={stats.isPending} />
      {convenor && stats.data?.byCommittee && (
        <section aria-label="Committees">
          <h2 className="mb-3 font-display text-lg font-semibold">Committees</h2>
          <CommitteeStatGrid rows={stats.data.byCommittee} />
        </section>
      )}
      <div id="requests">
        <TicketsGrid
          title={convenor ? 'All requests' : `${me.committeeName} requests`}
          scope="all"
          committeeId={convenor ? (params.get('committeeId') ?? undefined) : undefined}
          emptyText={convenor ? 'Requests from every committee will show up here.' : 'Requests sent to or from your committee will show up here.'}
        />
      </div>
    </div>
  );
}
