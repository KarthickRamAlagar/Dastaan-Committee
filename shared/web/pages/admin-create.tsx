'use client';
import { COLLEGE_EMAIL_EXAMPLE } from '@dastaan/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { createUserBody, type CommitteeDto, type CreateUserBody } from '@dastaan/shared';
import { ApiError, get, post } from '../lib/api';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Field, Input, Select } from '../components/ui/form';
import { PageHeader } from '../components/ui/misc';

export default function Page() {
  return <RoleGuard roles={['admin']}><Create /></RoleGuard>;
}

function Create() {
  const qc = useQueryClient();
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees') });
  const { register, handleSubmit, watch, reset, setError, formState: { errors } } = useForm<CreateUserBody>({ resolver: (v, c, o) => zodResolver(createUserBody)({ ...v, committeeId: v.committeeId || undefined }, c, o), defaultValues: { name: '', email: '', phone: '', designation: 'lead', committeeId: '' } });
  const designation = watch('designation');
  const create = useMutation({
    mutationFn: (v: CreateUserBody) => post('/users', { ...v, committeeId: v.designation === 'lead' ? v.committeeId : undefined }),
    onSuccess: (_r, v) => { toast.success(`${v.name} was added. A sign-in code was emailed${v.designation === 'admin' ? '.' : ' and the Convenor was told.'}`); reset({ name: '', email: '', phone: '', designation: v.designation, committeeId: '' }); void qc.invalidateQueries({ queryKey: ['users'] }); void qc.invalidateQueries({ queryKey: ['committees'] }); },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) for (const [k, m] of Object.entries(e.fields)) setError(k as keyof CreateUserBody, { message: m });
      toast.error(e instanceof ApiError ? e.message : 'Could not add this person');
    },
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Create Convenor or Lead" subtitle="They receive an email with a sign-in code. A committee can have several Leads." />
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="panel space-y-5 p-5 sm:p-7" noValidate>
        <Field label="Designation" error={errors.designation?.message}>
          {(p) => <Select {...p} {...register('designation')}><option value="lead">Committee Lead</option><option value="convenor">Convenor</option><option value="admin">Admin</option></Select>}
        </Field>
        {designation === 'lead' && (
          <Field label="Committee" error={errors.committeeId?.message}>
            {(p) => <Select {...p} {...register('committeeId')}><option value="">Choose a committee</option>{committees.data?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.leadCount ? ` (${c.leadCount} Lead${c.leadCount === 1 ? '' : 's'})` : ''}</option>)}</Select>}
          </Field>
        )}
        <Field label="Full name" error={errors.name?.message}>{(p) => <Input {...p} {...register('name')} autoComplete="off" />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={errors.email?.message} hint="College email: starts with bl. and ends with @bl.students.amrita.edu">{(p) => <Input {...p} type="email" {...register('email')} autoComplete="off" placeholder={COLLEGE_EMAIL_EXAMPLE} />}</Field>
          <Field label="Phone" error={errors.phone?.message}>{(p) => <Input {...p} type="tel" {...register('phone')} autoComplete="off" placeholder="+91 98765 43210" />}</Field>
        </div>
        <Button type="submit" loading={create.isPending}><UserPlus /> Create and send code</Button>
      </form>
    </div>
  );
}
