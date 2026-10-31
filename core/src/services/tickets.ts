import type { AttachmentDto, FileRef, HopDto, Priority, StatBlock, Status, TicketDetail, TicketEventDto, TicketRow } from '@dastaan/shared';
import type { SessionUser } from '../env.js';
import { all, first, newId, nowIso, run } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import { ticketCan, visibility } from './access.js';

export const TICKET_SELECT = `SELECT t.id, 'TKT-' || printf('%04d', t.seq) AS code, t.title, t.priority, t.status, t.redo_pending AS redoPending,
  t.created_at AS createdAt, t.needed_by AS neededBy,
  t.requester_id AS requesterId, ru.name AS requesterName,
  t.from_committee_id AS fromCommitteeId, fc.name AS fromCommittee,
  t.to_committee_id AS toCommitteeId, tc.name AS toCommittee,
  t.assignee_id AS assigneeId, au.name AS assigneeName, t.sub_committee AS subCommittee, t.member_done_at AS memberDoneAt,
  (SELECT COUNT(*) FROM attachments a WHERE a.ticket_id = t.id AND a.committed = 1) AS fileCount,
  (SELECT c.body FROM ticket_comments c WHERE c.ticket_id = t.id AND c.kind = 'comment' ORDER BY c.created_at DESC LIMIT 1) AS comment,
  (SELECT c.created_at FROM ticket_comments c WHERE c.ticket_id = t.id AND c.kind = 'comment' ORDER BY c.created_at DESC LIMIT 1) AS commentAt,
  t.hop_count AS hops, t.details AS details,
  (SELECT cc.name FROM ticket_hops hp JOIN committees cc ON cc.id = hp.committee_id WHERE hp.ticket_id = t.id AND hp.seq = t.hop_count - 2 AND t.hop_count > 2) AS hoFrom,
  (SELECT uu.name FROM ticket_hops hp JOIN users uu ON uu.id = hp.forwarded_by WHERE hp.ticket_id = t.id AND hp.seq = t.hop_count - 2 AND t.hop_count > 2) AS hoBy,
  (SELECT hp.note FROM ticket_hops hp WHERE hp.ticket_id = t.id AND hp.seq = t.hop_count - 2 AND t.hop_count > 2) AS hoNote
  FROM tickets t
  JOIN users ru ON ru.id = t.requester_id
  JOIN committees fc ON fc.id = t.from_committee_id
  JOIN committees tc ON tc.id = t.to_committee_id
  LEFT JOIN users au ON au.id = t.assignee_id`;

export type RawRow = Omit<TicketRow, 'redoPending' | 'handoff' | 'fileList'> & { redoPending: number; hoFrom: string | null; hoBy: string | null; hoNote: string | null };
export const shapeRow = (r: RawRow, fileList: FileRef[] = []): TicketRow => {
  const { hoFrom, hoBy, hoNote, ...rest } = r;
  return { ...rest, redoPending: !!r.redoPending, handoff: hoFrom ? { fromCommittee: hoFrom, byName: hoBy, note: hoNote } : null, fileList };
};

/** Files for a page of requests in one query (original files plus every committee's hand-over files). */
export async function filesFor(db: D1Database, ticketIds: string[]): Promise<Map<string, FileRef[]>> {
  const out = new Map<string, FileRef[]>();
  if (!ticketIds.length) return out;
  const rows = await all<FileRef & { ticketId: string }>(
    db,
    `SELECT a.id, a.ticket_id AS ticketId, a.name, a.size, a.kind, c.name AS fromCommittee
       FROM attachments a LEFT JOIN ticket_hops h ON h.id = a.hop_id LEFT JOIN committees c ON c.id = h.committee_id
      WHERE a.committed = 1 AND a.kind IN ('request','handoff') AND a.ticket_id IN (SELECT value FROM json_each(?)) ORDER BY a.created_at`,
    JSON.stringify(ticketIds),
  );
  for (const { ticketId, ...f } of rows) (out.get(ticketId) ?? out.set(ticketId, []).get(ticketId)!).push(f);
  return out;
}

export const SORTS: Record<string, string> = {
  // work queue: open work first, redo on top, then by priority, newest first
  queue: `CASE WHEN t.status = 'done' THEN 1 ELSE 0 END, t.redo_pending DESC, CASE t.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, t.created_at DESC`,
  newest: 't.created_at DESC',
  // "received" view: highest priority first, then by time stamp
  priority: `t.redo_pending DESC, CASE t.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, t.created_at DESC`,
};

export interface ListQuery {
  scope: 'all' | 'inbox' | 'sent';
  status?: string;
  priority?: string;
  committeeId?: string;
  q?: string;
  forwarded?: boolean;
  sort: string;
  page: number;
  pageSize: number;
}

export async function listTickets(db: D1Database, u: SessionUser, q: ListQuery) {
  const vis = visibility(u);
  const where = [vis.sql];
  const p: unknown[] = [...vis.params];
  if (q.scope === 'sent') (where.push('t.requester_id = ?'), p.push(u.id));
  if (q.scope === 'inbox') {
    if (u.role === 'member') (where.push('t.assignee_id = ?'), p.push(u.id));
    else if (u.role === 'lead') (where.push('t.to_committee_id = ?'), p.push(u.committeeId));
  }
  if (q.status && ['pending', 'in_progress', 'done'].includes(q.status)) (where.push('t.status = ?'), p.push(q.status));
  if (q.priority && ['high', 'low'].includes(q.priority)) (where.push('t.priority = ?'), p.push(q.priority));
  if (q.committeeId && u.role === 'convenor') {
    where.push('EXISTS (SELECT 1 FROM ticket_hops hh WHERE hh.ticket_id = t.id AND hh.committee_id = ?)');
    p.push(q.committeeId);
  }
  if (q.forwarded) where.push('t.hop_count > 2');
  if (q.q?.trim()) {
    const like = `%${q.q.trim().replace(/[\\%_]/g, '\\$&')}%`;
    where.push("(t.title LIKE ? ESCAPE '\\' OR ru.name LIKE ? ESCAPE '\\' OR ('TKT-' || printf('%04d', t.seq)) LIKE ? ESCAPE '\\')");
    p.push(like, like, like);
  }
  const W = where.join(' AND ');
  const total = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tickets t JOIN users ru ON ru.id = t.requester_id WHERE ${W}`, ...p))!.n;
  const rows = await all<RawRow>(db, `${TICKET_SELECT} WHERE ${W} ORDER BY ${SORTS[q.sort] ?? SORTS.queue} LIMIT ? OFFSET ?`, ...p, q.pageSize, (q.page - 1) * q.pageSize);
  const files = await filesFor(db, rows.map((r) => r.id));
  return { items: rows.map((r) => shapeRow(r, files.get(r.id) ?? [])), total, page: q.page, pageSize: q.pageSize };
}

const blank = (): StatBlock => ({ pending: 0, in_progress: 0, done: 0, high: 0, low: 0, total: 0 });
export function addCount(s: StatBlock, status: Status, priority: Priority, n: number) {
  s[status] += n;
  s[priority] += n;
  s.total += n;
}
export const emptyStats = blank;

export async function loadStats(db: D1Database, u: SessionUser, committeeId?: string) {
  const overall = blank();
  if (u.role === 'convenor') {
    const rows = await all<{ cid: string; status: Status; priority: Priority; n: number }>(
      db,
      `SELECT to_committee_id AS cid, status, priority, COUNT(*) AS n FROM tickets ${committeeId ? 'WHERE to_committee_id = ?' : ''} GROUP BY to_committee_id, status, priority`,
      ...(committeeId ? [committeeId] : []),
    );
    const by = new Map<string, StatBlock>();
    for (const r of rows) {
      addCount(overall, r.status, r.priority, r.n);
      const b = by.get(r.cid) ?? blank();
      addCount(b, r.status, r.priority, r.n);
      by.set(r.cid, b);
    }
    const names = await all<{ id: string; name: string; color: string | null; icon: string | null }>(db, 'SELECT id, name, color, icon FROM committees WHERE archived_at IS NULL ORDER BY sort_order, name');
    const byCommittee = names.map((c) => ({ committeeId: c.id, name: c.name, color: c.color, icon: c.icon, stats: by.get(c.id) ?? blank() }));
    return { committee: overall, byCommittee, mine: null };
  }
  if (!u.committeeId) return { committee: overall, byCommittee: null, mine: null };
  const rows = await all<{ status: Status; priority: Priority; n: number }>(db, 'SELECT status, priority, COUNT(*) AS n FROM tickets WHERE to_committee_id = ? GROUP BY status, priority', u.committeeId);
  for (const r of rows) addCount(overall, r.status, r.priority, r.n);
  const mine = {
    received: (await first<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tickets WHERE assignee_id = ?', u.id))!.n,
    receivedOpen: (await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tickets WHERE assignee_id = ? AND status != 'done'", u.id))!.n,
    sent: (await first<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tickets WHERE requester_id = ?', u.id))!.n,
  };
  return { committee: overall, byCommittee: null, mine };
}

export async function logEvent(db: D1Database, ticketId: string, actorId: string | null, kind: string, message: string) {
  await run(db, 'INSERT INTO ticket_events (id, ticket_id, actor_id, kind, message, created_at) VALUES (?,?,?,?,?,?)', newId(), ticketId, actorId, kind, message, nowIso());
}
export const eventStmt = (db: D1Database, ticketId: string, actorId: string | null, kind: string, message: string) =>
  db.prepare('INSERT INTO ticket_events (id, ticket_id, actor_id, kind, message, created_at) VALUES (?,?,?,?,?,?)').bind(newId(), ticketId, actorId, kind, message, nowIso());

export async function canSee(db: D1Database, u: SessionUser, ticketId: string) {
  const vis = visibility(u);
  return !!(await first(db, `SELECT 1 AS x FROM tickets t WHERE t.id = ? AND ${vis.sql}`, ticketId, ...vis.params));
}

type AttRow = AttachmentDto & { hopId: string | null; ticketId: string };

export async function ticketDetail(db: D1Database, u: SessionUser, id: string): Promise<TicketDetail> {
  const vis = visibility(u);
  const row = await first<RawRow>(db, `${TICKET_SELECT} WHERE t.id = ? AND ${vis.sql}`, id, ...vis.params);
  if (!row) throw notFound('That request');
  const [hops, files, events, comments] = await Promise.all([
    all<{ id: string; seq: number; committeeId: string; committeeName: string; committeeColor: string | null; committeeIcon: string | null; hasLogo: number; enteredAt: string; leftAt: string | null; forwardedByName: string | null; note: string | null }>(
      db,
      `SELECT h.id, h.seq, h.committee_id AS committeeId, c.name AS committeeName, c.color AS committeeColor, c.icon AS committeeIcon, (c.logo_key IS NOT NULL) AS hasLogo,
              h.entered_at AS enteredAt, h.left_at AS leftAt, fu.name AS forwardedByName, h.note
         FROM ticket_hops h JOIN committees c ON c.id = h.committee_id LEFT JOIN users fu ON fu.id = h.forwarded_by
        WHERE h.ticket_id = ? ORDER BY h.seq`,
      id,
    ),
    all<AttRow>(db, `SELECT id, name, size, original_size AS originalSize, mime, kind, created_at AS createdAt, hop_id AS hopId, ticket_id AS ticketId FROM attachments WHERE ticket_id = ? AND committed = 1 ORDER BY created_at`, id),
    all<TicketEventDto>(db, `SELECT e.id, e.kind, u.name AS actorName, e.message, e.created_at AS createdAt FROM ticket_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.ticket_id = ? ORDER BY e.created_at DESC LIMIT 100`, id),
    all<{ id: string; body: string; authorName: string; createdAt: string; kind: 'comment' | 'redo' }>(db, `SELECT c.id, c.body, u.name AS authorName, c.created_at AS createdAt, c.kind FROM ticket_comments c JOIN users u ON u.id = c.author_id WHERE c.ticket_id = ? ORDER BY c.created_at DESC LIMIT 50`, id),
  ]);
  const strip = ({ hopId: _h, ticketId: _t, ...a }: AttRow): AttachmentDto => a;
  const timeline: HopDto[] = hops.map((h) => ({
    seq: h.seq,
    committeeId: h.committeeId,
    committeeName: h.committeeName,
    committeeColor: h.committeeColor,
    committeeIcon: h.committeeIcon,
    hasLogo: !!h.hasLogo,
    enteredAt: h.enteredAt,
    leftAt: h.leftAt,
    forwardedByName: h.forwardedByName,
    note: h.note,
    status: h.seq === 0 ? 'origin' : h.leftAt ? 'done' : row.status,
    // the request's own files sit on the first node; hand-over files sit on the committee that produced them
    files: files.filter((f) => (h.seq === 0 ? f.kind === 'request' : f.hopId === h.id)).map(strip),
  }));
  const t = shapeRow(row, files.map(({ id, name, size, kind }) => ({ id, name, size, kind, fromCommittee: null })));
  return {
    ...t,
    timeline,
    events,
    comments,
    files: files.map(strip),
    can: ticketCan(u, { status: t.status, toCommitteeId: t.toCommitteeId, assigneeId: t.assigneeId, memberDoneAt: t.memberDoneAt }),
  };
}

/** Everything a person needs to start the work, gathered in one place for notifications and email. */
export async function ticketContext(db: D1Database, ticketId: string) {
  const row = await first<RawRow>(db, `${TICKET_SELECT} WHERE t.id = ?`, ticketId);
  if (!row) return null;
  const files = (await filesFor(db, [ticketId])).get(ticketId) ?? [];
  const t = shapeRow(row, files);
  const history = await all<{ committee: string; by: string | null; note: string | null; seq: number }>(
    db,
    `SELECT c.name AS committee, fu.name AS by, h.note, h.seq FROM ticket_hops h JOIN committees c ON c.id = h.committee_id LEFT JOIN users fu ON fu.id = h.forwarded_by
      WHERE h.ticket_id = ? AND h.left_at IS NOT NULL ORDER BY h.seq`,
    ticketId,
  );
  return { ticket: t, history };
}

/** A short plain-text version of that context for the bell notification. */
export function contextSummary(t: TicketRow): string {
  const parts: string[] = [t.title];
  if (t.details) parts.push(t.details.length > 220 ? `${t.details.slice(0, 217)}…` : t.details);
  if (t.handoff) parts.push(`From ${t.handoff.fromCommittee}${t.handoff.byName ? ` (${t.handoff.byName})` : ''}${t.handoff.note ? `: ${t.handoff.note.slice(0, 120)}` : ''}`);
  if (t.subCommittee) parts.push(`Sub-committee: ${t.subCommittee}`);
  if (t.fileList.length) parts.push(`Files: ${t.fileList.map((f) => f.name).slice(0, 4).join(', ')}${t.fileList.length > 4 ? ` +${t.fileList.length - 4}` : ''}`);
  return parts.join('\n');
}
