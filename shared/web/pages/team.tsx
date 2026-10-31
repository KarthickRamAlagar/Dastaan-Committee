'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Pencil, Search, Trash2, UserPlus, Users, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { updateMemberBody, type Page, type SupportDto, type UserDto } from '@dastaan/shared';
import { ApiError, del, get, patch, qs } from '../lib/api';
import { ago } from '../lib/format';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Modal } from '../components/ui/dialog';
import { Field, Input, Select } from '../components/ui/form';
import { Avatar, Empty, ErrorNote, PageHeader, Skeleton } from '../components/ui/misc';
import { Pagination } from '../components/ui/pagination';
import { SubCommitteeSelect } from '../components/sub-committee';
import { errMsg } from '../components/tickets/hooks';

export default function Page() {
  return <RoleGuard roles={['lead']}><Team /></RoleGuard>;
}

function Team() {
  return (
    <div className="space-y-6">
      <PageHeader title="My committee" subtitle="Everyone in your committee. Change their details here, and answer their requests."
        actions={<Link href="/members/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"><UserPlus className="size-4" />Add committee members</Link>} />
      <MemberRequests />
      <Members />
    </div>
  );
}

function Members() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [edit, setEdit] = useState<UserDto | null>(null);
  const [remove, setRemove] = useState<UserDto | null>(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [dq]);
  const list = useQuery({ queryKey: ['team', page, dq], queryFn: () => get<Page<UserDto>>(`/users/members${qs({ page, q: dq })}`), placeholderData: keepPreviousData });
  const rows = list.data?.items ?? [];
  const del_ = useMutation({
    mutationFn: (id: string) => del(`/users/members/${id}`),
    onSuccess: () => { toast.success('Member removed'); setRemove(null); void qc.invalidateQueries({ queryKey: ['team'] }); void qc.invalidateQueries({ queryKey: ['directory'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <section className="panel overflow-hidden" aria-label="Committee members">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <h2 className="font-display text-lg font-semibold">Members{list.data ? <span className="ml-2 font-sans text-sm font-medium text-muted-foreground tabular">{list.data.total}</span> : null}</h2>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input className="h-9 w-56 pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search members" /></div>
      </div>
      {list.isError && <div className="p-4"><ErrorNote message={errMsg(list.error)} retry={() => void list.refetch()} /></div>}
      {list.isPending ? <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div> : rows.length === 0 ? (
        <Empty icon={Users} title="No members yet">Add your first member to start assigning work.</Empty>
      ) : (
        <>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">Member</th><th className="px-3 py-2.5 font-semibold">Sub-committee</th><th className="px-3 py-2.5 font-semibold">Phone</th><th className="px-4 py-2.5 text-right font-semibold">Actions</th></tr></thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={u.name} /><div className="min-w-0"><p className="truncate font-semibold">{u.name}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div></div></td>
                    <td className="px-3 py-3">{u.subCommittee ? <Chip tone="primary">{u.subCommittee}</Chip> : <span className="text-muted-foreground">Not set</span>}</td>
                    <td className="px-3 py-3 tabular text-muted-foreground">{u.phone || '—'}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEdit(u)} aria-label={`Edit ${u.name}`}><Pencil /></Button>
                      <Button variant="ghost" size="icon" className="hover:text-danger" onClick={() => setRemove(u)} aria-label={`Remove ${u.name}`}><Trash2 /></Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.data!.page} pageSize={list.data!.pageSize} total={list.data!.total} onPage={setPage} />
        </>
      )}
      {edit && <EditMember user={edit} onClose={() => setEdit(null)} />}
      <Modal open={!!remove} onOpenChange={(o) => !o && setRemove(null)} title="Remove this member?" description={remove ? `${remove.name} will no longer be able to sign in. Work assigned to them goes back to your queue. Past requests stay on record.` : undefined}
        footer={<><Button variant="secondary" onClick={() => setRemove(null)}>Keep</Button><Button variant="danger" loading={del_.isPending} onClick={() => remove && del_.mutate(remove.id)}>Remove</Button></>} />
    </section>
  );
}

const editSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[+]?[0-9 ()-]{7,18}$/, 'Enter a valid phone number'),
  subCommittee: z.string().trim().min(2, 'Enter a sub-committee').max(60),
});
type EditForm = z.infer<typeof editSchema>;

function EditMember({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<EditForm>({ resolver: zodResolver(editSchema), defaultValues: { name: user.name, email: user.email, phone: user.phone, subCommittee: user.subCommittee ?? '' } });
  const save = useMutation({
    mutationFn: (v: EditForm) => {
      const body: Record<string, string> = {};
      if (v.name !== user.name) body.name = v.name;
      if (v.email !== user.email) body.email = v.email;
      if (v.phone !== user.phone) body.phone = v.phone;
      if (v.subCommittee !== (user.subCommittee ?? '')) body.subCommittee = v.subCommittee;
      if (!Object.keys(body).length) throw new ApiError(0, 'NOOP', 'Nothing has changed');
      updateMemberBody.parse(body);
      return patch(`/users/members/${user.id}`, body);
    },
    onSuccess: () => { toast.success('Saved'); void qc.invalidateQueries({ queryKey: ['team'] }); void qc.invalidateQueries({ queryKey: ['directory'] }); onClose(); },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof EditForm, { message: m });
      toast.error(errMsg(e));
    },
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Edit ${user.name}`} description="Committee Member"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="edit-member" loading={save.isPending}>Save changes</Button></>}>
      <form id="edit-member" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
        <Field label="Full name" error={errors.name?.message}>{(p) => <Input {...p} {...register('name')} />}</Field>
        <Field label="Email" error={errors.email?.message} hint="Changing the email signs this member out.">{(p) => <Input {...p} type="email" {...register('email')} />}</Field>
        <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register('phone')} />}</Field>
        <Field label="Sub-committee" error={errors.subCommittee?.message}>
          {(p) => <SubCommitteeSelect {...p} {...register('subCommittee')} />}
        </Field>
      </form>
    </Modal>
  );
}

function MemberRequests() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [show, setShow] = useState('open');
  const q = useQuery({ queryKey: ['support-inbox', page], queryFn: () => get<Page<SupportDto> & { open: number }>(`/support/inbox${qs({ page })}`), placeholderData: keepPreviousData });
  const set = useMutation({
    mutationFn: (v: { id: string; status: 'open' | 'done' }) => patch(`/support/${v.id}`, { status: v.status }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['support-inbox'] }); void qc.invalidateQueries({ queryKey: ['support-inbox-open'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const rows = (q.data?.items ?? []).filter((s) => show === 'all' || s.status === show);
  return (
    <section className="panel overflow-hidden" aria-label="Requests from members">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <h2 className="font-display text-lg font-semibold">Requests from members{q.data ? <span className="ml-2 rounded-full bg-ember px-2 py-0.5 align-middle font-sans text-[11px] font-bold text-white">{q.data.open} open</span> : null}</h2>
        <Select className="h-9 w-36" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show"><option value="open">Open</option><option value="done">Done</option><option value="all">All</option></Select>
      </div>
      {q.isError && <div className="p-4"><ErrorNote message={errMsg(q.error)} retry={() => void q.refetch()} /></div>}
      {rows.length === 0 && !q.isPending ? <Empty icon={Inbox} title="No requests">When a member asks you to change their details it shows here. Edit them in the list below, then mark the request done.</Empty> : (
        <ul className="divide-y divide-border/60">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{s.subject}</p><Chip tone={s.status === 'done' ? 'success' : 'primary'}>{s.status === 'done' ? 'Done' : 'Open'}</Chip></div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s.fromName} · {s.fromEmail} · {ago(s.createdAt)}</p>
              </div>
              {s.status === 'open'
                ? <Button size="sm" variant="secondary" loading={set.isPending && set.variables?.id === s.id} onClick={() => set.mutate({ id: s.id, status: 'done' })}><Check /> Mark done</Button>
                : <Button size="sm" variant="ghost" onClick={() => set.mutate({ id: s.id, status: 'open' })}><Undo2 /> Reopen</Button>}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={q.data?.pageSize ?? 7} total={q.data?.total ?? 0} onPage={setPage} />
    </section>
  );
}
