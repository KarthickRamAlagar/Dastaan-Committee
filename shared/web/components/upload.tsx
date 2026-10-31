'use client';
import { CheckCircle2, FileText, ImageIcon, Loader2, Paperclip, Trash2, TriangleAlert } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { MAX_PICK_BYTES, TICKET_FILE_EXTENSIONS } from '@dastaan/shared';
import { uploadFile } from '../lib/api';
import { prepareForUpload } from '../lib/compress';
import { bytes } from '../lib/format';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

export type Kind = 'request' | 'handoff' | 'mail' | 'logo';
export interface Item {
  key: string;
  name: string;
  size: number;
  state: 'preparing' | 'uploading' | 'done' | 'error';
  note?: string;
  pct: number;
  id?: string;
  originalSize?: number | null;
}

export function useUploads(kind: Kind, max = 5) {
  const [items, setItems] = useState<Item[]>([]);
  const patch = useCallback((key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i))), []);

  const add = useCallback(
    async (files: FileList | File[]) => {
      const list = [...files];
      for (const f of list) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setItems((cur) => {
          if (cur.length >= max) return cur;
          return [...cur, { key, name: f.name, size: f.size, state: 'preparing', pct: 0 }];
        });
        try {
          if (kind !== 'mail') {
            const e = f.name.split('.').pop()?.toLowerCase() ?? '';
            if (!(TICKET_FILE_EXTENSIONS as readonly string[]).includes(e)) throw new Error('Only images, PDF, Word and PowerPoint files are accepted');
          }
          const prepared = await prepareForUpload(f, (note) => patch(key, { note }));
          patch(key, { state: 'uploading', note: prepared.compressed ? `Made smaller: ${bytes(prepared.originalSize)} → ${bytes(prepared.blob.size)}` : undefined, size: prepared.blob.size, name: prepared.name });
          const r = await uploadFile(prepared.blob, { kind, name: prepared.name, originalSize: prepared.originalSize, onProgress: (pct) => patch(key, { pct }) });
          patch(key, { state: 'done', pct: 100, id: r.id, originalSize: r.originalSize });
        } catch (e) {
          patch(key, { state: 'error', note: e instanceof Error ? e.message : 'Upload failed' });
        }
      }
    },
    [kind, max, patch],
  );
  const remove = useCallback((key: string) => setItems((cur) => cur.filter((i) => i.key !== key)), []);
  const reset = useCallback(() => setItems([]), []);
  return {
    items,
    add,
    remove,
    reset,
    ids: items.filter((i) => i.state === 'done' && i.id).map((i) => i.id!),
    busy: items.some((i) => i.state === 'preparing' || i.state === 'uploading'),
    full: items.length >= max,
  };
}

export function UploadBox({ uploads, hint, accept, disabled }: { uploads: ReturnType<typeof useUploads>; hint: string; accept?: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled && e.dataTransfer.files.length) void uploads.add(e.dataTransfer.files); }}
        className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed border-input px-4 py-6 text-center transition-colors', over && 'border-primary bg-primary/5', disabled && 'opacity-60')}
      >
        <Paperclip className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{hint}</p>
        <Button variant="secondary" size="sm" disabled={disabled || uploads.full} onClick={() => input.current?.click()}>Choose files</Button>
        <input ref={input} type="file" multiple hidden accept={accept} onChange={(e) => { if (e.target.files?.length) void uploads.add(e.target.files); e.target.value = ''; }} aria-label="Choose files" />
        <p className="text-xs text-muted-foreground/80">Up to {bytes(MAX_PICK_BYTES)} each. Files over 20 MB are made smaller automatically.</p>
      </div>
      {uploads.items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.items.map((i) => {
            const Icon = /\.(png|jpe?g|webp|gif|heic)$/i.test(i.name) ? ImageIcon : FileText;
            return (
              <li key={i.key} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className={cn('truncate text-xs', i.state === 'error' ? 'text-danger' : 'text-muted-foreground')}>
                      {i.state === 'preparing' ? (i.note ?? 'Preparing…') : i.state === 'uploading' ? `Uploading ${i.pct}%` : i.state === 'error' ? i.note : `${bytes(i.size)}${i.note ? ` · ${i.note}` : ''}`}
                    </p>
                  </div>
                  {i.state === 'done' ? <CheckCircle2 className="size-4 text-success" aria-label="Uploaded" /> : i.state === 'error' ? <TriangleAlert className="size-4 text-danger" aria-label="Failed" /> : <Loader2 className="size-4 animate-spin text-primary" aria-label="Working" />}
                  <button onClick={() => uploads.remove(i.key)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" aria-label={`Remove ${i.name}`}><Trash2 className="size-4" /></button>
                </div>
                {i.state === 'uploading' && <div className="mt-2 h-1 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${i.pct}%` }} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
