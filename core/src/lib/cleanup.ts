import type { Bindings } from '../env.js';
import { all, run } from './db.js';

/** Hourly housekeeping: old sessions, codes, rate-limit counters and abandoned uploads. */
export async function cleanup(env: Bindings) {
  const now = new Date().toISOString();
  await run(env.DB, 'DELETE FROM sessions WHERE expires_at < ?', now);
  await run(env.DB, 'DELETE FROM otps WHERE expires_at < ?', new Date(Date.now() - 86_400_000).toISOString());
  await run(env.DB, 'DELETE FROM rate_limits WHERE reset_at < ?', Date.now() - 3_600_000);
  await run(env.DB, "DELETE FROM dev_outbox WHERE at < ?", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const old = await all<{ id: string; r2_key: string }>(env.DB, 'SELECT id, r2_key FROM attachments WHERE committed = 0 AND created_at < ? LIMIT 200', new Date(Date.now() - 86_400_000).toISOString());
  for (const a of old) {
    await env.FILES.delete(a.r2_key);
    await run(env.DB, 'DELETE FROM attachments WHERE id = ?', a.id);
  }
}
