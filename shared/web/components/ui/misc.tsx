import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { initials } from '../../lib/format';
import { cn } from '../../lib/utils';

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-lg bg-muted/70', className)} />;

export function Avatar({ name, className }: { name: string; className?: string }) {
  return <span aria-hidden className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-ember text-xs font-bold text-primary-foreground', className)}>{initials(name)}</span>;
}

export function Empty({ title, children, icon: Icon = Inbox, action }: { title: string; children?: ReactNode; icon?: React.ComponentType<{ className?: string }>; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-6" /></span>
      <p className="font-display text-base font-semibold">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ErrorNote({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {retry && <button onClick={retry} className="font-semibold underline underline-offset-2">Try again</button>}
    </div>
  );
}
