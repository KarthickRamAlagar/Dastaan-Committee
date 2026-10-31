import { Hono } from 'hono';
import { createMemberBody, createUserBody, updateMemberBody, updateUserBody, type Page, type UserDto } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body, pageParams } from '../lib/validate.js';
import { all, first, nowIso, run } from '../lib/db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { assertEmailAllowed } from '../lib/college-email.js';
import { toCsv } from '../lib/csv.js';
import { checkSubCommittee, createPerson, subCommitteesOf } from '../services/users.js';
import { limit } from '../lib/ratelimit.js';

export const users = new Hono<AppEnv>();
users.use(requireAuth);

const SELECT = `SELECT u.id, u.name, u.email, u.phone, u.role, u.committee_id AS committeeId, c.name AS committeeName, u.sub_committee AS subCommittee,
  u.created_at AS invitedAt, cb.name AS invitedByName
  FROM users u LEFT JOIN committees c ON c.id = u.committee_id LEFT JOIN users cb ON cb.id = u.created_by`;

function filters(q: URLSearchParams) {
  const where = ['u.deleted_at IS NULL'];
  const p: unknown[] = [];
  const text = q.get('q')?.trim();
  if (text) {
    where.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
    const like = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
    p.push(like, like);
  }
  const role = q.get('role');
  if (role && ['admin', 'convenor', 'lead', 'member'].includes(role)) (where.push('u.role = ?'), p.push(role));
  const cid = q.get('committeeId');
  if (cid) (where.push('u.committee_id = ?'), p.push(cid));
  return { where: where.join(' AND '), p };
}

/** Admin: every account, with who invited them and when. */
users.get('/', requireRole('admin'), async (c) => {
  const { page, pageSize, offset } = pageParams(c, 10);
  const f = filters(new URL(c.req.url).searchParams);
  const total = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM users u WHERE ${f.where}`, ...f.p))!.n;
  const items = await all<UserDto>(
    c.env.DB,
    `${SELECT} WHERE ${f.where} ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'convenor' THEN 1 WHEN 'lead' THEN 2 ELSE 3 END, c.name, u.name LIMIT ? OFFSET ?`,
    ...f.p, pageSize, offset,
  );
  const out: Page<UserDto> = { items, total, page, pageSize };
  return c.json({ data: out });
});

users.get('/export.csv', requireRole('admin'), async (c) => {
  const rows = await all<UserDto>(c.env.DB, `${SELECT} WHERE u.deleted_at IS NULL ORDER BY c.name, u.role, u.name LIMIT 20000`);
  await audit(c.env.DB, c.get('user'), 'user.export', 'user', undefined, { count: rows.length }, c.get('ip'));
  const csv = toCsv(rows as unknown as Record<string, unknown>[], [
    { key: 'name', title: 'Name' }, { key: 'email', title: 'Email' }, { key: 'phone', title: 'Phone' },
    { key: 'role', title: 'Designation' }, { key: 'committeeName', title: 'Committee' },
    { key: 'invitedAt', title: 'Invited at' }, { key: 'invitedByName', title: 'Invited by' },
  ]);
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="dastaan-users-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
  });
});

/** Admin creates a Convenor, a Committee Lead or another Admin. */
users.post('/', requireRole('admin'), async (c) => {
  const b = await body(c, createUserBody);
  const actor = c.get('user');
  await limit(c.env.DB, `create-user:${actor.id}`, 60, 3600);
  const r = await createPerson(c.env, actor, { name: b.name, email: b.email, phone: b.phone, role: b.designation, committeeId: b.designation === 'lead' ? (b.committeeId ?? null) : null }, c.get('ip'));
  return c.json({ data: r }, 201);
});

/** A Committee Lead adds a member to their own committee only. The committee comes from the session, never from the request. */
users.post('/members', requireRole('lead'), async (c) => {
  const b = await body(c, createMemberBody);
  const actor = c.get('user');
  await limit(c.env.DB, `create-user:${actor.id}`, 60, 3600);
  const sub = await checkSubCommittee(c.env.DB, actor.committeeId, b.subCommittee);
  const r = await createPerson(c.env, actor, { name: b.name, email: b.email, phone: b.phone, role: 'member', committeeId: actor.committeeId, subCommittee: sub }, c.get('ip'));
  return c.json({ data: r }, 201);
});

/** A Lead's grid of their own committee's members. */
users.get('/members', requireRole('lead'), async (c) => {
  const me = c.get('user');
  const { page, pageSize, offset } = pageParams(c, 7);
  const f = filters(new URL(c.req.url).searchParams);
  const where = `${f.where} AND u.role = 'member' AND u.committee_id = ?`;
  const total = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM users u WHERE ${where}`, ...f.p, me.committeeId))!.n;
  const items = await all<UserDto>(c.env.DB, `${SELECT} WHERE ${where} ORDER BY u.sub_committee, u.name LIMIT ? OFFSET ?`, ...f.p, me.committeeId, pageSize, offset);
  const out: Page<UserDto> = { items, total, page, pageSize };
  return c.json({ data: out });
});

/** The sub-committees of the Lead's committee (from the final list). Empty means the committee has none defined and any text is accepted. */
users.get('/sub-committees', requireRole('lead'), async (c) => c.json({ data: await subCommitteesOf(c.env.DB, c.get('user').committeeId) }));

async function ownMember(c: import('hono').Context<AppEnv>) {
  const me = c.get('user');
  const m = await first<{ id: string; email: string; name: string }>(c.env.DB, "SELECT id, email, name FROM users WHERE id = ? AND role = 'member' AND committee_id = ? AND deleted_at IS NULL", c.req.param('id'), me.committeeId);
  if (!m) throw notFound('That member');
  return m;
}

/** A Lead edits a member of their own committee. This replaces members writing to the Admin. */
users.patch('/members/:id', requireRole('lead'), async (c) => {
  const m = await ownMember(c);
  const b = await body(c, updateMemberBody);
  if (b.email) assertEmailAllowed(c.env, b.email);
  if (b.subCommittee) b.subCommittee = await checkSubCommittee(c.env.DB, c.get('user').committeeId, b.subCommittee);
  try {
    await run(c.env.DB, 'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), sub_committee = COALESCE(?, sub_committee) WHERE id = ?', b.name ?? null, b.email ?? null, b.phone ?? null, b.subCommittee ?? null, m.id);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw conflict('That email is already registered', 'EMAIL_TAKEN');
    throw e;
  }
  if (b.email && b.email.toLowerCase() !== m.email.toLowerCase()) await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', m.id);
  await audit(c.env.DB, c.get('user'), 'member.update', 'user', m.id, { ...b }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

/** A Lead removes a member of their own committee. History stays; open work goes back to the Lead's queue. */
users.delete('/members/:id', requireRole('lead'), async (c) => {
  const me = c.get('user');
  const m = await ownMember(c);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET deleted_at = ?, email = ? WHERE id = ?').bind(nowIso(), `${m.id}.removed@invalid.local`, m.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(m.id),
    c.env.DB.prepare("UPDATE tickets SET assignee_id = NULL, member_done_at = NULL WHERE assignee_id = ? AND status != 'done'").bind(m.id),
  ]);
  await audit(c.env.DB, me, 'member.delete', 'user', m.id, { email: m.email }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

/** A Lead sees their committee's people; a Convenor sees everybody. Used for assignment and mail pickers. */
users.get('/directory', requireRole('convenor', 'lead', 'member'), async (c) => {
  const u = c.get('user');
  const cid = u.role === 'convenor' ? c.req.query('committeeId') : u.committeeId;
  const rows = await all<{ id: string; name: string; role: string; committeeId: string | null; committeeName: string | null; email: string; subCommittee: string | null }>(
    c.env.DB,
    `SELECT u.id, u.name, u.role, u.committee_id AS committeeId, c.name AS committeeName, u.email, u.sub_committee AS subCommittee
       FROM users u LEFT JOIN committees c ON c.id = u.committee_id
      WHERE u.deleted_at IS NULL AND u.role IN ('lead','member') ${cid ? 'AND u.committee_id = ?' : ''}
      ORDER BY c.name, CASE u.role WHEN 'lead' THEN 0 ELSE 1 END, u.name LIMIT 2000`,
    ...(cid ? [cid] : []),
  );
  // Members only need names to address a request; contact details stay with Convenor and Leads.
  const items = rows.map((r) => (u.role === 'member' ? { ...r, email: '' } : r));
  return c.json({ data: items });
});

users.patch('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const b = await body(c, updateUserBody);
  if (b.email) assertEmailAllowed(c.env, b.email);
  const target = await first<{ id: string; role: string; source: string; email: string; committee_id: string | null }>(c.env.DB, 'SELECT id, role, source, email, committee_id FROM users WHERE id = ? AND deleted_at IS NULL', id);
  if (!target) throw notFound('That person');
  if (target.source === 'env') throw forbidden('This admin is managed in the ADMIN_EMAILS setting');
  if (target.role === 'member') throw forbidden('Committee Members are managed by their Committee Lead. Ask the Lead to change their details.');
  if (b.committeeId) throw conflict('A Lead belongs to the committee they lead. Create a new Lead for another committee.');
  try {
    await run(
      c.env.DB,
      `UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone), committee_id = COALESCE(?, committee_id) WHERE id = ?`,
      b.name ?? null, b.email ?? null, b.phone ?? null, b.committeeId ?? null, id,
    );
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw conflict('That email is already registered', 'EMAIL_TAKEN');
    throw e;
  }
  if (b.email && b.email !== target.email) await run(c.env.DB, 'DELETE FROM sessions WHERE user_id = ?', id);
  await audit(c.env.DB, c.get('user'), 'user.update', 'user', id, { ...b }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

users.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const me = c.get('user');
  if (id === me.id) throw conflict('You cannot remove your own account');
  const target = await first<{ id: string; email: string; role: string; source: string }>(c.env.DB, 'SELECT id, email, role, source FROM users WHERE id = ? AND deleted_at IS NULL', id);
  if (!target) throw notFound('That person');
  if (target.source === 'env') throw forbidden('This admin is managed in the ADMIN_EMAILS setting');
  if (target.role === 'member') throw forbidden('Committee Members are managed by their Committee Lead.');
  if (target.role === 'convenor') {
    const n = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM users WHERE role = 'convenor' AND deleted_at IS NULL"))!.n;
    if (n <= 1) throw conflict('At least one Convenor must remain');
  }
  // The account is kept for history. The email is freed so it can be used again.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET deleted_at = ?, email = ? WHERE id = ?').bind(nowIso(), `${id}.removed@invalid.local`, id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    c.env.DB.prepare('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = ? AND status != ?').bind(id, 'done'),
  ]);
  await audit(c.env.DB, me, 'user.delete', 'user', id, { email: target.email, role: target.role }, c.get('ip'));
  return c.json({ data: { ok: true } });
});
