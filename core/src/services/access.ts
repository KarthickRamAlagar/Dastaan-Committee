import type { Status } from '@dastaan/shared';
import type { SessionUser } from '../env.js';

export interface TicketFacts {
  status: Status;
  toCommitteeId: string;
  assigneeId: string | null;
  memberDoneAt?: string | null;
}

/**
 * The single place that says who may do what to a ticket (zero trust: the browser is never asked).
 * - Only the Lead of the committee the ticket currently sits in can move its status, assign it or forward it.
 * - Only the Convenor can comment, and only once the ticket is Done.
 * - Redo is for the Convenor (on Done work) or that committee's Lead (on work in progress or done).
 */
export function ticketCan(u: SessionUser, t: TicketFacts) {
  const leadHere = u.role === 'lead' && u.committeeId === t.toCommitteeId;
  return {
    changeStatus: leadHere && t.status !== 'done',
    assign: leadHere && t.status !== 'done',
    forward: leadHere && t.status === 'done',
    redo: (u.role === 'convenor' && t.status === 'done') || (leadHere && t.status !== 'pending' && Boolean(t.assigneeId)),
    comment: u.role === 'convenor',
    // the assigned member tells their Lead the work is finished; only the Lead can move the status
    workDone: u.role === 'member' && t.assigneeId === u.id && t.status !== 'done' && !t.memberDoneAt,
  };
}

export const NEXT_STATUS: Record<Status, Status | null> = { pending: 'in_progress', in_progress: 'done', done: null };

/** SQL fragment that limits tickets to those a person may see. */
export function visibility(u: SessionUser): { sql: string; params: unknown[] } {
  if (u.role === 'convenor') return { sql: '1=1', params: [] };
  if ((u.role === 'lead' || u.role === 'member') && u.committeeId) {
    return { sql: 'EXISTS (SELECT 1 FROM ticket_hops h WHERE h.ticket_id = t.id AND h.committee_id = ?)', params: [u.committeeId] };
  }
  return { sql: '0=1', params: [] };
}
