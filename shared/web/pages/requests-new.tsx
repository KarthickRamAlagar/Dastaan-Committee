'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { CommitteeDto } from '@dastaan/shared';
import { ApiError, get, post } from '../lib/api';
import { useMe } from '../lib/auth';
import { localToIso, nextHourLocal } from '../lib/format';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Field, Input, Select, Textarea } from '../components/ui/form';
import { PriorityPicker } from '../components/ui/form-bits';
import { PageHeader } from '../components/ui/misc';
import { UploadBox, useUploads } from '../components/upload';
import { useRefreshTickets } from '../components/tickets/hooks';

const schema = z.object({
  title: z.string().trim().min(3, 'Write a few words about what you need').max(200),
  details: z.string().trim().max(2000).optional(),
  toCommitteeId: z.string().min(1, 'Choose a committee'),
  assigneeId: z.string().optional(),
  priority: z.enum(['high', 'low']),
  neededBy: z.string().min(1, 'Pick a date and time').refine((v) => new Date(v).getTime() > Date.now() - 60_000, 'Pick a time in the future'),
});
type Form = z.infer<typeof schema>;

export default function NewRequestPage() {
  return <RoleGuard roles={['lead']}><NewRequest /></RoleGuard>;
}

function NewRequest() {
  const me = useMe();
  const router = useRouter();
  const refresh = useRefreshTickets();
  const uploads = useUploads('request');
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees') });
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { title: '', details: '', toCommitteeId: '', assigneeId: '', priority: 'low', neededBy: nextHourLocal() } });
  const { register, control, handleSubmit, setError, formState: { errors } } = form;

  const send = useMutation({
    mutationFn: (v: Form) => post<{ id: string }>('/tickets', { title: v.title, details: v.details || undefined, toCommitteeId: v.toCommitteeId, assigneeId: v.assigneeId || undefined, priority: v.priority, neededBy: localToIso(v.neededBy), attachmentIds: uploads.ids }),
    onSuccess: (r) => { toast.success('Request sent'); void refresh(); router.push(`/tickets/${r.id}`); },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) for (const [k, m] of Object.entries(e.fields)) if (k in schema.shape) setError(k as keyof Form, { message: m });
      toast.error(e instanceof ApiError ? e.message : 'Could not send the request');
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New request" subtitle={`From ${me.name}, ${me.committeeName}. The Lead of the committee you choose will pick it up and assign it to a member.`} />
      <form onSubmit={handleSubmit((v) => send.mutate(v))} className="panel space-y-5 p-5 sm:p-7" noValidate>
        <Field label="Request in short" error={errors.title?.message}>{(p) => <Input {...p} {...register('title')} maxLength={200} placeholder="e.g. Photographers for the opening ceremony" />}</Field>
        <Field label="More detail (optional)" error={errors.details?.message}>{(p) => <Textarea {...p} {...register('details')} maxLength={2000} placeholder="Anything that helps them say yes quickly" />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Which committee" error={errors.toCommitteeId?.message}>
            {(p) => (
              <Select {...p} {...register('toCommitteeId')}>
                <option value="">Choose a committee</option>
                {committees.data?.filter((c) => c.id !== me.committeeId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Date and time needed" error={errors.neededBy?.message}>{(p) => <Input {...p} {...register('neededBy')} type="datetime-local" />}</Field>
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold">Priority</p>
            <Controller control={control} name="priority" render={({ field }) => <PriorityPicker value={field.value} onChange={field.onChange} />} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Upload file <span className="font-normal text-muted-foreground">(optional)</span></p>
          <UploadBox uploads={uploads} hint="Images, PDF, Word or PowerPoint" accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.ppt,.pptx" />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" size="lg" loading={send.isPending} disabled={uploads.busy}><Send /> {uploads.busy ? 'Waiting for the file…' : 'Send request'}</Button>
        </div>
      </form>
    </div>
  );
}
