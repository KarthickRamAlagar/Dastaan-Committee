'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { supportBody, type SupportDto } from '@dastaan/shared';
import { get, post } from '../lib/api';
import { ago } from '../lib/format';
import { useMe } from '../lib/auth';
import { RoleGuard } from '../components/role-guard';
import { Button } from '../components/ui/button';
import { Chip } from '../components/ui/chip';
import { Field, Input, Textarea } from '../components/ui/form';
import { Empty, PageHeader } from '../components/ui/misc';
import { errMsg } from '../components/tickets/hooks';
import { z } from 'zod';

type Form = z.infer<typeof supportBody>;

export default function Page() {
  return <RoleGuard roles={['convenor', 'lead', 'member']}><Support /></RoleGuard>;
}

function Support() {
  const me = useMe();
  const toLead = me.role === 'member';
  const who = toLead ? 'your Committee Lead' : 'the Admin';
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['support-mine'], queryFn: () => get<SupportDto[]>('/support/mine') });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(supportBody), defaultValues: { subject: '', body: '' } });
  const send = useMutation({
    mutationFn: (v: Form) => post('/support', v),
    onSuccess: () => { toast.success(`Sent to ${who}`); reset(); void qc.invalidateQueries({ queryKey: ['support-mine'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title={toLead ? 'Contact my Lead' : 'Contact admin'} subtitle={toLead ? 'Need your name, email, phone or sub-committee corrected? Ask your Committee Lead here. They change it for you.' : 'Need your name, email, phone or committee corrected, or an account removed? Ask here.'} />
        <form onSubmit={handleSubmit((v) => send.mutate(v))} className="panel space-y-5 p-5 sm:p-7" noValidate>
          <Field label="Subject" error={errors.subject?.message}>{(p) => <Input {...p} {...register('subject')} maxLength={160} placeholder="e.g. Change my phone number" />}</Field>
          <Field label="What should change" error={errors.body?.message}>{(p) => <Textarea {...p} {...register('body')} maxLength={3000} />}</Field>
          <Button type="submit" loading={send.isPending}><Send /> {toLead ? 'Send to my Lead' : 'Send to Admin'}</Button>
        </form>
      </div>
      <section aria-label="Your requests" className="lg:pt-[4.25rem]">
        <h2 className="mb-3 font-display text-lg font-semibold">Your requests</h2>
        {mine.data?.length ? (
          <ul className="space-y-3">
            {mine.data.map((s) => (
              <li key={s.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3"><p className="font-semibold">{s.subject}</p><Chip tone={s.status === 'done' ? 'success' : 'primary'}>{s.status === 'done' ? 'Done' : 'Open'}</Chip></div>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{ago(s.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : <div className="panel"><Empty icon={LifeBuoy} title="Nothing sent yet">Your requests will be listed here.</Empty></div>}
      </section>
    </div>
  );
}
