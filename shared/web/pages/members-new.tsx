'use client';
import { COLLEGE_EMAIL_EXAMPLE } from '@dastaan/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { createMemberBody, type CreateMemberBody } from '@dastaan/shared';
import { ApiError, get, post } from '../lib/api';
import { useMe } from '../lib/auth';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Field, Input } from '../components/ui/form';
import { SubCommitteeSelect } from '../components/sub-committee';
import { Avatar, Empty, PageHeader } from '../components/ui/misc';

export default function Page() {
  return <RoleGuard roles={['lead']}><AddMembers /></RoleGuard>;
}

interface Person { id: string; name: string; role: string; email: string; subCommittee: string | null }

function AddMembers() {
  const me = useMe();
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ['directory', me.committeeId], queryFn: () => get<Person[]>('/users/directory') });
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<CreateMemberBody>({ resolver: zodResolver(createMemberBody), defaultValues: { name: '', email: '', phone: '', subCommittee: '' } });
  const add = useMutation({
    mutationFn: (v: CreateMemberBody) => post('/users/members', v),
    onSuccess: (_r, v) => { toast.success(`${v.name} was added and a sign-in code was emailed`); reset(); void qc.invalidateQueries({ queryKey: ['directory'] }); void qc.invalidateQueries({ queryKey: ['team'] }); },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof CreateMemberBody, { message: m });
      toast.error(e instanceof ApiError ? e.message : 'Could not add this member');
    },
  });
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <PageHeader title="Add committee members" subtitle="They get an email with a sign-in code. The Convenor is told too." />
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="panel space-y-5 p-5 sm:p-7" noValidate>
          <Field label="Committee" hint="Members can only be added to your own committee.">{(p) => <Input {...p} value={me.committeeName ?? ''} disabled readOnly />}</Field>
          <Field label="Full name" error={errors.name?.message}>{(p) => <Input {...p} {...register('name')} autoComplete="off" />}</Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message} hint="College email: starts with bl. and ends with @bl.students.amrita.edu">{(p) => <Input {...p} type="email" {...register('email')} autoComplete="off" placeholder={COLLEGE_EMAIL_EXAMPLE} />}</Field>
            <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register('phone')} autoComplete="off" placeholder="+91 98765 43210" />}</Field>
          </div>
          <Field label="Sub-committee" hint="The part of your committee this member works in." error={errors.subCommittee?.message}>
            {(p) => <SubCommitteeSelect {...p} {...register('subCommittee')} />}
          </Field>
          <Button type="submit" loading={add.isPending}><UserPlus /> Add member</Button>
        </form>
      </div>
      <section aria-label="Current team" className="lg:pt-[4.25rem]">
        <h2 className="mb-3 font-display text-lg font-semibold">Your team</h2>
        <div className="panel divide-y divide-border">
          {people.data?.length ? people.data.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={p.name} />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.role === 'lead' ? 'Committee Lead' : p.subCommittee ?? p.email}</p></div>
            </div>
          )) : <Empty title="No one yet">Members you add will show up here.</Empty>}
        </div>
      </section>
    </div>
  );
}
