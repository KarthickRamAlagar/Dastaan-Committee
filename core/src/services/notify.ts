import { all, newId, nowIso, run } from '../lib/db.js';

export interface Note {
  title: string;
  body: string;
  byId?: string | null;
  link?: string | null;
  /** Longest body to keep. Messages sent from the mail dialog keep more than the usual short alerts. */
  max?: number;
}

/** One statement however many people: the ids travel as a JSON list. */
export async function notify(db: D1Database, userIds: (string | null | undefined)[], n: Note) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return;
  await run(
    db,
    `INSERT INTO notifications (id, user_id, title, body, by_id, link, created_at)
     SELECT lower(hex(randomblob(16))), j.value, ?1, ?2, ?3, ?4, ?5 FROM json_each(?6) j
      WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = j.value AND u.deleted_at IS NULL)`,
    n.title.slice(0, 200),
    n.body.slice(0, n.max ?? 500),
    n.byId ?? null,
    n.link ?? null,
    nowIso(),
    JSON.stringify(ids),
  );
}

export const convenorIds = async (db: D1Database) =>
  (await all<{ id: string }>(db, "SELECT id FROM users WHERE role = 'convenor' AND deleted_at IS NULL")).map((r) => r.id);
export const convenorEmails = async (db: D1Database) =>
  (await all<{ email: string }>(db, "SELECT email FROM users WHERE role = 'convenor' AND deleted_at IS NULL")).map((r) => r.email);
/** Every Committee Lead of a committee (there can be several). */
export const leadsOf = async (db: D1Database, committeeId: string) =>
  (await all<{ id: string }>(db, "SELECT id FROM users WHERE role = 'lead' AND committee_id = ? AND deleted_at IS NULL ORDER BY created_at, name", committeeId)).map((r) => r.id);
/** One Lead, for the places that need a single person (a member's change request goes to one Lead). */
export const leadOf = async (db: D1Database, committeeId: string) => (await leadsOf(db, committeeId))[0] ?? null;
export const newKey = newId;
