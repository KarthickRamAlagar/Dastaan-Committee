'use client';
import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

export function OtpInput({ value, onChange, onComplete, disabled, invalid }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const set = (next: string) => {
    const v = next.replace(/\D/g, '').slice(0, 6);
    onChange(v);
    if (v.length === 6) onComplete?.(v);
    refs.current[Math.min(v.length, 5)]?.focus();
  };
  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6 digit code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={value[i] ?? ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '');
            if (!d) return set(value.slice(0, i) + value.slice(i + 1));
            set(value.slice(0, i) + d + value.slice(i + 1));
          }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i] && i > 0) { refs.current[i - 1]?.focus(); } }}
          onPaste={(e) => { e.preventDefault(); set(e.clipboardData.getData('text')); }}
          onFocus={(e) => e.target.select()}
          className={cn('h-14 w-full min-w-0 rounded-xl border bg-background/60 text-center font-display text-2xl font-semibold tabular transition-colors focus-visible:border-primary', invalid ? 'border-danger' : 'border-input')}
        />
      ))}
    </div>
  );
}
