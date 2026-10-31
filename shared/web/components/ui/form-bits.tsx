'use client';
import { cn } from '../../lib/utils';
import { PRIORITIES, PRIORITY_LABEL, type Priority } from '@dastaan/shared';
import { PriorityChip } from './chip';

export function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-2">
      {PRIORITIES.map((p) => (
        <label key={p} className={cn('cursor-pointer rounded-xl border p-1 transition-colors', value === p ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/60')}>
          <input type="radio" name="priority" value={p} checked={value === p} onChange={() => onChange(p)} className="sr-only" />
          <PriorityChip priority={p} className="pointer-events-none px-3 py-1.5 text-[13px]" />
          <span className="sr-only">{PRIORITY_LABEL[p]}</span>
        </label>
      ))}
    </div>
  );
}
