'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { COMMITTEE_ICONS, type CommitteeDto, type GrantAction, type GrantDto } from '@dastaan/shared';
import { del, get, patch, post } from '../lib/api';
import { fDateTime } from '../lib/format';
import { GRANT_ACTION_TEXT, GRANT_TONE } from '../lib/grants';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Modal } from '../components/ui/dialog';
import { Field, Input, Select, Textarea } from '../components/ui/form';
import { Empty, ErrorNote, PageHeader, Skeleton } from '../components/ui/misc';
import { UploadBox, useUploads } from '../components/upload';
import { CommitteeIcon, ICON_LABEL } from '../components/committee-icon';
import { errMsg } from '../components/tickets/hooks';

export default function Page() {
  return <RoleGuard roles={['admin']}><Committees /></RoleGuard>;
}

/** An approved, unexpired grant for exactly this action. The server checks it again and spends it. */
const usable = (grants: GrantDto[] | undefined, action: GrantAction, committeeId: string | null) =>
  grants?.find((g) => g.status === 'approved' && g.action === action && (g.committeeId ?? null) === committeeId);

function Committees() {
  const qc = useQueryClient();
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees') });
  const grants = useQuery({ queryKey: ['grants'], queryFn: () => get<GrantDto[]>('/grants'), refetchInterval: 30_000 });
  const [form, setForm] = useState<{ committee: CommitteeDto | null; grant: GrantDto } | null>(null);
  const [ask, setAsk] = useState<{ action: GrantAction; committee: CommitteeDto | null } | null>(null);
  const [remove, setRemove] = useState<{ committee: CommitteeDto; grant: GrantDto } | null>(null);
  const done = () => { void qc.invalidateQueries({ queryKey: ['committees'] }); void qc.invalidateQueries({ queryKey: ['grants'] }); };

  const destroy = useMutation({
    mutationFn: (v: { committee: CommitteeDto; grant: GrantDto }) => del(`/committees/${v.committee.id}?grantId=${v.grant.id}`),
    onSuccess: () => { toast.success('Committee deleted'); setRemove(null); done(); },
    onError: (e) => { toast.error(errMsg(e)); setRemove(null); done(); },
  });

  const createGrant = usable(grants.data, 'create', null);
  const pending = grants.data?.filter((g) => g.status === 'pending') ?? [];
  const history = grants.data?.slice(0, 6) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Committees" subtitle="Adding, editing or deleting a committee needs the Convenor’s approval. Each approval works once and lasts 24 hours."
        actions={createGrant
          ? <Button onClick={() => setForm({ committee: null, grant: createGrant })}><Plus /> Add committee</Button>
          : <Button variant="outline" onClick={() => setAsk({ action: 'create', committee: null })}><KeyRound /> Ask to add a committee</Button>} />
      {(committees.isError || grants.isError) && <ErrorNote message={errMsg(committees.error ?? grants.error)} retry={() => { void committees.refetch(); void grants.refetch(); }} />}
      {pending.length > 0 && <p className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">Waiting for the Convenor: {pending.map((g) => `${GRANT_ACTION_TEXT[g.action]}${g.committeeName ? ` (${g.committeeName})` : ''}`).join(', ')}.</p>}

      {committees.isPending ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div> : committees.data?.length === 0 ? (
        <div className="panel"><Empty icon={Building2} title="No committees yet">Ask the Convenor for permission to add the first one.</Empty></div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {committees.data?.map((c) => {
            const upd = usable(grants.data, 'update', c.id);
            const dlt = usable(grants.data, 'delete', c.id);
            return (
              <li key={c.id} className="panel flex flex-col gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-white" style={{ background: c.color ?? '#f59e0b' }}>
                    {c.hasLogo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/committees/${c.id}/logo`} alt="" className="size-full object-cover" /> : <CommitteeIcon icon={c.icon} name={c.name} className="size-5" />}
                  </span>
                  <div className="min-w-0"><p className="truncate font-display text-base font-semibold">{c.name}</p><p className="truncate text-xs text-muted-foreground">{c.leadCount === 0 ? 'No Lead yet' : c.leadCount === 1 ? `Lead: ${c.leadName}` : `${c.leadCount} Leads`} · {c.memberCount} {c.memberCount === 1 ? 'person' : 'people'}</p></div>
                </div>
                {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  {upd ? <Button size="sm" variant="secondary" onClick={() => setForm({ committee: c, grant: upd })}><Pencil /> Edit</Button> : <Button size="sm" variant="ghost" onClick={() => setAsk({ action: 'update', committee: c })}><Lock /> Ask to edit</Button>}
                  {dlt ? <Button size="sm" variant="danger" onClick={() => setRemove({ committee: c, grant: dlt })}><Trash2 /> Delete</Button> : <Button size="sm" variant="ghost" onClick={() => setAsk({ action: 'delete', committee: c })}><Lock /> Ask to delete</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 && (
        <section aria-label="Permission history">
          <h2 className="mb-3 font-display text-lg font-semibold">Your permission requests</h2>
          <ul className="panel divide-y divide-border">
            {history.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>{GRANT_ACTION_TEXT[g.action][0]!.toUpperCase() + GRANT_ACTION_TEXT[g.action].slice(1)}{g.committeeName ? `: ${g.committeeName}` : ''}<span className="ml-2 text-xs text-muted-foreground">{fDateTime(g.createdAt)}</span></span>
                <Chip tone={GRANT_TONE[g.status]}>{g.status === 'approved' ? `Approved until ${fDateTime(g.expiresAt)}` : g.status[0]!.toUpperCase() + g.status.slice(1)}</Chip>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ask && <AskDialog {...ask} onClose={() => setAsk(null)} onDone={() => { setAsk(null); done(); }} />}
      {form && <CommitteeForm {...form} onClose={() => setForm(null)} onDone={() => { setForm(null); done(); }} />}
      <Modal open={!!remove} onOpenChange={(o) => !o && setRemove(null)} title={`Delete ${remove?.committee.name ?? ''}?`} description="Old requests keep the committee’s name. A committee with people or open requests cannot be deleted."
        footer={<><Button variant="secondary" onClick={() => setRemove(null)}>Keep</Button><Button variant="danger" loading={destroy.isPending} onClick={() => remove && destroy.mutate(remove)}>Delete committee</Button></>} />
    </div>
  );
}

function AskDialog({ action, committee, onClose, onDone }: { action: GrantAction; committee: CommitteeDto | null; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: () => post('/grants', { action, committeeId: committee?.id, note: note.trim() || undefined }),
    onSuccess: () => { toast.success('Sent to the Convenor'); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Ask the Convenor" description={`You want to ${GRANT_ACTION_TEXT[action]}${committee ? `: ${committee.name}` : ''}.`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={send.isPending} onClick={() => send.mutate()}>Send request</Button></>}>
      <Field label="Why (optional)" hint="The Convenor sees this with your request.">{(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />}</Field>
    </Modal>
  );
}

function CommitteeForm({ committee, grant, onClose, onDone }: { committee: CommitteeDto | null; grant: GrantDto; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(committee?.name ?? '');
  const [description, setDescription] = useState(committee?.description ?? '');
  const [color, setColor] = useState(committee?.color ?? '#f59e0b');
  const [icon, setIcon] = useState(committee?.icon ?? (committee ? committee.name.toLowerCase() : ''));
  const logo = useUploads('logo', 1);
  const save = useMutation({
    mutationFn: () => {
      const b = { name: name.trim(), description: description.trim() || undefined, color, icon: (COMMITTEE_ICONS as readonly string[]).includes(icon) ? icon : undefined, logoAttachmentId: logo.ids[0], grantId: grant.id };
      return committee ? patch(`/committees/${committee.id}`, b) : post('/committees', b);
    },
    onSuccess: () => { toast.success(committee ? 'Committee updated' : 'Committee added'); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={committee ? `Edit ${committee.name}` : 'Add committee'} description="This uses your Convenor approval. It cannot be used again."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={name.trim().length < 2 || logo.busy} loading={save.isPending} onClick={() => save.mutate()}>{committee ? 'Save changes' : 'Add committee'}</Button></>}>
      <div className="space-y-4">
        <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />}</Field>
        <Field label="Description (optional)">{(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="min-h-[72px]" />}</Field>
        <Field label="Icon" hint="Shown instead of a letter wherever the committee appears.">{(p) => <Select {...p} value={icon} onChange={(e) => setIcon(e.target.value)}><option value="">Default building</option>{COMMITTEE_ICONS.map((k) => <option key={k} value={k}>{ICON_LABEL[k]}</option>)}</Select>}</Field>
        <Field label="Colour">{(p) => <Input {...p} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20 p-1" />}</Field>
        <div><p className="mb-1.5 text-[13px] font-semibold">Logo (optional)</p><UploadBox uploads={logo} hint="Drop a PNG, JPG or WebP logo here" accept="image/png,image/jpeg,image/webp" /></div>
      </div>
    </Modal>
  );
}
