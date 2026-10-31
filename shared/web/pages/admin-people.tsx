'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Mail, Pencil, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ROLE_LABEL, type CommitteeDto, type Page, type UserDto } from '@dastaan/shared';
import { ApiError, del, get, patch, post, qs } from '../lib/api';
import { useMe } from '../lib/auth';
import { fDateTime } from '../lib/format';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Modal } from '../components/ui/dialog';
import { Field, Input, Select } from '../components/ui/form';
import { Avatar, Empty, ErrorNote, PageHeader, Skeleton } from '../components/ui/misc';
import { Pagination } from '../components/ui/pagination';
import { errMsg } from '../components/tickets/hooks';

export default function Page() {
  return <RoleGuard roles={['admin']}><People /></RoleGuard>;
}

const SIZE = 10;
const tone = { admin: 'danger', convenor: 'primary', lead: 'info', member: 'muted' } as const;

function People() {
  const me = useMe();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [role, setRole] = useState('');
  const [committeeId, setCommittee] = useState('');
  const [edit, setEdit] = useState<UserDto | null>(null);
  const [remove, setRemove] = useState<UserDto | null>(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [dq, role, committeeId]);

  const list = useQuery({ queryKey: ['users', { page, dq, role, committeeId }], queryFn: () => get<Page<UserDto>>(`/users${qs({ page, q: dq, role, committeeId })}`), placeholderData: keepPreviousData });
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees') });
  const rows = list.data?.items ?? [];

  const del_ = useMutation({
    mutationFn: (id: string) => del(`/users/${id}`),
    onSuccess: () => { toast.success('Person removed'); setRemove(null); void qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const testMail = useMutation({
    mutationFn: () => post<{ to: string; mode: 'smtp' | 'log' | 'off' }>('/system/test-mail'),
    onSuccess: (r) => (r.mode === 'smtp' ? toast.success(`Test email sent to ${r.to}. Check the inbox and spam folder.`) : toast.message(`Email is in "${r.mode}" mode, so nothing was delivered. Set the SMTP values in server/.env.`)),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="People" subtitle="Everyone who can sign in to Dastaan." actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => testMail.mutate()} disabled={testMail.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/70 px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"><Mail className="size-4" />{testMail.isPending ? 'Sending…' : 'Send test email'}</button><a href="/api/users/export.csv" download className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/70 px-4 text-sm font-semibold hover:bg-muted"><Download className="size-4" />Export CSV</a></div>} />
      <div className="panel grid gap-3 p-4 sm:grid-cols-[1fr_11rem_13rem]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" /></div>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Designation"><option value="">All designations</option>{(['admin', 'convenor', 'lead', 'member'] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
        <Select value={committeeId} onChange={(e) => setCommittee(e.target.value)} aria-label="Committee"><option value="">All committees</option>{committees.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </div>
      {list.isError && <ErrorNote message={errMsg(list.error)} retry={() => void list.refetch()} />}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="px-4 py-3 font-semibold">Person</th><th className="px-4 py-3 font-semibold">Designation</th><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Invited</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.isPending ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10" /></td></tr>) : rows.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={u.name} /><div className="min-w-0"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div></div></td>
                  <td className="px-4 py-3"><Chip tone={tone[u.role]}>{ROLE_LABEL[u.role]}</Chip>{u.committeeName && <p className="mt-1 text-xs text-muted-foreground">{u.committeeName}{u.subCommittee ? ` · ${u.subCommittee}` : ''}</p>}</td>
                  <td className="px-4 py-3 tabular text-muted-foreground">{u.phone || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground"><p>{fDateTime(u.invitedAt)}</p>{u.invitedByName && <p>by {u.invitedByName}</p>}</td>
                  <td className="px-4 py-3">{u.role === 'member' ? <p className="text-right text-xs text-muted-foreground">Managed by their Lead</p> : <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEdit(u)} aria-label={`Edit ${u.name}`}><Pencil /></Button>
                    <Button variant="ghost" size="icon" disabled={u.id === me.id} className="hover:text-danger" onClick={() => setRemove(u)} aria-label={`Remove ${u.name}`}><Trash2 /></Button>
                  </div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.isPending && rows.length === 0 && <Empty icon={Users} title="No one matches">Try a different search or clear the filters.</Empty>}
        <Pagination page={page} pageSize={list.data?.pageSize ?? SIZE} total={list.data?.total ?? 0} onPage={setPage} />
      </div>

      {edit && <EditDialog user={edit} committees={committees.data ?? []} onClose={() => setEdit(null)} />}
      <Modal open={!!remove} onOpenChange={(o) => !o && setRemove(null)} title="Remove this person?" description={remove ? `${remove.name} will no longer be able to sign in. Their past requests stay on record.` : undefined}
        footer={<><Button variant="secondary" onClick={() => setRemove(null)}>Keep</Button><Button variant="danger" loading={del_.isPending} onClick={() => remove && del_.mutate(remove.id)}>Remove</Button></>} />
    </div>
  );
}

const editSchema = z.object({ name: z.string().trim().min(2, 'Enter a name'), email: z.string().trim().toLowerCase().email('Enter a valid email'), phone: z.string().trim().regex(/^[+]?[0-9 ()-]{7,18}$/, 'Enter a valid phone number'), committeeId: z.string().optional() });
type EditForm = z.infer<typeof editSchema>;

function EditDialog({ user, committees, onClose }: { user: UserDto; committees: CommitteeDto[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues: { name: user.name, email: user.email, phone: user.phone, committeeId: user.committeeId ?? '' } });
  const save = useMutation({
    mutationFn: (v: EditForm) => {
      const body: Record<string, string> = {};
      if (v.name !== user.name) body.name = v.name;
      if (v.email !== user.email) body.email = v.email;
      if (v.phone !== user.phone) body.phone = v.phone;
      if (!Object.keys(body).length) throw new ApiError(0, 'NOOP', 'Nothing has changed');
      return patch(`/users/${user.id}`, body);
    },
    onSuccess: () => { toast.success('Saved'); void qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof EditForm, { message: m });
      toast.error(errMsg(e));
    },
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Edit ${user.name}`} description={`${ROLE_LABEL[user.role]}${user.committeeName ? `, ${user.committeeName}` : ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="edit-user" loading={save.isPending}>Save changes</Button></>}>
      <form id="edit-user" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}>{(p) => <Input {...p} {...register('name')} />}</Field>
        <Field label="Email" error={errors.email?.message} hint="Changing the email signs this person out.">{(p) => <Input {...p} type="email" {...register('email')} />}</Field>
        <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register('phone')} />}</Field>
      </form>
    </Modal>
  );
}
