import { Hono } from 'hono';
import { mailBody } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { body } from '../lib/validate.js';
import { all, chunk, first, newId, nowIso } from '../lib/db.js';
import { forbidden, HttpError } from '../lib/errors.js';
import { limit } from '../lib/ratelimit.js';
import { audit } from '../lib/audit.js';
import { sendMail } from '../lib/mail/queue.js';
import { convenorEmails, notify } from '../services/notify.js';

export const mail = new Hono<AppEnv>();
mail.use(requireAuth);
mail.use(requireRole('convenor', 'lead'));

interface P { id: string; name: string; email: string; role: string; committeeId: string | null }
const PEOPLE = `SELECT u.id, u.name, u.email, u.role, u.committee_id AS committeeId FROM users u WHERE u.deleted_at IS NULL AND u.role IN ('lead','member')`;

/**
 * Who gets a message.
 * - Convenor: everyone, all Leads, whole committees (with their Lead), or chosen people. A chosen person always
 *   brings their committee's Lead with them, and the Lead cannot be taken off the list.
 * - Lead: their own committee, or chosen people from it. Convenors are copied.
 */
async function resolve(db: D1Database, me: AppEnv['Variables']['user'], a: ReturnType<typeof mailBody.parse>['audience']) {
  let rows: P[] = [];
  let autoAdded: string[] = [];
  if (me.role === 'lead') {
    if (a.type === 'all' || a.type === 'leads') throw forbidden('Committee Leads can write to their own committee only');
    if (a.type === 'committees') {
      if (a.committeeIds.some((c) => c !== me.committeeId)) throw forbidden('You can write to your own committee only');
      rows = await all<P>(db, `${PEOPLE} AND u.committee_id = ?`, me.committeeId);
    } else {
      rows = await all<P>(db, `${PEOPLE} AND u.committee_id = ? AND u.id IN (SELECT value FROM json_each(?))`, me.committeeId, JSON.stringify(a.userIds));
      if (rows.length !== new Set(a.userIds).size) throw forbidden('You can write to people in your own committee only');
    }
  } else if (a.type === 'all') rows = await all<P>(db, PEOPLE);
  else if (a.type === 'leads') rows = await all<P>(db, `${PEOPLE} AND u.role = 'lead'`);
  else if (a.type === 'committees') rows = await all<P>(db, `${PEOPLE} AND u.committee_id IN (SELECT value FROM json_each(?))`, JSON.stringify(a.committeeIds));
  else {
    rows = await all<P>(db, `${PEOPLE} AND u.id IN (SELECT value FROM json_each(?))`, JSON.stringify(a.userIds));
    const have = new Set(rows.map((r) => r.id));
    const committees = [...new Set(rows.map((r) => r.committeeId).filter(Boolean))];
    if (committees.length) {
      const leads = await all<P>(db, `${PEOPLE} AND u.role = 'lead' AND u.committee_id IN (SELECT value FROM json_each(?))`, JSON.stringify(committees));
      for (const l of leads) if (!have.has(l.id)) (rows.push(l), autoAdded.push(l.name));
    }
  }
  rows = rows.filter((r) => r.id !== me.id);
  return { rows, autoAdded };
}

mail.post('/', async (c) => {
  const me = c.get('user');
  const b = await body(c, mailBody);
  const db = c.env.DB;
  await limit(db, `mail:${me.id}`, 20, 3600, 'You have sent a lot of emails in the last hour. Please wait a little.');
  const { rows, autoAdded } = await resolve(db, me, b.audience);
  if (!rows.length) throw new HttpError(422, 'VALIDATION', 'Nobody matches this choice yet', { audience: 'No recipients' });
  if (b.attachmentIds.length) {
    const ok = (await first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM attachments WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'mail' AND committed = 0`, JSON.stringify(b.attachmentIds), me.id))!.n;
    if (ok !== new Set(b.attachmentIds).size) throw new HttpError(422, 'VALIDATION', 'One of the files is missing. Upload it again.', { attachmentIds: 'File not found' });
  }
  const mailId = newId();
  const emailToo = b.channel === 'both';
  if (!emailToo && b.attachmentIds.length) throw new HttpError(422, 'VALIDATION', 'Files go with emails. Choose Email and notification to send them.', { attachmentIds: 'Not for notification only' });
  await db.batch([
    db.prepare('INSERT INTO mail_log (id, sender_id, subject, body, audience, recipient_count, created_at, channel) VALUES (?,?,?,?,?,?,?,?)').bind(mailId, me.id, b.subject, b.body, JSON.stringify(b.audience), rows.length, nowIso(), b.channel),
    db.prepare(`UPDATE attachments SET mail_id = ?, committed = 1 WHERE id IN (SELECT value FROM json_each(?)) AND uploader_id = ? AND kind = 'mail'`).bind(mailId, JSON.stringify(b.attachmentIds), me.id),
  ]);
  // Leads copy the Convenors; the sender's replies go to the sender.
  const cc = me.role === 'lead' ? await convenorEmails(db) : [];
  // Convenors are copied once (on the first batch), not once per batch.
  if (emailToo) {
    const batches = chunk(rows.map((r) => r.email), 40);
    await sendMail(c.env, batches.map((group, i) => ({ type: 'broadcast' as const, mailId, bcc: group, cc: i === 0 ? cc : [], replyTo: me.email })), (p) => c.executionCtx.waitUntil(p));
  }
  await notify(db, rows.map((r) => r.id), { title: b.subject, body: b.body, byId: me.id, max: 4000 });
  if (me.role === 'lead') await notify(db, (await all<{ id: string }>(db, "SELECT id FROM users WHERE role = 'convenor' AND deleted_at IS NULL")).map((r) => r.id), { title: `${me.committeeName} Lead sent: ${b.subject}`, body: b.body, byId: me.id, max: 4000 });
  await audit(db, me, 'mail.send', 'mail', mailId, { recipients: rows.length, audience: b.audience.type }, c.get('ip'));
  return c.json({ data: { mailId, recipientCount: rows.length, autoAddedLeads: autoAdded } }, 201);
});
