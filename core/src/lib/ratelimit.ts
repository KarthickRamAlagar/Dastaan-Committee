import { tooMany } from './errors.js';

/** Fixed-window counter kept in D1, so it works the same on every instance. */
export async function hit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Date.now();
  const resetAt = now + windowSec * 1000;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= ?3 THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ?3 THEN ?2 ELSE reset_at END
       RETURNING count`,
    )
    .bind(key, resetAt, now)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}
export async function limit(db: D1Database, key: string, max: number, windowSec: number, message?: string) {
  if (!(await hit(db, key, max, windowSec))) throw tooMany(message);
}
