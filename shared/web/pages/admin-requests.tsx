'use client';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Headset, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Page, SupportDto } from '@dastaan/shared';
import { get, patch, qs } from '../lib/api';
import { ago } from '../lib/format';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Select } from '../components/ui/form';
import { Empty, ErrorNote, PageHeader } from '../components/ui/misc';
import { Pagination } from '../components/ui/pagination';
import { errMsg } from '../components/tickets/hooks';

export default function Page() {
  return <RoleGuard roles={['admin']}><Inbox_ /></RoleGuard>;
}

function Inbox_() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('open');
  const q = useQuery({ queryKey: ['support-admin', page, status], queryFn: () => get<Page<SupportDto> & { open: number }>(`/support${qs({ page, status })}`), placeholderData: keepPreviousData });
  const set = useMutation({
    mutationFn: (v: { id: string; status: 'open' | 'done' }) => patch(`/support/${v.id}`, { status: v.status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['support-admin'] }); void qc.invalidateQueries({ queryKey: ['support-open'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = q.data?.items ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Requests" subtitle="Convenors and Committee Leads ask here to have their details changed or their account removed. Make the change on the People page, then mark it done. Committee Members write to their own Lead instead."
        actions={<Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Show"><option value="open">Open</option><option value="done">Done</option><option value="">All</option></Select>} />
      {q.isError && <ErrorNote message={errMsg(q.error)} retry={() => void q.refetch()} />}
      <div className="panel overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{s.subject}</p><Chip tone={s.status === 'done' ? 'success' : 'primary'}>{s.status === 'done' ? 'Done' : 'Open'}</Chip></div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s.fromName} · {s.fromEmail}{s.committeeName ? ` · ${s.committeeName}` : ''} · {ago(s.createdAt)}</p>
              </div>
              {s.status === 'open'
                ? <Button size="sm" variant="secondary" loading={set.isPending && set.variables?.id === s.id} onClick={() => set.mutate({ id: s.id, status: 'done' })}><Check /> Mark done</Button>
                : <Button size="sm" variant="ghost" onClick={() => set.mutate({ id: s.id, status: 'open' })}><Undo2 /> Reopen</Button>}
            </li>
          ))}
        </ul>
        {!q.isPending && rows.length === 0 && <Empty icon={Headset} title="All clear">No requests match this view.</Empty>}
        <Pagination page={page} pageSize={q.data?.pageSize ?? 10} total={q.data?.total ?? 0} onPage={setPage} />
      </div>
    </div>
  );
}
