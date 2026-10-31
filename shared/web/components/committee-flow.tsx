'use client';
import { motion } from 'framer-motion';
import { CommitteeIcon } from './committee-icon';

const FLOW: [string, string][] = [['Events', 'events'], ['Media', 'media'], ['Marketing', 'marketing'], ['Sponsorship', 'sponsorship'], ['Operations', 'operations'], ['Administration', 'administration']];

export function CommitteeFlow() {
  return (
    <div className="mt-10 grid max-w-md grid-cols-3 gap-x-4 gap-y-6" aria-hidden>
      {FLOW.map(([n, icon], i) => (
        <motion.div key={n} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.25, type: 'spring' }} className="flex flex-col items-center gap-2">
          <span className="flex size-14 items-center justify-center rounded-full border-2 border-primary/60 bg-card text-primary"><CommitteeIcon icon={icon} className="size-6" /></span>
          <span className="text-xs font-semibold text-muted-foreground">{n}</span>
        </motion.div>
      ))}
    </div>
  );
}
