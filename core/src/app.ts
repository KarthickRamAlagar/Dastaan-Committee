import { Hono } from 'hono';
import type { PortalId } from '@dastaan/shared';
import type { AppEnv } from './env.js';
import { HttpError } from './lib/errors.js';
import { securityHeaders, originCheck, devUploadCors } from './middleware/security.js';
import { auth } from './routes/auth.js';
import { users } from './routes/users.js';
import { committees } from './routes/committees.js';
import { grants } from './routes/grants.js';
import { tickets } from './routes/tickets.js';
import { files } from './routes/files.js';
import { mail } from './routes/mail.js';
import { notifications } from './routes/notifications.js';
import { support } from './routes/support.js';
import { system } from './routes/system.js';
import { dev } from './routes/dev.js';

/** Which route groups each API serves. A group an app never uses is not mounted at all. */
const MOUNT: Record<PortalId, string[]> = {
  others: ['auth', 'tickets', 'users', 'committees', 'mail', 'support', 'notifications', 'uploads', 'files'],
  convenor: ['auth', 'tickets', 'users', 'committees', 'grants', 'mail', 'support', 'notifications', 'uploads', 'files'],
  admin: ['auth', 'users', 'committees', 'grants', 'support', 'notifications', 'uploads', 'files', 'system'],
};
const ROUTES = { auth, users, committees, grants, tickets, mail, notifications, support, uploads: files, files, system } as const;

/** Builds the HTTP app for one portal. All three portals run this same code against the same database. */
export function createApp(portal: PortalId) {
  const app = new Hono<AppEnv>().basePath('/api');
  app.use(async (c, next) => { c.set('portal', portal); await next(); });
  app.use(securityHeaders);
  app.use(devUploadCors);
  app.use(originCheck);

  app.get('/health', async (c) => {
    const ok = await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ status: ok ? 'ok' : 'degraded', portal, time: new Date().toISOString() });
  });

  for (const name of MOUNT[portal]) app.route(`/${name}`, ROUTES[name as keyof typeof ROUTES]);
  app.route('/dev', dev);

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: { code: err.code, message: err.message, fields: err.fields } }, err.status);
    console.error('unhandled', c.req.method, c.req.path, err);
    return c.json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, 500);
  });
  return app;
}
