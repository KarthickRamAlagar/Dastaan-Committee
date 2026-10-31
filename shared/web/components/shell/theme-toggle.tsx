'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const light = mounted && resolvedTheme === 'light';
  return (
    <button
      role="switch"
      aria-checked={light}
      aria-label="Light theme"
      onClick={() => setTheme(light ? 'dark' : 'light')}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    >
      <span className="flex items-center gap-3">{light ? <Sun className="size-4" /> : <Moon className="size-4" />}{light ? 'Light mode' : 'Dark mode'}</span>
      <span className={cn('relative h-5 w-9 rounded-full border border-border transition-colors', light ? 'bg-primary/80' : 'bg-muted')}>
        <span className={cn('absolute top-0.5 size-3.5 rounded-full bg-foreground transition-all', light ? 'left-[1.15rem]' : 'left-0.5')} />
      </span>
    </button>
  );
}
