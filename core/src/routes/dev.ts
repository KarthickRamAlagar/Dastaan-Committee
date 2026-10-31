import { Hono } from 'hono';
import { emailMode, type AppEnv } from '../env.js';
import { all } from '../lib/db.js';
import { sendTestMail } from '../lib/mail/send.js';

/** Only exists when EMAIL_MODE=log outside production, so tests and demos can read the "sent" emails. */
export const dev = new Hono<AppEnv>();
dev.use(async (c, next) => {
  if (c.env.ENVIRONMENT === 'production') return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  await next();
});
dev.get('/outbox', async (c) => {
  if (emailMode(c.env) === 'smtp') return c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  return c.json({ data: await all(c.env.DB, 'SELECT id, at, to_list AS toList, cc_list AS ccList, subject, text FROM dev_outbox ORDER BY id DESC LIMIT 400') });
});

/** Used by `npm run mail:test`: sends one message through the real mail path (SMTP in smtp mode). Never available in production. */
dev.post('/test-mail', async (c) => {
  const b = await c.req.json<{ to?: string }>().catch(() => ({} as { to?: string }));
  const to = (b.to ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Send {"to":"someone@example.com"}' } }, 400);
  try {
    const r = await sendTestMail(c.env, to);
    return c.json({ data: { to, mode: r.mode } });
  } catch (e) {
    return c.json({ error: { code: 'MAIL_FAILED', message: e instanceof Error ? e.message : String(e) } }, 500);
  }
});
