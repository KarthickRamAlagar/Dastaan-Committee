'use client';
import { motion, MotionConfig } from 'framer-motion';
import { CheckCircle2, Download, Flag, Quote } from 'lucide-react';
import type { HopDto } from '@dastaan/shared';
import { STATUS_LABEL } from '@dastaan/shared';
import { bytes, fShort, fTime } from '../../lib/format';
import { cn } from '../../lib/utils';
import { CommitteeIcon } from '../committee-icon';
import { StatusChip } from '../ui/chip';

function Logo({ hop, size }: { hop: HopDto; size: number }) {
  const color = hop.committeeColor ?? '#f59e0b';
  return hop.hasLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/committees/${hop.committeeId}/logo`} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="flex items-center justify-center rounded-full text-white" style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
      <CommitteeIcon icon={hop.committeeIcon} name={hop.committeeName} className={size > 48 ? 'size-7' : 'size-5'} />
    </span>
  );
}

/**
 * The journey of one request: every committee it passed through, left to right.
 * Lines draw in, nodes pop up one after another, and the committee holding it now pulses.
 * On a phone the strip scrolls sideways and snaps node by node.
 */
export function Timeline({ hops, compact = false, className }: { hops: HopDto[]; compact?: boolean; className?: string }) {
  const size = compact ? 40 : 60;
  return (
    <MotionConfig reducedMotion="user">
      <div className={cn('scroll-thin -mx-1 overflow-x-auto px-1 pb-2', className)} role="region" aria-label="Request timeline" tabIndex={0}>
        <ol className={cn('flex snap-x snap-mandatory', compact ? 'min-w-max gap-0' : 'min-w-max gap-0')}>
          {hops.map((h, i) => {
            const last = i === hops.length - 1;
            const current = last && h.status !== 'origin';
            const done = h.status === 'done';
            return (
              <li key={h.seq} aria-current={current ? 'step' : undefined} className={cn('relative flex shrink-0 snap-center flex-col items-center text-center', compact ? 'w-32 px-1' : 'w-48 px-2 sm:w-56')}>
                {!last && (
                  <motion.span
                    aria-hidden
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.15 + i * 0.28, duration: 0.45, ease: 'easeOut' }}
                    style={{ originX: 0, top: size / 2 - 1 }}
                    className={cn('absolute left-1/2 h-0.5 w-full', done || h.status === 'origin' ? 'bg-gradient-to-r from-success to-success/60' : 'bg-border')}
                  />
                )}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.28, type: 'spring', stiffness: 260, damping: 18 }}
                  className="relative z-10"
                >
                  <span className={cn('relative flex items-center justify-center rounded-full border-2 bg-card p-[3px]', done ? 'border-success' : h.status === 'origin' ? 'border-primary' : current ? 'border-primary animate-ring-pulse' : 'border-border')}>
                    <Logo hop={h} size={size} />
                    {done && <CheckCircle2 className="absolute -bottom-1 -right-1 size-5 rounded-full bg-card text-success" aria-hidden />}
                    {h.status === 'origin' && <Flag className="absolute -bottom-1 -right-1 size-5 rounded-full bg-card p-0.5 text-primary" aria-hidden />}
                  </span>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.28 }} className="mt-3 w-full">
                  <p className={cn('font-display font-semibold', compact ? 'text-sm' : 'text-base')}>{h.committeeName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.status === 'origin' ? 'Raised the request' : h.status === 'done' ? `${STATUS_LABEL.done}` : 'Working on it'}</p>
                  {h.status !== 'origin' && <div className="mt-2 flex justify-center"><StatusChip status={h.status} /></div>}
                  <p className="mt-2 text-xs tabular text-muted-foreground">
                    {fShort(h.enteredAt)} {fTime(h.enteredAt)}
                    {h.leftAt && h.status !== 'origin' && <> → {fShort(h.leftAt)}</>}
                  </p>
                  {!compact && h.note && (
                    <p className="mx-auto mt-2 flex max-w-[11rem] items-start gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-left text-xs italic text-muted-foreground"><Quote className="mt-0.5 size-3 shrink-0" aria-hidden />{h.note}</p>
                  )}
                  {!compact && h.files.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {h.files.map((f) => (
                        <li key={f.id}>
                          <a href={`/api/files/${f.id}`} className="mx-auto inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10" title={`${f.name} (${bytes(f.size)})`}>
                            <Download className="size-3 shrink-0" aria-hidden /><span className="truncate">{f.name}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </MotionConfig>
  );
}
