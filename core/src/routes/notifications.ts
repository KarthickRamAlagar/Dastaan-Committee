import { Hono } from 'hono';
import type { NotificationDto, Page } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth } from '../middleware/auth.js';
import { pageParams } from '../lib/validate.js';
import { all, first, nowIso, run } from '../lib/db.js';

export const notifications = new Hono<AppEnv>();
notifications.use(requireAuth);

notifications.get('/', async (c) => {
  const u = c.get('user');
  const { page, pageSize, offset } = pageParams(c, 7);
  const total = (await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', u.id))!.n;
  const rows = await all<Omit<NotificationDto, 'read'> & { read: number }>(
    c.env.DB,
    `SELECT n.id, n.title, n.body, b.name AS byName, n.created_at AS createdAt, (n.read_at IS NOT NULL) AS read, n.link
       FROM notifications n LEFT JOIN users b ON b.id = n.by_id WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
    u.id, pageSize, offset,
  );
  const unread = (await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', u.id))!.n;
  const out: Page<NotificationDto> & { unread: number } = { items: rows.map((r) => ({ ...r, read: !!r.read })), total, page, pageSize, unread };
  return c.json({ data: out });
});

notifications.get('/unread-count', async (c) => {
  const n = (await first<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', c.get('user').id))!.n;
  return c.json({ data: { unread: n } });
});

notifications.post('/read-all', async (c) => {
  await run(c.env.DB, 'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), c.get('user').id);
  return c.json({ data: { ok: true } });
});

notifications.post('/:id/read', async (c) => {
  await run(c.env.DB, 'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', nowIso(), c.req.param('id'), c.get('user').id);
  return c.json({ data: { ok: true } });
});
