import { Hono } from 'hono';
import { grantDecisionBody, grantRequestBody, type GrantDto } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body } from '../lib/validate.js';
import { addMinutes, all, first, newId, nowIso, run } from '../lib/db.js';
import { conflict, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { convenorIds, notify } from '../services/notify.js';

export const grants = new Hono<AppEnv>();
grants.use(requireAuth);

type Row = Omit<GrantDto, 'status'> & { status: string };
const SELECT = `SELECT g.id, g.action, g.committee_id AS committeeId, c.name AS committeeName, g.note, g.status,
  rb.name AS requestedByName, db.name AS decidedByName, g.created_at AS createdAt, g.decided_at AS decidedAt, g.expires_at AS expiresAt
  FROM committee_grants g LEFT JOIN committees c ON c.id = g.committee_id
  JOIN users rb ON rb.id = g.requested_by LEFT JOIN users db ON db.id = g.decided_by`;

const shape = (r: Row): GrantDto => ({
  ...r,
  status: (r.status === 'approved' && r.expiresAt && r.expiresAt < nowIso() ? 'expired' : r.status) as GrantDto['status'],
});

/** Admin: own requests. Convenor: everything, newest first. */
grants.get('/', requireRole('admin', 'convenor'), async (c) => {
  const u = c.get('user');
  const rows = await all<Row>(c.env.DB, `${SELECT} ${u.role === 'admin' ? 'WHERE g.requested_by = ?' : ''} ORDER BY g.created_at DESC LIMIT 100`, ...(u.role === 'admin' ? [u.id] : []));
  return c.json({ data: rows.map(shape) });
});

grants.post('/', requireRole('admin'), async (c) => {
  const b = await body(c, grantRequestBody);
  const me = c.get('user');
  if (b.action !== 'create' && !b.committeeId) throw conflict('Choose which committee this is for');
  let name = 'a new committee';
  if (b.committeeId) {
    const cm = await first<{ name: string }>(c.env.DB, 'SELECT name FROM committees WHERE id = ? AND archived_at IS NULL', b.committeeId);
    if (!cm) throw notFound('That committee');
    name = cm.name;
  }
  const open = await first(c.env.DB, `SELECT 1 AS x FROM committee_grants WHERE requested_by = ? AND action = ? AND COALESCE(committee_id,'') = ? AND (status = 'pending' OR (status = 'approved' AND expires_at > ?))`, me.id, b.action, b.committeeId ?? '', nowIso());
  if (open) throw conflict('You already have an open request for this', 'GRANT_OPEN');
  const id = newId();
  await run(c.env.DB, 'INSERT INTO committee_grants (id, action, committee_id, note, requested_by, created_at) VALUES (?,?,?,?,?,?)', id, b.action, b.committeeId ?? null, b.note ?? null, me.id, nowIso());
  await notify(c.env.DB, await convenorIds(c.env.DB), {
    title: 'Admin needs your permission',
    body: `${me.name} wants to ${b.action} ${name}.${b.note ? ` Note: ${b.note}` : ''}`,
    byId: me.id,
    link: '/convenor/permissions',
  });
  await audit(c.env.DB, me, 'grant.request', 'grant', id, { ...b }, c.get('ip'));
  return c.json({ data: { id } }, 201);
});

grants.post('/:id/decision', requireRole('convenor'), async (c) => {
  const id = c.req.param('id');
  const b = await body(c, grantDecisionBody);
  const me = c.get('user');
  const g = await first<{ requested_by: string; action: string }>(c.env.DB, 'SELECT requested_by, action FROM committee_grants WHERE id = ?', id);
  if (!g) throw notFound('That request');
  const r = await run(
    c.env.DB,
    `UPDATE committee_grants SET status = ?, decided_by = ?, decided_at = ?, expires_at = ?, note = COALESCE(note, ?) WHERE id = ? AND status = 'pending'`,
    b.approve ? 'approved' : 'rejected', me.id, nowIso(), b.approve ? addMinutes(24 * 60) : null, null, id,
  );
  if (!r.meta.changes) throw conflict('This request was already decided');
  await notify(c.env.DB, [g.requested_by], {
    title: b.approve ? 'Permission granted' : 'Permission declined',
    body: b.approve ? `${me.name} approved your request to ${g.action} a committee. It works for 24 hours, once.` : `${me.name} declined your request.${b.note ? ` ${b.note}` : ''}`,
    byId: me.id,
    link: '/admin/committees',
  });
  await audit(c.env.DB, me, b.approve ? 'grant.approve' : 'grant.reject', 'grant', id, undefined, c.get('ip'));
  return c.json({ data: { ok: true } });
});
