'use client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Loader, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';
import type { StatBlock } from '@dastaan/shared';
import { get, qs } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/misc';
import { CommitteeIcon } from '../committee-icon';

export interface StatsResp {
  committee: StatBlock;
  byCommittee: { committeeId: string; name: string; color: string | null; icon: string | null; stats: StatBlock }[] | null;
  mine: { received: number; receivedOpen: number; sent: number } | null;
}
export const useStats = (committeeId?: string, enabled = true) => useQuery({ queryKey: ['stats', committeeId ?? ''], queryFn: () => get<StatsResp>(`/tickets/stats${qs({ committeeId })}`), refetchInterval: 60_000, enabled });

const CARDS = [
  { key: 'pending', label: 'Pending', Icon: Clock3, tone: 'text-primary bg-primary/12 border-primary/30' },
  { key: 'in_progress', label: 'In progress', Icon: Loader, tone: 'text-info bg-info/12 border-info/30' },
  { key: 'done', label: 'Done', Icon: CheckCircle2, tone: 'text-success bg-success/12 border-success/30' },
  { key: 'high', label: 'High priority', Icon: ArrowUp, tone: 'text-danger bg-danger/12 border-danger/30' },
  { key: 'low', label: 'Low priority', Icon: ArrowDown, tone: 'text-muted-foreground bg-muted border-border' },
] as const;

export function StatCards({ stats, only, loading }: { stats?: StatBlock; only?: 'status' | 'all'; loading?: boolean }) {
  const list = only === 'status' ? CARDS.slice(0, 3) : CARDS;
  return (
    <div className={cn('grid gap-3', only === 'status' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5')}>
      {list.map(({ key, label, Icon, tone }) => (
        <div key={key} className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
            <span className={cn('flex size-8 items-center justify-center rounded-lg border', tone)}><Icon className="size-4" aria-hidden /></span>
          </div>
          {loading || !stats ? <Skeleton className="mt-3 h-9 w-14" /> : <p className="mt-2 font-display text-4xl font-semibold tabular">{stats[key]}</p>}
        </div>
      ))}
    </div>
  );
}

export function CommitteeStatGrid({ rows }: { rows: NonNullable<StatsResp['byCommittee']> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <li key={r.committeeId} className="panel p-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span aria-hidden className="flex size-9 items-center justify-center rounded-full text-white" style={{ background: r.color ?? '#f59e0b' }}><CommitteeIcon icon={r.icon} name={r.name} className="size-[18px]" /></span>
            <Link href={`/home?committeeId=${r.committeeId}`} className="min-w-0 flex-1 truncate font-display text-base font-semibold hover:text-primary">{r.name}</Link>
            <span className="text-xs text-muted-foreground tabular">{r.stats.total} total</span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {([['Pending', r.stats.pending, 'text-primary'], ['In progress', r.stats.in_progress, 'text-info'], ['Done', r.stats.done, 'text-success']] as const).map(([k, v, c]) => (
              <div key={k} className="rounded-xl bg-muted/50 px-2 py-2">
                <dd className={cn('font-display text-2xl font-semibold tabular', c)}>{v}</dd>
                <dt className="text-[11px] font-semibold text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
          {r.stats.high > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-danger"><ArrowUp className="size-3.5" aria-hidden />{r.stats.high} high priority</p>}
        </li>
      ))}
    </ul>
  );
}
