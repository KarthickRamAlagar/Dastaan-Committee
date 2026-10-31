'use client';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const base =
  'w-full rounded-xl border border-input bg-background/60 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, 'h-10', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-[96px] resize-y py-2.5', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <div className="relative">
    <select ref={ref} className={cn(base, 'h-10 appearance-none pr-9', className)} {...p}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
  </div>
));
Select.displayName = 'Select';

/** Label + control + hint + error, wired together for screen readers. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: ReactNode; children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode; className?: string }) {
  const id = useId();
  const note = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-foreground/90">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': note })}
      {error ? <p id={`${id}-e`} role="alert" className="text-xs font-medium text-danger">{error}</p> : hint ? <p id={`${id}-h`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
