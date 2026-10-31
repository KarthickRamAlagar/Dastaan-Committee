'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { MessageSquareOff } from 'lucide-react';
import type { CommitteeDto } from '@dastaan/shared';
import { get, post } from '../../lib/api';
import { Button } from '../ui/button';
import { Field, Select, Textarea } from '../ui/form';
import { Modal } from '../ui/dialog';
import { UploadBox, useUploads } from '../upload';
import { errMsg, useRefreshTickets } from './hooks';

export function ForwardDialog({ ticketId, currentCommitteeId, open, onOpenChange }: { ticketId: string; currentCommitteeId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useRefreshTickets();
  const committees = useQuery({ queryKey: ['committees'], queryFn: () => get<CommitteeDto[]>('/committees'), enabled: open });
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const uploads = useUploads('handoff');
  const m = useMutation({
    mutationFn: () => post(`/tickets/${ticketId}/forward`, { toCommitteeId: to, note: note.trim() || undefined, attachmentIds: uploads.ids }),
    onSuccess: () => { toast.success('Forwarded to the next committee'); void refresh(); setTo(''); setNote(''); uploads.reset(); onOpenChange(false); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const ready = to && uploads.ids.length > 0 && !uploads.busy;
  return (
    <Modal open={open} onOpenChange={onOpenChange} wide title="Forward to the next committee" description="Attach what your committee finished. The Convenor and the next committee see these files on the timeline."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={m.isPending} disabled={!ready} onClick={() => m.mutate()}>Forward</Button></>}>
      <div className="space-y-4">
        <Field label="Next committee">
          {(p) => (
            <Select {...p} value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choose a committee</option>
              {committees.data?.filter((c) => c.id !== currentCommitteeId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">What you finished <span className="font-normal text-muted-foreground">(required)</span></p>
          <UploadBox uploads={uploads} hint="Images, PDF, Word or PowerPoint" accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.ppt,.pptx" />
        </div>
        <Field label="Note for them (optional)">{(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Anything they should know before they start" />}</Field>
      </div>
    </Modal>
  );
}

export function ReasonDialog({ open, onOpenChange, title, description, label, confirm, url, field, min = 5, success }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; label: string; confirm: string; url: string; field: 'reason' | 'body'; min?: number; success: string }) {
  const refresh = useRefreshTickets();
  const [text, setText] = useState('');
  const m = useMutation({
    mutationFn: () => post(url, { [field]: text.trim() }),
    onSuccess: () => { toast.success(success); void refresh(); setText(''); onOpenChange(false); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={m.isPending} disabled={text.trim().length < min} onClick={() => m.mutate()}>{confirm}</Button></>}>
      <Field label={label} hint={`At least ${min} characters`}>{(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />}</Field>
    </Modal>
  );
}

/** Shown when the Convenor tries to act before the work is Done. */
export function NotDoneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Not allowed yet" footer={<Button onClick={() => onOpenChange(false)}>Understood</Button>}>
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><MessageSquareOff className="size-5" /></span>
        <p className="text-sm leading-relaxed text-muted-foreground">As of now you are not allowed to take action on this request because it is still not <b className="text-foreground">Done</b>. You can comment once the committee Lead marks it Done.</p>
      </div>
    </Modal>
  );
}
