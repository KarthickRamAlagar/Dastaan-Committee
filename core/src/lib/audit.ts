import { nowIso, run } from './db.js';

export async function audit(
  db: D1Database,
  actor: { id: string | null; email?: string | null },
  action: string,
  entity?: string,
  entityId?: string,
  meta?: Record<string, unknown>,
  ip?: string,
) {
  try {
    await run(
      db,
      'INSERT INTO audit_log (at, actor_id, actor_email, action, entity, entity_id, meta, ip) VALUES (?,?,?,?,?,?,?,?)',
      nowIso(),
      actor.id,
      actor.email ?? null,
      action,
      entity ?? null,
      entityId ?? null,
      meta ? JSON.stringify(meta).slice(0, 2000) : null,
      ip ?? null,
    );
  } catch (e) {
    console.error('audit failed', e);
  }
}
