import { Hono } from 'hono';
import { z } from 'zod';
import { emailMode, otpRequired, type AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body } from '../lib/validate.js';
import { HttpError } from '../lib/errors.js';
import { limit } from '../lib/ratelimit.js';
import { sendTestMail } from '../lib/mail/send.js';

/** Admin tools for checking the setup. */
export const system = new Hono<AppEnv>();
system.use(requireAuth);
system.use(requireRole('admin'));

system.get('/status', (c) => c.json({ data: { emailMode: emailMode(c.env), loginOtp: otpRequired(c.env), environment: c.env.ENVIRONMENT } }));

/** Sends one email right now and reports the result, so the Admin can confirm SMTP works before real use. */
system.post('/test-mail', async (c) => {
  const { to } = await body(c, z.object({ to: z.string().trim().toLowerCase().email().max(200).optional() }));
  await limit(c.env.DB, `test-mail:${c.get('user').id}`, 5, 600, 'Please wait a few minutes before sending more test emails.');
  const target = to ?? c.get('user').email;
  try {
    const r = await sendTestMail(c.env, target);
    return c.json({ data: { to: target, mode: r.mode, delivered: r.mode === 'smtp' } });
  } catch (e) {
    throw new HttpError(500, 'MAIL_FAILED', `The mail server did not accept the message: ${e instanceof Error ? e.message : String(e)}`);
  }
});
