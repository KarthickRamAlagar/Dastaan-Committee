import { ArrowDown, ArrowUp, CheckCircle2, Circle, Clock3, Loader, RotateCcw } from 'lucide-react';
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from '@dastaan/shared';
import { cn } from '../../lib/utils';

const chip = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold leading-none';

const STATUS = {
  pending: { cls: 'border-primary/40 bg-primary/10 text-primary', Icon: Clock3 },
  in_progress: { cls: 'border-info/40 bg-info/10 text-info', Icon: Loader },
  done: { cls: 'border-success/40 bg-success/10 text-success', Icon: CheckCircle2 },
} as const;
const PRIORITY = {
  high: { cls: 'border-danger/40 bg-danger/10 text-danger', Icon: ArrowUp },
  low: { cls: 'border-border bg-muted text-muted-foreground', Icon: ArrowDown },
} as const;

export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const { cls, Icon } = STATUS[status];
  return <span className={cn(chip, cls, className)}><Icon className="size-3.5" aria-hidden />{STATUS_LABEL[status]}</span>;
}
export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  const { cls, Icon } = PRIORITY[priority];
  return <span className={cn(chip, cls, className)}><Icon className="size-3.5" aria-hidden />{PRIORITY_LABEL[priority]}</span>;
}
export function RedoChip({ className }: { className?: string }) {
  return <span className={cn(chip, 'border-ember/50 bg-ember/15 text-ember', className)}><RotateCcw className="size-3.5" aria-hidden />Redo</span>;
}
export function Chip({ children, tone = 'muted', icon: Icon = Circle, className }: { children: React.ReactNode; tone?: 'muted' | 'primary' | 'success' | 'danger' | 'info'; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  const t = { muted: 'border-border bg-muted text-muted-foreground', primary: 'border-primary/40 bg-primary/10 text-primary', success: 'border-success/40 bg-success/10 text-success', danger: 'border-danger/40 bg-danger/10 text-danger', info: 'border-info/40 bg-info/10 text-info' }[tone];
  return <span className={cn(chip, t, className)}><Icon className="size-3.5" />{children}</span>;
}
