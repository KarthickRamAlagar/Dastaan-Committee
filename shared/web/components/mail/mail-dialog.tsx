'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Lock, Search, Send, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { TOAST_MS_LEAD_LOCKED, type CommitteeDto } from '@dastaan/shared';
import { get, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Modal } from '../ui/dialog';
import { Field, Input, Textarea } from '../ui/form';
import { UploadBox, useUploads } from '../upload';
import { errMsg } from '../tickets/hooks';

interface Person { id: string; name: string; role: 'lead' | 'member'; committeeId: string | null; committeeName: string | null; email: string }
type Mode = 'all' | 'leads' | 'committees' | 'members';

export function MailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me } = useAuth();
  if (!me || (me.role !== 'convenor' && me.role !== 'lead')) return null;
  return <MailForm open={open} onOpenChange={onOpenChange} role={me.role} myCommitteeId={me.committeeId} myId={me.id} myCommittee={me.committeeName} />;
}

function MailForm({ open, onOpenChange, role, myCommitteeId, myId, myCommittee }: { open: boolean; onOpenChange: (o: boolean) => void; role: 'convenor' | 'lead'; myCommitteeId: string | null; myId: string; myCommittee: string | null }) {
  const convenor = role === 'convenor';
  const [mode, setMode] = useState<Mode>(convenor ? 'all' : 'committees');
  const [committeeIds, setCommitteeIds] = useState<string[]>(myCommitteeId ? [myCommitteeId] : []);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const uploads = useUploads('mail');
  const [channel, setChannel] = useState<'both' | 'notification'>('both');
  const emailToo = channel === 'both';

  const people = useQuery({ queryKey: ['mail-people'], queryFn: () => get<Person[]>('/users/directory'), enabled: open, staleTime: 60_000 });
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees'), enabled: open && convenor });

  const all = useMemo(() => (people.data ?? []).filter((p) => p.id !== myId), [people.data, myId]);
  const leadByCommittee = useMemo(() => new Map(all.filter((p) => p.role === 'lead' && p.committeeId).map((p) => [p.committeeId!, p])), [all]);
  // A chosen person always brings their committee's Lead.
  const lockedLeadIds = useMemo(() => {
    if (!convenor) return new Set<string>();
    const s = new Set<string>();
    for (const id of picked) {
      const p = all.find((x) => x.id === id);
      const lead = p?.committeeId ? leadByCommittee.get(p.committeeId) : undefined;
      if (lead && lead.id !== id) s.add(lead.id);
    }
    return s;
  }, [picked, all, leadByCommittee, convenor]);
  const finalIds = useMemo(() => [...new Set([...picked, ...lockedLeadIds])], [picked, lockedLeadIds]);

  const count = mode === 'all' ? all.length : mode === 'leads' ? all.filter((p) => p.role === 'lead').length : mode === 'committees' ? all.filter((p) => p.committeeId && committeeIds.includes(p.committeeId)).length : finalIds.length;

  const blocked = (name?: string) => toast.error(`The system will not allow removing the Committee Lead${name ? ` (${name})` : ''} while their committee members are selected.`, { duration: TOAST_MS_LEAD_LOCKED });
  const toggle = (id: string) => {
    if (lockedLeadIds.has(id)) return blocked(all.find((p) => p.id === id)?.name);
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const filtered = all.filter((p) => !search.trim() || `${p.name} ${p.committeeName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const grouped = useMemo(() => {
    const m = new Map<string, Person[]>();
    for (const p of filtered) m.set(p.committeeName ?? 'Other', [...(m.get(p.committeeName ?? 'Other') ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  const send = useMutation({
    mutationFn: () =>
      post<{ recipientCount: number; autoAddedLeads: string[] }>('/mail', {
        subject: subject.trim(),
        body: body.trim(),
        attachmentIds: emailToo ? uploads.ids : [],
        channel,
        audience: mode === 'all' ? { type: 'all' } : mode === 'leads' ? { type: 'leads' } : mode === 'committees' ? { type: 'committees', committeeIds } : { type: 'members', userIds: picked },
      }),
    onSuccess: (r) => {
      toast.success(`${emailToo ? 'Email and notification' : 'Notification'} on its way to ${r.recipientCount} ${r.recipientCount === 1 ? 'person' : 'people'}${r.autoAddedLeads.length ? `, including ${r.autoAddedLeads.join(', ')} (Committee Lead)` : ''}`);
      setSubject(''); setBody(''); setPicked([]); uploads.reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const modes: { id: Mode; label: string; hint: string }[] = convenor
    ? [
        { id: 'all', label: 'Everyone', hint: 'All Leads and members' },
        { id: 'leads', label: 'Committee Leads', hint: 'Leads only' },
        { id: 'committees', label: 'Whole committees', hint: 'Members and their Lead' },
        { id: 'members', label: 'Specific people', hint: 'Their Leads join automatically' },
      ]
    : [
        { id: 'committees', label: `Whole ${myCommittee ?? 'committee'}`, hint: 'Every member of your committee' },
        { id: 'members', label: 'Specific members', hint: 'Choose from your committee' },
      ];

  const valid = subject.trim().length >= 3 && body.trim().length >= 2 && count > 0 && !uploads.busy && (mode !== 'committees' || committeeIds.length > 0) && (mode !== 'members' || picked.length > 0);

  return (
    <Modal open={open} onOpenChange={onOpenChange} wide title="Send a message" description={convenor ? 'Choose email, notification, or both. Everyone you pick sees it in their notification bell.' : 'Choose email, notification, or both. The Convenors are copied on what you send.'}
      footer={<>
        <span className="mr-auto self-center text-xs text-muted-foreground tabular">{count} {count === 1 ? 'recipient' : 'recipients'}</span>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button loading={send.isPending} disabled={!valid} onClick={() => send.mutate()}><Send /> {emailToo ? 'Send message' : 'Send notification'}</Button>
      </>}>
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">To whom</legend>
          <div className={cn('grid gap-2', convenor ? 'sm:grid-cols-2' : 'sm:grid-cols-2')} role="radiogroup">
            {modes.map((m) => (
              <label key={m.id} className={cn('cursor-pointer rounded-xl border px-3 py-2.5 transition-colors', mode === m.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>
                <input type="radio" name="audience" className="sr-only" checked={mode === m.id} onChange={() => setMode(m.id)} />
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'committees' && convenor && (
          <div>
            <p className="mb-2 text-[13px] font-semibold">Committees</p>
            <div className="flex flex-wrap gap-2">
              {committees.data?.map((c) => {
                const on = committeeIds.includes(c.id);
                return <button key={c.id} type="button" aria-pressed={on} onClick={() => setCommitteeIds((cur) => (on ? cur.filter((x) => x !== c.id) : [...cur, c.id]))} className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{c.name}</button>;
              })}
            </div>
          </div>
        )}

        {mode === 'members' && (
          <div className="space-y-3">
            {finalIds.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Chosen people">
                {finalIds.map((id) => {
                  const p = all.find((x) => x.id === id);
                  if (!p) return null;
                  const locked = lockedLeadIds.has(id);
                  return (
                    <li key={id} className={cn('flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-sm', locked ? 'border-primary/50 bg-primary/10' : 'border-border bg-muted/60')}>
                      <span className="font-medium">{p.name}</span>
                      {locked && <span className="text-[11px] font-semibold text-primary">Lead</span>}
                      <button type="button" onClick={() => toggle(id)} aria-label={locked ? `${p.name} cannot be removed` : `Remove ${p.name}`} className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground">{locked ? <Lock className="size-3" /> : <X className="size-3" />}</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or committee" aria-label="Search people" className="pl-9" />
            </div>
            <div className="scroll-thin max-h-56 overflow-y-auto rounded-xl border border-border">
              {people.isPending ? <p className="p-4 text-sm text-muted-foreground">Loading people…</p> : grouped.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nobody matches.</p> : grouped.map(([cn_, list]) => (
                <div key={cn_}>
                  <p className="sticky top-0 bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground">{cn_}</p>
                  {list.map((p) => {
                    const on = finalIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                        <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="size-4 accent-[hsl(var(--primary))]" />
                        <span className="flex-1">{p.name}</span>
                        {p.role === 'lead' && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">Lead</span>}
                        {lockedLeadIds.has(p.id) && <Lock className="size-3.5 text-primary" aria-label="Added automatically" />}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">How to send it</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {([['both', 'Email and notification', 'Arrives in their inbox and the bell'], ['notification', 'Notification only', 'Shows in the bell inside Dastaan, no email']] as const).map(([id, label, hint]) => (
              <label key={id} className={cn('cursor-pointer rounded-xl border px-3 py-2.5 transition-colors', channel === id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>
                <input type="radio" name="channel" className="sr-only" checked={channel === id} onChange={() => setChannel(id)} />
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Subject">{(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="What is this about?" />}</Field>
        <Field label="Message">{(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} className="min-h-[140px]" placeholder="Write your message" />}</Field>
        {emailToo && <div>
          <p className="mb-1.5 text-[13px] font-semibold">Files and images <span className="font-normal text-muted-foreground">(optional)</span></p>
          <UploadBox uploads={uploads} hint="Any file or image. People get a secure download link in the email." />
        </div>}
      </div>
    </Modal>
  );
}
