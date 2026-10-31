import { first, nowIso, run } from '../lib/db.js';
import { forbidden } from '../lib/errors.js';
import type { GrantAction } from '@dastaan/shared';

/**
 * Committee changes are Convenor-approved. A grant is good for one action on one committee
 * (or one new committee) and for 24 hours. Consuming it is a single atomic update.
 */
export async function consumeGrant(db: D1Database, grantId: string, adminId: string, action: GrantAction, committeeId: string | null) {
  const r = await run(
    db,
    `UPDATE committee_grants SET status = 'used', used_at = ?1
      WHERE id = ?2 AND status = 'approved' AND requested_by = ?3 AND action = ?4 AND expires_at > ?1
        AND ((?5 IS NULL AND committee_id IS NULL) OR committee_id = ?5)`,
    nowIso(), grantId, adminId, action, committeeId,
  );
  if (!r.meta.changes) throw forbidden('This needs the Convenor’s permission, and the permission is missing, already used or expired');
}
export const findGrant = (db: D1Database, id: string) =>
  first<{ id: string; status: string; requested_by: string }>(db, 'SELECT id, status, requested_by FROM committee_grants WHERE id = ?', id);
