'use client';
import * as P from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { NotificationDto, Page } from '@dastaan/shared';
import { get, post, qs } from '../../lib/api';
import { ago } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';
import { Empty, Skeleton } from '../ui/misc';

type Resp = Page<NotificationDto> & { unread: number };

export function NotificationBell() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const count = useQuery({ queryKey: ['notif-count'], queryFn: () => get<{ unread: number }>('/notifications/unread-count'), refetchInterval: 45_000, refetchIntervalInBackground: false });
  const list = useQuery({ queryKey: ['notifications', page], queryFn: () => get<Resp>(`/notifications${qs({ page })}`), enabled: open, placeholderData: (p) => p });
  const readAll = useMutation({
    mutationFn: () => post('/notifications/read-all'),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); qc.setQueryData(['notif-count'], { unread: 0 }); },
  });
  const unread = count.data?.unread ?? 0;
  return (
    <P.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setPage(1); }}>
      <P.Trigger asChild>
        <button className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-card/70 text-muted-foreground hover:text-foreground" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-ember px-1 text-[11px] font-bold leading-5 text-white">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={10} collisionPadding={12} className="z-50 w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-semibold">Notifications</h2>
            <Button variant="ghost" size="sm" onClick={() => readAll.mutate()} disabled={!unread}><CheckCheck /> Mark all read</Button>
          </div>
          <div className="scroll-thin max-h-[26rem] overflow-y-auto">
            {list.isPending ? (
              <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : !list.data?.items.length ? (
              <Empty icon={BellOff} title="Nothing new">Updates from the Convenor and your committee show up here.</Empty>
            ) : (
              <ul>
                {list.data.items.map((n) => {
                  const body = (
                    <>
                      <div className="flex items-start gap-2">
                        {!n.read && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-ember" />}
                        <div className="min-w-0">
                          <p className={cn('text-sm', n.read ? 'font-medium' : 'font-semibold')}>{n.title}</p>
                          <p className={cn('mt-0.5 whitespace-pre-line text-[13px] text-muted-foreground', expanded !== n.id && 'line-clamp-2')}>{n.body}</p>
                          <p className="mt-1 text-xs text-muted-foreground/80">{n.byName ? `By ${n.byName} · ` : ''}{ago(n.createdAt)}</p>
                        </div>
                      </div>
                    </>
                  );
                  return (
                    <li key={n.id} className="border-b border-border/60 last:border-0">
                      {n.link ? <Link href={n.link} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted/50">{body}</Link> : <button type="button" onClick={() => setExpanded((c) => (c === n.id ? null : n.id))} aria-expanded={expanded === n.id} className="block w-full px-4 py-3 text-left hover:bg-muted/50">{body}</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {list.data && <Pagination page={page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
