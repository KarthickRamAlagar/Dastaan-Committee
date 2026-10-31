'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import type { GrantDto } from '@dastaan/shared';
import { get, post } from '../lib/api';
import { fDateTime } from '../lib/format';
import { GRANT_ACTION_TEXT as ACTION_TEXT, GRANT_TONE as TONE } from '../lib/grants';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Empty, ErrorNote, PageHeader, Skeleton } from '../components/ui/misc';
import { errMsg } from '../components/tickets/hooks';

export default function Page() {
  return <RoleGuard roles={['convenor']}><Permissions /></RoleGuard>;
}


function Permissions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['grants'], queryFn: () => get<GrantDto[]>('/grants'), refetchInterval: 30_000 });
  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => post(`/grants/${v.id}/decision`, { approve: v.approve }),
    onSuccess: (_r, v) => { toast.success(v.approve ? 'Permission granted for 24 hours' : 'Request declined'); void qc.invalidateQueries({ queryKey: ['grants'] });  },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Admin permissions" subtitle="The Admin needs your approval to add, edit or delete a committee. Each approval works once and lasts 24 hours." />
      {q.isError && <ErrorNote message={errMsg(q.error)} retry={() => void q.refetch()} />}
      {q.isPending ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : q.data?.length === 0 ? (
        <div className="panel"><Empty icon={ShieldCheck} title="No requests">When the Admin asks to change a committee, it will show up here.</Empty></div>
      ) : (
        <ul className="space-y-3">
          {q.data?.map((g) => (
            <li key={g.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{g.requestedByName} wants to {ACTION_TEXT[g.action]}{g.committeeName ? `: ${g.committeeName}` : ''}</p>
                {g.note && <p className="mt-0.5 text-sm text-muted-foreground">“{g.note}”</p>}
                <p className="mt-1 text-xs text-muted-foreground">Asked {fDateTime(g.createdAt)}{g.decidedByName ? ` · decided by ${g.decidedByName}` : ''}</p>
              </div>
              {g.status === 'pending' ? (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" loading={decide.isPending && decide.variables?.id === g.id && !decide.variables.approve} disabled={decide.isPending} onClick={() => decide.mutate({ id: g.id, approve: false })}><X /> Decline</Button>
                  <Button size="sm" loading={decide.isPending && decide.variables?.id === g.id && decide.variables.approve} disabled={decide.isPending} onClick={() => decide.mutate({ id: g.id, approve: true })}><Check /> Approve</Button>
                </div>
              ) : <Chip tone={TONE[g.status]}>{g.status === 'approved' ? 'Approved, not used yet' : g.status[0]!.toUpperCase() + g.status.slice(1)}</Chip>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
