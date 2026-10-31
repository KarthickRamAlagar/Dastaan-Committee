'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, CircleCheckBig, Download, FileText, History, MessageSquarePlus, Play, RotateCcw, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { TicketDetail } from '@dastaan/shared';
import { get, post } from '../lib/api';
import { useMe } from '../lib/auth';
import { ago, bytes, fDateTime } from '../lib/format';
import { Button } from '../components/ui/button';
import { Chip, PriorityChip, RedoChip, StatusChip } from '../components/ui/chip';
import { ErrorNote, Skeleton } from '../components/ui/misc';
import { AssignSelect } from '../components/tickets/grid';
import { ForwardDialog, NotDoneDialog, ReasonDialog } from '../components/tickets/dialogs';
import { errMsg, useRefreshTickets, useTicketActions } from '../components/tickets/hooks';
import { Timeline } from '../components/tickets/timeline';
import { Building2 } from 'lucide-react';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => get<TicketDetail>(`/tickets/${id}`), refetchInterval: 30_000 });
  const actions = useTicketActions();
  const refresh = useRefreshTickets();
  const [forward, setForward] = useState(false);
  const [comment, setComment] = useState(false);
  const [redo, setRedo] = useState(false);
  const [notDone, setNotDone] = useState(false);
  const workDone = useMutation({
    mutationFn: () => post(`/tickets/${id}/work-done`),
    onSuccess: () => { toast.success('Your Committee Lead has been told'); void refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isPending) return <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;
  if (q.isError) return <div className="space-y-4"><BackLink /><ErrorNote message={errMsg(q.error)} retry={() => void q.refetch()} /></div>;
  const t = q.data;
  const leadHere = me.role === 'lead' && me.committeeId === t.toCommitteeId;
  const requestFiles = t.files.filter((f) => f.kind === 'request');

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground tabular">{t.code}</p>
        <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityChip priority={t.priority} />
          <StatusChip status={t.status} />
          {t.redoPending && <RedoChip />}
          <Chip tone="primary" icon={Building2}>With {t.toCommittee}</Chip>
        </div>
      </header>

      <section className="panel p-5 sm:p-6" aria-labelledby="tl">
        <h2 id="tl" className="mb-5 font-display text-lg font-semibold">Where this request has been</h2>
        <Timeline hops={t.timeline} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="panel space-y-4 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold">The request</h2>
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{t.details || <span className="text-muted-foreground">No extra detail was added.</span>}</p>
            <dl className="grid gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
              <Meta k="Raised by" v={`${t.requesterName}, ${t.fromCommittee}`} />
              <Meta k="Sent to" v={t.toCommittee} />
              <Meta k="Assigned to" v={t.assigneeName ?? 'Not assigned yet'} />
              {t.subCommittee && <Meta k="Sub-committee" v={t.subCommittee} />}
              {t.memberDoneAt && <Meta k="Member says" v={`Work is done (${fDateTime(t.memberDoneAt)})`} />}
              <Meta k="Needed by" v={fDateTime(t.neededBy)} />
              <Meta k="Raised" v={fDateTime(t.createdAt)} />
            </dl>
            {requestFiles.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 font-sans text-sm font-bold">Files</h3>
                <ul className="space-y-2">{requestFiles.map((f) => <FileRow key={f.id} f={f} />)}</ul>
              </div>
            )}
          </section>

          <section className="panel p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold"><MessageSquarePlus className="size-5 text-primary" aria-hidden />Convenor’s comments</h2>
            {t.comments.length === 0 ? <p className="text-sm text-muted-foreground">{t.status === 'done' ? 'The Convenor has not commented yet.' : 'The Convenor can comment once the work is Done.'}</p> : (
              <ul className="space-y-3">
                {t.comments.map((c) => (
                  <li key={c.id} className="rounded-xl border border-border bg-muted/40 p-3.5">
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{c.authorName}</span>{c.kind === 'redo' && <RedoChip />}<span>{ago(c.createdAt)}</span></p>
                    <p className="mt-1.5 whitespace-pre-line text-sm">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {(t.can.changeStatus || t.can.forward || t.can.redo || t.can.assign || t.can.workDone || me.role === 'convenor') && (
            <section className="panel space-y-3 p-5" aria-label="Actions">
              <h2 className="font-display text-lg font-semibold">What you can do</h2>
              {t.can.changeStatus && t.status === 'pending' && <Button className="w-full" onClick={() => actions.status.mutate({ id, to: 'in_progress' })} loading={actions.status.isPending}><Play /> Start work</Button>}
              {t.can.changeStatus && t.status === 'in_progress' && <Button className="w-full" onClick={() => actions.status.mutate({ id, to: 'done' })} loading={actions.status.isPending}><CheckCheck /> Mark done</Button>}
              {t.can.workDone && <Button className="w-full" onClick={() => workDone.mutate()} loading={workDone.isPending}><CircleCheckBig /> Work done. Tell my Lead</Button>}
              {t.can.forward && <Button className="w-full" variant="outline" onClick={() => setForward(true)}><Send /> Forward to the next committee</Button>}
              {t.can.assign && <AssignSelect ticket={t} />}
              {me.role === 'convenor' && <Button className="w-full" variant="secondary" onClick={() => (t.status === 'done' ? setComment(true) : setNotDone(true))}><MessageSquarePlus /> Comment</Button>}
              {t.can.redo && <Button className="w-full" variant="ghost" onClick={() => setRedo(true)}><RotateCcw /> Ask for a redo</Button>}
              {!leadHere && me.role !== 'convenor' && !t.can.workDone && <p className="text-xs text-muted-foreground">Only the Committee Lead of the committee holding this request can change it.</p>}
            </section>
          )}

          <section className="panel p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><History className="size-5 text-primary" aria-hidden />Activity</h2>
            <ol className="space-y-3 border-l border-border pl-4">
              {t.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span aria-hidden className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-primary" />
                  <p>{e.message}</p>
                  <p className="text-xs text-muted-foreground">{ago(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <ForwardDialog ticketId={id} currentCommitteeId={t.toCommitteeId} open={forward} onOpenChange={setForward} />
      <ReasonDialog open={comment} onOpenChange={setComment} title="Comment on this request" description={t.title} label="Your comment" confirm="Post comment" url={`/tickets/${id}/comments`} field="body" min={2} success="Comment posted" />
      <ReasonDialog open={redo} onOpenChange={setRedo} title="Ask for a redo" description="It goes back to the top of the queue with High priority." label="What needs to change?" confirm="Send back" url={`/tickets/${id}/redo`} field="reason" success="Sent back for a redo" />
      <NotDoneDialog open={notDone} onOpenChange={setNotDone} />
    </div>
  );
}

const BackLink = () => <Link href="/home" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to requests</Link>;
const Meta = ({ k, v }: { k: string; v: string }) => <div><dt className="text-xs font-semibold text-muted-foreground">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>;

function FileRow({ f }: { f: TicketDetail['files'][number] }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{f.name}</p>
        <p className="text-xs text-muted-foreground">{bytes(f.size)}{f.originalSize ? ` · made smaller from ${bytes(f.originalSize)}` : ''}</p>
      </div>
      <a href={`/api/files/${f.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold text-primary hover:bg-primary/10"><Download className="size-3.5" />Download</a>
    </li>
  );
}
