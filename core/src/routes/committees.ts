import { Hono } from 'hono';
import { committeeBody, committeeUpdateBody, type CommitteeDto } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body } from '../lib/validate.js';
import { all, first, newId, nowIso, run } from '../lib/db.js';
import { conflict, forbidden, notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { consumeGrant } from '../services/grants.js';

export const committees = new Hono<AppEnv>();

/** Public so the sign-in page and emails can show logos. Logos hold nothing private. */
committees.get('/:id/logo', async (c) => {
  const row = await first<{ logo_key: string | null }>(c.env.DB, 'SELECT logo_key FROM committees WHERE id = ?', c.req.param('id'));
  if (!row?.logo_key) return c.body(null, 404);
  const obj = await c.env.FILES.get(row.logo_key);
  if (!obj) return c.body(null, 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType ?? 'image/png', 'Cache-Control': 'public, max-age=3600', 'Content-Security-Policy': "default-src 'none'; sandbox", 'X-Content-Type-Options': 'nosniff' },
  });
});

committees.use(requireAuth);

const LIST = `SELECT c.id, c.name, c.description, c.color, c.icon, (c.logo_key IS NOT NULL) AS hasLogo, (c.archived_at IS NOT NULL) AS archived,
  (SELECT COUNT(*) FROM users u WHERE u.committee_id = c.id AND u.deleted_at IS NULL) AS memberCount,
  (SELECT group_concat(u.name, ', ') FROM users u WHERE u.committee_id = c.id AND u.role = 'lead' AND u.deleted_at IS NULL) AS leadName,
  (SELECT COUNT(*) FROM users u WHERE u.committee_id = c.id AND u.role = 'lead' AND u.deleted_at IS NULL) AS leadCount
  FROM committees c`;

type Row = Omit<CommitteeDto, 'hasLogo' | 'archived'> & { hasLogo: number; archived: number };
const shape = (r: Row): CommitteeDto => ({ ...r, hasLogo: !!r.hasLogo, archived: !!r.archived });

committees.get('/', async (c) => {
  const u = c.get('user');
  const withArchived = u.role === 'admin' && c.req.query('includeArchived') === 'true';
  const rows = await all<Row>(c.env.DB, `${LIST} ${withArchived ? '' : 'WHERE c.archived_at IS NULL'} ORDER BY c.sort_order, c.name`);
  return c.json({ data: rows.map(shape) });
});

async function applyLogo(c: import('hono').Context<AppEnv>, committeeId: string, attachmentId: string | undefined) {
  if (!attachmentId) return;
  const a = await first<{ r2_key: string; mime: string }>(c.env.DB, "SELECT r2_key, mime FROM attachments WHERE id = ? AND kind = 'logo' AND uploader_id = ? AND committed = 0", attachmentId, c.get('user').id);
  if (!a) throw notFound('That logo upload');
  const old = await first<{ logo_key: string | null }>(c.env.DB, 'SELECT logo_key FROM committees WHERE id = ?', committeeId);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE committees SET logo_key = ? WHERE id = ?').bind(a.r2_key, committeeId),
    c.env.DB.prepare('UPDATE attachments SET committed = 1 WHERE id = ?').bind(attachmentId),
  ]);
  if (old?.logo_key && old.logo_key !== a.r2_key) c.executionCtx.waitUntil(c.env.FILES.delete(old.logo_key));
}

/** Names only, so a request can be addressed to a person in another committee. */
committees.get('/:id/people', requireRole('convenor', 'lead', 'member'), async (c) => {
  const rows = await all<{ id: string; name: string; role: string }>(c.env.DB, "SELECT id, name, role FROM users WHERE committee_id = ? AND deleted_at IS NULL ORDER BY CASE role WHEN 'lead' THEN 0 ELSE 1 END, name", c.req.param('id'));
  return c.json({ data: rows });
});

committees.post('/', requireRole('admin'), async (c) => {
  const b = await body(c, committeeBody);
  const me = c.get('user');
  const dup = await first(c.env.DB, 'SELECT 1 AS x FROM committees WHERE name = ?', b.name);
  if (dup) throw conflict('A committee with this name already exists', 'NAME_TAKEN');
  await consumeGrant(c.env.DB, b.grantId, me.id, 'create', null);
  const id = newId();
  const order = (await first<{ n: number }>(c.env.DB, 'SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM committees'))!.n;
  await run(c.env.DB, 'INSERT INTO committees (id, name, description, color, icon, sort_order, created_at) VALUES (?,?,?,?,?,?,?)', id, b.name, b.description ?? null, b.color ?? '#f59e0b', b.icon ?? null, order, nowIso());
  await applyLogo(c, id, b.logoAttachmentId);
  await audit(c.env.DB, me, 'committee.create', 'committee', id, { name: b.name, grant: b.grantId }, c.get('ip'));
  return c.json({ data: { id } }, 201);
});

committees.patch('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const b = await body(c, committeeUpdateBody);
  const me = c.get('user');
  const cur = await first<{ id: string }>(c.env.DB, 'SELECT id FROM committees WHERE id = ? AND archived_at IS NULL', id);
  if (!cur) throw notFound('That committee');
  if (b.name) {
    const dup = await first(c.env.DB, 'SELECT 1 AS x FROM committees WHERE name = ? AND id != ?', b.name, id);
    if (dup) throw conflict('A committee with this name already exists', 'NAME_TAKEN');
  }
  await consumeGrant(c.env.DB, b.grantId, me.id, 'update', id);
  await run(c.env.DB, 'UPDATE committees SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ?', b.name ?? null, b.description ?? null, b.color ?? null, b.icon ?? null, id);
  await applyLogo(c, id, b.logoAttachmentId);
  await audit(c.env.DB, me, 'committee.update', 'committee', id, { ...b }, c.get('ip'));
  return c.json({ data: { ok: true } });
});

committees.delete('/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const grantId = c.req.query('grantId');
  const me = c.get('user');
  if (!grantId) throw forbidden('Deleting a committee needs the Convenor’s permission');
  const cur = await first<{ id: string }>(c.env.DB, 'SELECT id FROM committees WHERE id = ? AND archived_at IS NULL', id);
  if (!cur) throw notFound('That committee');
  const people = (await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM users WHERE committee_id = ? AND deleted_at IS NULL', id))!.n;
  if (people) throw conflict(`This committee still has ${people} ${people === 1 ? 'person' : 'people'}. Move or remove them first.`, 'COMMITTEE_NOT_EMPTY');
  const open = (await first<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM tickets WHERE to_committee_id = ? AND status != 'done'", id))!.n;
  if (open) throw conflict(`This committee still has ${open} open ${open === 1 ? 'request' : 'requests'}.`, 'COMMITTEE_HAS_OPEN_TICKETS');
  await consumeGrant(c.env.DB, grantId, me.id, 'delete', id);
  // Archived rather than erased, so old requests keep their committee name and logo.
  await run(c.env.DB, 'UPDATE committees SET archived_at = ? WHERE id = ?', nowIso(), id);
  await audit(c.env.DB, me, 'committee.delete', 'committee', id, { grant: grantId }, c.get('ip'));
  return c.json({ data: { ok: true } });
});
