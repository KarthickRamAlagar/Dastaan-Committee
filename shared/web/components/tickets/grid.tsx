'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCheck, CircleCheckBig, CornerDownRight, FileText, MessageSquarePlus, Play, RotateCcw, Search, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CommitteeDto, Page, TicketRow } from '@dastaan/shared';
import { get, post, qs } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { bytes, fDate, fTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { PriorityChip, RedoChip, StatusChip } from '../ui/chip';
import { Field, Input, Select } from '../ui/form';
import { Modal } from '../ui/dialog';
import { SubCommitteeSelect } from '../sub-committee';
import { Empty, ErrorNote, Skeleton } from '../ui/misc';
import { Pagination } from '../ui/pagination';
import { ForwardDialog, NotDoneDialog, ReasonDialog } from './dialogs';
import { errMsg, useRefreshTickets, useTicketActions } from './hooks';

interface Props {
  scope?: 'all' | 'inbox' | 'sent';
  sort?: 'queue' | 'newest' | 'priority';
  title: string;
  committeeId?: string;
  forwarded?: boolean;
  pageSize?: number;
  filters?: boolean;
  emptyText?: string;
}

function useDebounced<T>(v: T, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

/** The request grid. Seven rows a page. What each person sees and can do is decided by the server; buttons only mirror it. */
export function TicketsGrid({ scope = 'all', sort, title, committeeId: fixedCommittee, forwarded, filters = true, emptyText }: Props) {
  const me = useMe();
  const convenor = me.role === 'convenor';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [committee, setCommittee] = useState(fixedCommittee ?? '');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  useEffect(() => setCommittee(fixedCommittee ?? ''), [fixedCommittee]);
  useEffect(() => setPage(1), [status, priority, committee, dq, scope]);

  const params = { scope, status, priority, committeeId: convenor ? committee : '', q: dq, sort: sort ?? (convenor ? 'newest' : 'queue'), page, forwarded };
  const list = useQuery({ queryKey: ['tickets', params], queryFn: () => get<Page<TicketRow>>(`/tickets${qs(params)}`), placeholderData: (p) => p });
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees'), enabled: convenor && filters });

  const actions = useTicketActions();
  const refreshAll = useRefreshTickets();
  const workDone = useMutation({
    mutationFn: (id: string) => post(`/tickets/${id}/work-done`),
    onSuccess: () => { toast.success('Your Committee Lead has been told'); void refreshAll(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const [forward, setForward] = useState<TicketRow | null>(null);
  const [comment, setComment] = useState<TicketRow | null>(null);
  const [redo, setRedo] = useState<TicketRow | null>(null);
  const [notDone, setNotDone] = useState(false);

  const rows = list.data?.items ?? [];
  const act = (t: TicketRow) => {
    const lead = me.role === 'lead' && me.committeeId === t.toCommitteeId;
    if (lead) {
      if (t.status === 'pending') return <Button size="sm" onClick={() => actions.status.mutate({ id: t.id, to: 'in_progress' })} loading={actions.status.isPending && actions.status.variables?.id === t.id}><Play /> Start</Button>;
      if (t.status === 'in_progress') return <Button size="sm" onClick={() => actions.status.mutate({ id: t.id, to: 'done' })} loading={actions.status.isPending && actions.status.variables?.id === t.id}><CheckCheck /> Mark done</Button>;
      return <Button size="sm" variant="outline" onClick={() => setForward(t)}><Send /> Forward</Button>;
    }
    if (me.role === 'member' && t.assigneeId === me.id && t.status !== 'done') {
      if (t.memberDoneAt) return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><CircleCheckBig className="size-4" /> Your Lead was told</span>;
      return <Button size="sm" onClick={() => workDone.mutate(t.id)} loading={workDone.isPending && workDone.variables === t.id}><CircleCheckBig /> Work done</Button>;
    }
    if (convenor) {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => (t.status === 'done' ? setComment(t) : setNotDone(true))}><MessageSquarePlus /> Comment</Button>
          {t.status === 'done' && <Button size="sm" variant="ghost" onClick={() => setRedo(t)}><RotateCcw /> Redo</Button>}
        </div>
      );
    }
    return null;
  };

  const Assign = ({ t }: { t: TicketRow }) => (me.role === 'lead' && me.committeeId === t.toCommitteeId && t.status !== 'done' ? <AssignSelect ticket={t} /> : t.assigneeName ? <p className="mt-1 text-xs text-muted-foreground">Assigned to <span className="font-semibold text-foreground">{t.assigneeName}</span>{t.subCommittee ? ` · ${t.subCommittee}` : ''}{t.memberDoneAt && t.status !== 'done' ? <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">· says work is done</span> : null}</p> : null);

  return (
    <section className="panel overflow-hidden" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <h2 className="font-display text-lg font-semibold">{title}{list.data ? <span className="ml-2 text-sm font-sans font-medium text-muted-foreground tabular">{list.data.total}</span> : null}</h2>
        {filters && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests" aria-label="Search requests" className="h-9 w-44 pl-9 sm:w-56" />
            </div>
            {convenor && (
              <Select aria-label="Committee" value={committee} onChange={(e) => setCommittee(e.target.value)} className="h-9 w-40">
                <option value="">All committees</option>
                {committees.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-36">
              <option value="">Any status</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="done">Done</option>
            </Select>
            <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-36">
              <option value="">Any priority</option><option value="high">High</option><option value="low">Low</option>
            </Select>
          </div>
        )}
      </div>

      {list.isError ? (
        <div className="p-4"><ErrorNote message={errMsg(list.error)} retry={() => void list.refetch()} /></div>
      ) : list.isPending ? (
        <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows.length === 0 ? (
        <Empty title="No requests here yet">{emptyText ?? 'When a request is raised it will appear in this list.'}</Empty>
      ) : (
        <>
          {/* Table on wide screens */}
          <div className={cn('hidden md:block', list.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Request</th>
                    {convenor && <th scope="col" className="px-3 py-2.5 font-semibold">File</th>}
                    <th scope="col" className="px-3 py-2.5 font-semibold">{convenor ? 'From' : 'By whom'}</th>
                    {convenor && <th scope="col" className="px-3 py-2.5 font-semibold">To</th>}
                    <th scope="col" className="px-3 py-2.5 font-semibold">Time stamp</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Priority</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">Convenor’s comment</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((t) => (
                    <tr key={t.id} className="align-top hover:bg-muted/30">
                      <td className="max-w-[26rem] px-4 py-3">
                        <Link href={`/tickets/${t.id}`} className="font-semibold leading-snug hover:text-primary">{t.title}</Link>
                        <p className="mt-0.5 text-xs text-muted-foreground tabular">{t.code}{t.hops > 2 && ` · ${t.hops - 1} committees`}</p>
                        <TicketContext t={t} />
                        <Assign t={t} />
                      </td>
                      {convenor && <td className="px-3 py-3 text-xs text-muted-foreground">{t.fileCount ? <Link href={`/tickets/${t.id}`} className="inline-flex items-center gap-1.5 font-semibold text-primary"><FileText className="size-3.5" />{t.fileCount} file{t.fileCount === 1 ? '' : 's'}</Link> : '—'}</td>}
                      <td className="px-3 py-3"><p className="font-medium">{t.requesterName}</p><p className="text-xs text-muted-foreground">{t.fromCommittee}</p></td>
                      {convenor && <td className="px-3 py-3 font-medium">{t.toCommittee}</td>}
                      <td className="whitespace-nowrap px-3 py-3 tabular"><p>{fDate(t.createdAt)}</p><p className="text-xs text-muted-foreground">{fTime(t.createdAt)}</p></td>
                      <td className="px-3 py-3"><div className="flex flex-col items-start gap-1.5"><PriorityChip priority={t.priority} />{t.redoPending && <RedoChip />}</div></td>
                      <td className="px-3 py-3"><StatusChip status={t.status} />{!convenor && t.toCommitteeId !== me.committeeId && <p className="mt-1 text-xs text-muted-foreground">With {t.toCommittee}</p>}</td>
                      <td className="max-w-[14rem] px-3 py-3 text-[13px] text-muted-foreground">{t.comment ? <span className="line-clamp-3">{t.comment}</span> : '—'}</td>
                      <td className="px-4 py-3 text-right">{act(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards on phones */}
          <ul className={cn('divide-y divide-border/60 md:hidden', list.isPlaceholderData && 'opacity-60')}>
            {rows.map((t) => (
              <li key={t.id} className="space-y-2.5 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/tickets/${t.id}`} className="font-semibold leading-snug">{t.title}</Link>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-1.5"><PriorityChip priority={t.priority} /><StatusChip status={t.status} />{t.redoPending && <RedoChip />}</div>
                <p className="text-xs text-muted-foreground">{t.requesterName}, {t.fromCommittee}{convenor ? ` → ${t.toCommittee}` : ''} · {fDate(t.createdAt)} {fTime(t.createdAt)}</p>
                <TicketContext t={t} />
                <Assign t={t} />
                {t.comment && <p className="rounded-lg bg-muted/60 px-3 py-2 text-[13px]"><span className="font-semibold">Convenor: </span>{t.comment}</p>}
                <div>{act(t)}</div>
              </li>
            ))}
          </ul>
          <Pagination page={list.data!.page} pageSize={list.data!.pageSize} total={list.data!.total} onPage={setPage} />
        </>
      )}

      {forward && <ForwardDialog ticketId={forward.id} currentCommitteeId={forward.toCommitteeId} open onOpenChange={(o) => !o && setForward(null)} />}
      {comment && <ReasonDialog open onOpenChange={(o) => !o && setComment(null)} title="Comment on this request" description={comment.title} label="Your comment" confirm="Post comment" url={`/tickets/${comment.id}/comments`} field="body" min={2} success="Comment posted" />}
      {redo && <ReasonDialog open onOpenChange={(o) => !o && setRedo(null)} title="Ask for a redo" description="It goes back to the top of the queue with High priority." label="What needs to change?" confirm="Send back" url={`/tickets/${redo.id}/redo`} field="reason" success="Sent back for a redo" />}
      <NotDoneDialog open={notDone} onOpenChange={setNotDone} />
    </section>
  );
}

/** The requirement, who forwarded it here and what they said, and every file so far. Same in the table and on phones. */
function TicketContext({ t }: { t: TicketRow }) {
  const shown = t.fileList.slice(0, 3);
  return (
    <div className="mt-1.5 space-y-1.5">
      {t.details && <p className="line-clamp-2 text-[13px] leading-snug text-foreground/80">{t.details}</p>}
      {t.handoff && (
        <p className="flex items-start gap-1.5 rounded-lg bg-primary/10 px-2 py-1 text-xs text-foreground/90">
          <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">Forwarded from <span className="font-semibold">{t.handoff.fromCommittee}</span>{t.handoff.byName ? ` by ${t.handoff.byName}` : ''}{t.handoff.note ? <>: <span className="italic">“{t.handoff.note}”</span></> : ''}</span>
        </p>
      )}
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((f) => (
            <a key={f.id} href={`/api/files/${f.id}`} title={`${f.name} (${bytes(f.size)})${f.fromCommittee ? `, from ${f.fromCommittee}` : ''}`} className="inline-flex max-w-[11rem] items-center gap-1 rounded-md border border-border bg-card/70 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10">
              <FileText className="size-3 shrink-0" aria-hidden /><span className="truncate">{f.name}</span>
            </a>
          ))}
          {t.fileList.length > shown.length && <Link href={`/tickets/${t.id}`} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">+{t.fileList.length - shown.length} more</Link>}
        </div>
      )}
    </div>
  );
}

export function AssignSelect({ ticket }: { ticket: TicketRow }) {
  const refresh = useRefreshTickets();
  const people = useQuery({ queryKey: ['directory'], queryFn: () => get<{ id: string; name: string; role: string; subCommittee: string | null }[]>('/users/directory'), staleTime: 60_000 });
  const [pick, setPick] = useState('');
  const [sub, setSub] = useState('');
  const person = people.data?.find((p) => p.id === pick);
  const m = useMutation({
    mutationFn: () => post(`/tickets/${ticket.id}/assign`, { assigneeId: pick, subCommittee: sub.trim() }),
    onSuccess: () => { toast.success('Assigned. They have the full request and files.'); void refresh(); setPick(''); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <>
      <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">Assigned to</span>
        <Select aria-label={`Assign ${ticket.code}`} value={ticket.assigneeId ?? ''} onChange={(e) => { const id = e.target.value; if (!id) return; setPick(id); setSub(people.data?.find((p) => p.id === id)?.subCommittee ?? ticket.subCommittee ?? ''); }} className="h-8 min-w-[9rem] py-0 text-xs">
          <option value="">Choose a person</option>
          {people.data?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role === 'lead' ? ' (Lead)' : ''}</option>)}
        </Select>
      </label>
      {ticket.subCommittee && ticket.assigneeName && <p className="mt-1 text-xs text-muted-foreground">Sub-committee: <span className="font-semibold text-foreground">{ticket.subCommittee}</span>{ticket.memberDoneAt ? <span className="ml-1.5 font-semibold text-emerald-600 dark:text-emerald-400">· says work is done</span> : null}</p>}
      {pick && (
        <Modal open onOpenChange={(o) => !o && setPick('')} title={`Assign to ${person?.name ?? 'this person'}`} description="They get the full request, the forward note and every file."
          footer={<><Button variant="ghost" onClick={() => setPick('')}>Cancel</Button><Button loading={m.isPending} disabled={sub.trim().length < 2} onClick={() => m.mutate()}>Assign</Button></>}>
          <Field label="Sub-committee" hint="Which sub-committee is this work for?">
            {(p) => <SubCommitteeSelect {...p} value={sub} onChange={(e) => setSub(e.target.value)} />}
          </Field>
        </Modal>
      )}
    </>
  );
}
