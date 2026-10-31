import { Hono } from 'hono';
import { assignBody, commentBody, createTicketBody, forwardBody, redoBody, statusBody, STATUS_LABEL, PRIORITY_LABEL } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body, pageParams } from '../lib/validate.js';
import { first, newId, nowIso } from '../lib/db.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { limit } from '../lib/ratelimit.js';
import { NEXT_STATUS, ticketCan } from '../services/access.js';
import { canSee, contextSummary, eventStmt, listTickets, loadStats, ticketContext, ticketDetail } from '../services/tickets.js';
import { convenorIds, leadsOf, notify } from '../services/notify.js';
import { checkSubCommittee } from '../services/users.js';

export const tickets = new Hono<AppEnv>();
tickets.use(requireAuth);
tickets.use(requireRole('convenor', 'lead', 'member'));

tickets.get('/', async (c) => {
  const u = c.get('user');
  const q = new URL(c.req.url).searchParams;
  const { page, pageSize } = pageParams(c, 7);
  const scope = (['all', 'inbox', 'sent'] as const).find((s) => s === q.get('scope')) ?? 'all';
  const out = await listTickets(c.env.DB, u, {
    scope,
    status: q.get('status') ?? undefined,
    priority: q.get('priority') ?? undefined,
    committeeId: q.get('committeeId') ?? undefined,
    q: q.get('q') ?? undefined,
    forwarded: q.get('forwarded') === 'true',
    sort: q.get('sort') ?? (u.role === 'convenor' ? 'newest' : 'queue'),
    page,
    pageSize,
  });
  return c.json({ data: out });
});

tickets.get('/stats', async (c) => c.json({ data: await loadStats(c.env.DB, c.get('user'), c.req.query('committeeId')) }));

/** Raise a request. Only Committee Leads raise requests; Convenors oversee them and members do the work. */
tickets.post('/', requireRole('lead'), async (c) => {
  const me = c.get('user');
  const b = await body(c, createTicketBody);
  const db = c.env.DB;
  await limit(db, `ticket:${me.id}`, 40, 3600, 'You have sent a lot of requests in the last hour. Please wait a little.');
  if (b.toCommitteeId === me.committeeId) throw new HttpError(422, 'VALIDATION', 'Choose another committee. Requests go to a different committee.', { toCommitteeId: 'Choose another committee' });
  const to = await first<{ name: string }>(db, 'SELECT name FROM committees WHERE id = ? AND archived_at IS NULL', b.toCommitteeId);
  if (!to) throw notFound('That committee');
  if (b.assigneeId) {
    const a = await first(db, 'SELECT 1 AS x FROM users WHERE id = ? AND committee_id = ? AND deleted_at IS NULL', b.assigneeId, b.toCommitteeId);
    if (!a) throw new HttpError(422, 'VALIDATION', 'That person is not in the chosen committee', { assigneeId: 'Not in this committee' });
  }
  if (new Date(b.neededBy).getTime() < Date.now() - 5 * 60_000) throw new HttpError(422, 'VALIDATION', 'Pick a date and time in the future', { neededBy: 'Pick a future time' });

  const ids = b.attachmentIds;
  if (ids.length) {
    const ok = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM attachments WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'request' AND committed = 0`, JSON.stringify(ids), me.id))!.n;
    if (ok !== new Set(ids).size) throw new HttpError(422, 'VALIDATION', 'One of the files is missing. Upload it again.', { attachmentIds: 'File not found' });
  }
  const id = newId();
  const now = nowIso();
  const hop0 = newId();
  const hop1 = newId();
  await db.batch([
    db.prepare(`INSERT INTO tickets (id, title, details, requester_id, from_committee_id, to_committee_id, assignee_id, priority, status, needed_by, hop_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?, 'pending', ?, 2, ?, ?)`).bind(id, b.title, b.details ?? null, me.id, me.committeeId, b.toCommitteeId, b.assigneeId ?? null, b.priority, b.neededBy, now, now),
    db.prepare('INSERT INTO ticket_hops (id, ticket_id, seq, committee_id, entered_at, left_at) VALUES (?,?,?,?,?,?)').bind(hop0, id, 0, me.committeeId, now, now),
    db.prepare('INSERT INTO ticket_hops (id, ticket_id, seq, committee_id, entered_at) VALUES (?,?,?,?,?)').bind(hop1, id, 1, b.toCommitteeId, now),
    db.prepare(`UPDATE attachments SET ticket_id = ?, committed = 1 WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'request'`).bind(id, JSON.stringify(ids), me.id),
    eventStmt(db, id, me.id, 'created', `${me.name} (${me.committeeName}) sent this to ${to.name} with ${PRIORITY_LABEL[b.priority]} priority`),
  ]);
  const leads = await leadsOf(db, b.toCommitteeId);
  await notify(db, leads, { title: 'New request for your committee', body: `${b.title} (${PRIORITY_LABEL[b.priority]} priority) from ${me.name}, ${me.committeeName}`, byId: me.id, link: `/tickets/${id}` });
  if (b.assigneeId) await notify(db, [b.assigneeId], { title: 'A request was sent to you', body: `${b.title} from ${me.name}, ${me.committeeName}`, byId: me.id, link: `/tickets/${id}` });
  await audit(db, me, 'ticket.create', 'ticket', id, { to: b.toCommitteeId, priority: b.priority }, c.get('ip'));
  return c.json({ data: { id } }, 201);
});

tickets.get('/:id', async (c) => c.json({ data: await ticketDetail(c.env.DB, c.get('user'), c.req.param('id')) }));

interface Facts { id: string; title: string; status: 'pending' | 'in_progress' | 'done'; to_committee_id: string; assignee_id: string | null; requester_id: string; hop_count: number; priority: string; member_done_at: string | null }
async function load(c: import('hono').Context<AppEnv>): Promise<Facts> {
  const id = c.req.param('id')!;
  const me = c.get('user');
  if (!(await canSee(c.env.DB, me, id))) throw notFound('That request');
  return (await first<Facts>(c.env.DB, 'SELECT id, title, status, to_committee_id, assignee_id, requester_id, hop_count, priority, member_done_at FROM tickets WHERE id = ?', id))!;
}
const facts = (t: Facts) => ({ status: t.status, toCommitteeId: t.to_committee_id, assigneeId: t.assignee_id, memberDoneAt: t.member_done_at });

/** Pending → In progress → Done, by the Lead of the committee that holds the request. Nobody else, ever. */
tickets.post('/:id/status', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  const b = await body(c, statusBody);
  if (!ticketCan(me, facts(t)).changeStatus) throw forbidden('Only the Committee Lead of the committee holding this request can change its status');
  if (NEXT_STATUS[t.status] !== b.status) throw conflict(`A ${STATUS_LABEL[t.status].toLowerCase()} request moves to ${NEXT_STATUS[t.status] ? STATUS_LABEL[NEXT_STATUS[t.status]!].toLowerCase() : 'nothing'} next`, 'BAD_TRANSITION');
  const db = c.env.DB;
  const r = await db.prepare(`UPDATE tickets SET status = ?, redo_pending = CASE WHEN ? = 'done' THEN 0 ELSE redo_pending END, updated_at = ? WHERE id = ? AND status = ?`).bind(b.status, b.status, nowIso(), t.id, t.status).run();
  if (!r.meta.changes) throw conflict('This request was just changed by someone else. Refresh and try again.', 'STALE');
  await eventStmt(db, t.id, me.id, 'status', `${me.name} moved it to ${STATUS_LABEL[b.status]}`).run();
  await notify(db, [t.requester_id, t.assignee_id], { title: `Request is now ${STATUS_LABEL[b.status]}`, body: t.title, byId: me.id, link: `/tickets/${t.id}` });
  if (b.status === 'done') await notify(db, await convenorIds(db), { title: 'Work finished, ready for your comment', body: t.title, byId: me.id, link: `/tickets/${t.id}` });
  await audit(db, me, 'ticket.status', 'ticket', t.id, { to: b.status }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

tickets.post('/:id/assign', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  const b = await body(c, assignBody);
  if (!ticketCan(me, facts(t)).assign) throw forbidden('Only the Committee Lead of the committee holding this request can assign it');
  const person = await first<{ name: string; sub_committee: string | null }>(c.env.DB, 'SELECT name, sub_committee FROM users WHERE id = ? AND committee_id = ? AND deleted_at IS NULL', b.assigneeId, t.to_committee_id);
  if (!person) throw new HttpError(422, 'VALIDATION', 'Pick someone from your committee', { assigneeId: 'Not in your committee' });
  const wanted = b.subCommittee ?? person.sub_committee;
  if (!wanted) throw new HttpError(422, 'VALIDATION', 'Choose the sub-committee this work is for', { subCommittee: 'Choose a sub-committee' });
  const sub = await checkSubCommittee(c.env.DB, t.to_committee_id, wanted);
  await c.env.DB.prepare('UPDATE tickets SET assignee_id = ?, sub_committee = ?, member_done_at = NULL, updated_at = ? WHERE id = ?').bind(b.assigneeId, sub, nowIso(), t.id).run();
  await eventStmt(c.env.DB, t.id, me.id, 'assign', `${me.name} assigned it to ${person.name} (${sub})`).run();
  const ctx = await ticketContext(c.env.DB, t.id);
  await notify(c.env.DB, [b.assigneeId], { title: 'A request was assigned to you', body: ctx ? contextSummary(ctx.ticket) : t.title, byId: me.id, link: `/tickets/${t.id}` });
  // The full requirement, the committee-to-committee notes and every file travel with it, as links that work for 14 days.
  await c.env.MAIL_QUEUE.send({ type: 'ticket-context', userId: b.assigneeId, ticketId: t.id, reason: 'assigned', byName: me.name });
  return c.json({ data: { ok: true } });
});

/** The assigned member tells their Lead the work is finished. Only the Lead can then mark it Done. */
tickets.post('/:id/work-done', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  if (!ticketCan(me, facts(t)).workDone) throw forbidden(t.assignee_id === me.id ? 'You have already told your Lead, or this request is already Done' : 'Only the member this work is assigned to can say it is finished');
  const db = c.env.DB;
  const r = await db.prepare('UPDATE tickets SET member_done_at = ?, updated_at = ? WHERE id = ? AND assignee_id = ? AND member_done_at IS NULL AND status != ?').bind(nowIso(), nowIso(), t.id, me.id, 'done').run();
  if (!r.meta.changes) throw conflict('This request was just changed. Refresh and try again.', 'STALE');
  await eventStmt(db, t.id, me.id, 'work-done', `${me.name} says the work is finished and told the Committee Lead`).run();
  await notify(db, await leadsOf(db, t.to_committee_id), { title: `${me.name} finished the work`, body: `${t.title}. Check it and mark it Done.`, byId: me.id, link: `/tickets/${t.id}` });
  await audit(db, me, 'ticket.work-done', 'ticket', t.id, undefined, c.get('ip'));
  return c.json({ data: { ok: true } });
});

/** Hand the finished work to the next committee. The same request moves on; its history and files go with it. */
tickets.post('/:id/forward', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  const b = await body(c, forwardBody);
  if (!ticketCan(me, facts(t)).forward) throw forbidden(t.status === 'done' ? 'Only the Committee Lead of the committee holding this request can forward it' : 'Finish the work (status Done) before forwarding it to the next committee');
  if (b.toCommitteeId === t.to_committee_id) throw new HttpError(422, 'VALIDATION', 'Choose a different committee', { toCommitteeId: 'Choose a different committee' });
  const db = c.env.DB;
  const next = await first<{ name: string }>(db, 'SELECT name FROM committees WHERE id = ? AND archived_at IS NULL', b.toCommitteeId);
  if (!next) throw notFound('That committee');
  const ok = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM attachments WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'handoff' AND committed = 0`, JSON.stringify(b.attachmentIds), me.id))!.n;
  if (ok !== new Set(b.attachmentIds).size) throw new HttpError(422, 'VALIDATION', 'One of the files is missing. Upload it again.', { attachmentIds: 'File not found' });

  const now = nowIso();
  // Guarded move: only one forward can win if two clicks race.
  const moved = await db.prepare(`UPDATE tickets SET to_committee_id = ?, status = 'pending', assignee_id = NULL, sub_committee = NULL, member_done_at = NULL, redo_pending = 0, hop_count = hop_count + 1, updated_at = ? WHERE id = ? AND status = 'done' AND to_committee_id = ? AND hop_count = ?`).bind(b.toCommitteeId, now, t.id, t.to_committee_id, t.hop_count).run();
  if (!moved.meta.changes) throw conflict('This request was just changed. Refresh and try again.', 'STALE');
  const cur = await first<{ id: string }>(db, 'SELECT id FROM ticket_hops WHERE ticket_id = ? AND seq = ?', t.id, t.hop_count - 1);
  await db.batch([
    db.prepare('UPDATE ticket_hops SET left_at = ?, forwarded_by = ?, note = ? WHERE id = ?').bind(now, me.id, b.note ?? null, cur!.id),
    db.prepare('INSERT INTO ticket_hops (id, ticket_id, seq, committee_id, entered_at) VALUES (?,?,?,?,?)').bind(newId(), t.id, t.hop_count, b.toCommitteeId, now),
    db.prepare(`UPDATE attachments SET ticket_id = ?, hop_id = ?, committed = 1 WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'handoff'`).bind(t.id, cur!.id, JSON.stringify(b.attachmentIds), me.id),
    eventStmt(db, t.id, me.id, 'forward', `${me.name} forwarded it from ${me.committeeName} to ${next.name} with ${b.attachmentIds.length} file${b.attachmentIds.length === 1 ? '' : 's'}`),
  ]);
  const nextLeads = await leadsOf(db, b.toCommitteeId);
  const fctx = await ticketContext(db, t.id);
  await notify(db, nextLeads, { title: 'Work was forwarded to your committee', body: fctx ? contextSummary(fctx.ticket) : `${t.title}, from ${me.committeeName}`, byId: me.id, link: `/tickets/${t.id}` });
  for (const l of nextLeads) await c.env.MAIL_QUEUE.send({ type: 'ticket-context', userId: l, ticketId: t.id, reason: 'forwarded', byName: me.name });
  await notify(db, [...(await convenorIds(db)), t.requester_id], { title: `Request moved to ${next.name}`, body: `${t.title}. ${me.committeeName} finished their part.`, byId: me.id, link: `/tickets/${t.id}` });
  await audit(db, me, 'ticket.forward', 'ticket', t.id, { from: t.to_committee_id, to: b.toCommitteeId }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

/** Send it back: top of the queue, highest priority. */
tickets.post('/:id/redo', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  const b = await body(c, redoBody);
  if (!ticketCan(me, facts(t)).redo) throw forbidden('You cannot ask for a redo on this request right now');
  const db = c.env.DB;
  const r = await db.prepare(`UPDATE tickets SET status = 'pending', priority = 'high', redo_pending = 1, member_done_at = NULL, updated_at = ? WHERE id = ? AND status = ?`).bind(nowIso(), t.id, t.status).run();
  if (!r.meta.changes) throw conflict('This request was just changed. Refresh and try again.', 'STALE');
  await db.batch([
    db.prepare(`INSERT INTO ticket_comments (id, ticket_id, author_id, kind, body, created_at) VALUES (?,?,?, 'redo', ?, ?)`).bind(newId(), t.id, me.id, b.reason, nowIso()),
    eventStmt(db, t.id, me.id, 'redo', `${me.name} asked for a redo. It is back at the top with High priority`),
  ]);
  const leads = await leadsOf(db, t.to_committee_id);
  await notify(db, [...leads, t.assignee_id], { title: 'Redo requested', body: `${t.title}: ${b.reason}`, byId: me.id, link: `/tickets/${t.id}` });
  await audit(db, me, 'ticket.redo', 'ticket', t.id, undefined, c.get('ip'));
  return c.json({ data: { ok: true } });
});

/** Convenor comment. Only allowed once the work is Done; before that the app explains why. */
tickets.post('/:id/comments', async (c) => {
  const me = c.get('user');
  const t = await load(c);
  const b = await body(c, commentBody);
  if (!ticketCan(me, facts(t)).comment) throw forbidden('Only the Convenor can comment on requests');
  if (t.status !== 'done') throw new HttpError(409, 'NOT_DONE', 'As of now you are not allowed to take action on this request because it is not Done yet.');
  const db = c.env.DB;
  await db.batch([
    db.prepare(`INSERT INTO ticket_comments (id, ticket_id, author_id, kind, body, created_at) VALUES (?,?,?, 'comment', ?, ?)`).bind(newId(), t.id, me.id, b.body, nowIso()),
    eventStmt(db, t.id, me.id, 'comment', `${me.name} commented`),
  ]);
  await notify(db, [t.requester_id, t.assignee_id, ...(await leadsOf(db, t.to_committee_id))], { title: 'The Convenor commented on a request', body: `${t.title}: ${b.body}`, byId: me.id, link: `/tickets/${t.id}` });
  return c.json({ data: { ok: true } }, 201);
});
