import { Hono } from 'hono';
import { supportBody, supportUpdateBody, type SupportDto } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body, pageParams } from '../lib/validate.js';
import { all, first, newId, nowIso, run } from '../lib/db.js';
import { conflict, notFound } from '../lib/errors.js';
import { leadOf, notify } from '../services/notify.js';
import { limit } from '../lib/ratelimit.js';

export const support = new Hono<AppEnv>();
support.use(requireAuth);

/** Convenors and Leads ask the Admin to fix or remove their details. A member writes to their own Committee Lead instead. */
support.post('/', requireRole('convenor', 'lead', 'member'), async (c) => {
  const me = c.get('user');
  const b = await body(c, supportBody);
  await limit(c.env.DB, `support:${me.id}`, 10, 3600);
  const id = newId();
  const toUser = me.role === 'member' && me.committeeId ? await leadOf(c.env.DB, me.committeeId) : null;
  if (me.role === 'member' && !toUser) throw conflict('Your committee has no Committee Lead yet. Ask the Convenor.');
  await run(c.env.DB, 'INSERT INTO support_requests (id, user_id, to_user_id, subject, body, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', id, me.id, toUser, b.subject, b.body, nowIso(), nowIso());
  if (toUser) await notify(c.env.DB, [toUser], { title: `${me.name} asked for a change`, body: b.subject, byId: me.id, link: '/team' });
  return c.json({ data: { id } }, 201);
});

support.get('/mine', requireRole('convenor', 'lead', 'member'), async (c) => {
  const rows = await all<SupportDto>(c.env.DB, `SELECT s.id, s.subject, s.body, s.status, u.name AS fromName, u.email AS fromEmail, c.name AS committeeName, s.created_at AS createdAt FROM support_requests s JOIN users u ON u.id = s.user_id LEFT JOIN committees c ON c.id = u.committee_id WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 50`, c.get('user').id);
  return c.json({ data: rows });
});

support.get('/', requireRole('admin'), async (c) => {
  const { page, pageSize, offset } = pageParams(c, 10);
  const status = c.req.query('status');
  const where = status === 'open' || status === 'done' ? 'WHERE s.to_user_id IS NULL AND s.status = ?' : 'WHERE s.to_user_id IS NULL';
  const p = status === 'open' || status === 'done' ? [status] : [];
  const total = (await first<{ n: number }>(c.env.DB, `SELECT COUNT(*) AS n FROM support_requests s ${where}`, ...p))!.n;
  const items = await all<SupportDto>(c.env.DB, `SELECT s.id, s.subject, s.body, s.status, u.name AS fromName, u.email AS fromEmail, c.name AS committeeName, s.created_at AS createdAt FROM support_requests s JOIN users u ON u.id = s.user_id LEFT JOIN committees c ON c.id = u.committee_id ${where} ORDER BY s.status = 'done', s.created_at DESC LIMIT ? OFFSET ?`, ...p, pageSize, offset);
  const open = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM support_requests WHERE to_user_id IS NULL AND status = 'open'"))!.n;
  return c.json({ data: { items, total, page, pageSize, open } });
});

support.patch('/:id', requireRole('admin', 'lead'), async (c) => {
  const b = await body(c, supportUpdateBody);
  const me = c.get('user');
  const mine = me.role === 'admin' ? 'to_user_id IS NULL' : 'to_user_id = ?';
  const r = await run(c.env.DB, `UPDATE support_requests SET status = ?, updated_at = ? WHERE id = ? AND ${mine}`, b.status, nowIso(), c.req.param('id'), ...(me.role === 'admin' ? [] : [me.id]));
  if (!r.meta.changes) throw notFound('That request');
  return c.json({ data: { ok: true } });
});

/** A Lead's inbox: change requests written by members of their committee. */
support.get('/inbox', requireRole('lead'), async (c) => {
  const me = c.get('user');
  const { page, pageSize, offset } = pageParams(c, 7);
  const total = (await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM support_requests WHERE to_user_id = ?', me.id))!.n;
  const items = await all<SupportDto>(c.env.DB, `SELECT s.id, s.subject, s.body, s.status, u.name AS fromName, u.email AS fromEmail, c.name AS committeeName, s.created_at AS createdAt FROM support_requests s JOIN users u ON u.id = s.user_id LEFT JOIN committees c ON c.id = u.committee_id WHERE s.to_user_id = ? ORDER BY s.status = 'done', s.created_at DESC LIMIT ? OFFSET ?`, me.id, pageSize, offset);
  const open = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM support_requests WHERE to_user_id = ? AND status = 'open'", me.id))!.n;
  return c.json({ data: { items, total, page, pageSize, open } });
});
