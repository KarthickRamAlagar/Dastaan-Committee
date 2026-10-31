import type { Bindings, SessionUser } from '../env.js';
import { addMinutes, first, newId, nowIso, run } from '../lib/db.js';
import { hmacHex, sixDigitCode } from '../lib/crypto.js';
import { audit } from '../lib/audit.js';
import { assertEmailAllowed } from '../lib/college-email.js';
import { conflict, HttpError, notFound } from '../lib/errors.js';
import { all } from '../lib/db.js';
import { OTP_MINUTES, ROLE_LABEL } from '@dastaan/shared';
import { convenorEmails, convenorIds, notify } from './notify.js';

export const otpHash = (env: Bindings, email: string, code: string) => hmacHex(env.SESSION_SECRET, `otp:${email.toLowerCase()}:${code}`);

/** Create a code for this email and queue the message. Used for sign-in and for new accounts. */
export async function issueOtp(
  env: Bindings,
  user: { name: string; email: string; role?: SessionUser['role'] },
  welcome?: { by: string; role: string; committee: string | null },
) {
  const email = user.email.toLowerCase();
  const code = sixDigitCode();
  await env.DB.batch([
    // Earlier codes are kept: a first email that arrives late must still work after the person asked again.
    env.DB
      .prepare('INSERT INTO otps (id, email, code_hash, expires_at, created_at) VALUES (?,?,?,?,?)')
      .bind(newId(), email, await otpHash(env, email, code), addMinutes(OTP_MINUTES), nowIso()),
  ]);
  await env.MAIL_QUEUE.send({ type: 'otp', to: email, name: user.name, code, role: user.role, welcome });
}

export interface NewPerson {
  name: string;
  email: string;
  phone: string;
  role: 'convenor' | 'lead' | 'member' | 'admin';
  committeeId: string | null;
  subCommittee?: string | null;
}

export async function createPerson(env: Bindings, actor: SessionUser, p: NewPerson, ip: string) {
  assertEmailAllowed(env, p.email);
  const db = env.DB;
  const existing = await first<{ id: string; deleted_at: string | null }>(db, 'SELECT id, deleted_at FROM users WHERE email = ?', p.email);
  if (existing) throw conflict('That email is already registered', 'EMAIL_TAKEN');
  let committeeName: string | null = null;
  if (p.committeeId) {
    const c = await first<{ name: string }>(db, 'SELECT name FROM committees WHERE id = ? AND archived_at IS NULL', p.committeeId);
    if (!c) throw notFound('That committee');
    committeeName = c.name;
  }
  const id = newId();
  try {
    await run(
      db,
      'INSERT INTO users (id, name, email, phone, role, committee_id, sub_committee, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      id, p.name, p.email, p.phone, p.role, p.role === 'convenor' || p.role === 'admin' ? null : p.committeeId, p.role === 'member' ? (p.subCommittee ?? null) : null, actor.id, nowIso(),
    );
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw conflict('That email or committee lead already exists', 'DUPLICATE');
    throw e;
  }
  const roleLabel = ROLE_LABEL[p.role];
  await issueOtp(env, { name: p.name, email: p.email, role: p.role }, { by: actor.name, role: roleLabel, committee: committeeName });
  const recipients = (await convenorEmails(db)).filter((e) => e.toLowerCase() !== p.email.toLowerCase());
  if (recipients.length) {
    await env.MAIL_QUEUE.send({ type: 'user-created', to: recipients, newUser: { name: p.name, email: p.email, role: roleLabel, committee: committeeName }, by: `${actor.name} (${ROLE_LABEL[actor.role]})` });
  }
  await notify(db, (await convenorIds(db)).filter((x) => x !== id), {
    title: `New ${roleLabel} added`,
    body: `${p.name}${committeeName ? ` joined ${committeeName}` : ''}. Added by ${actor.name}.`,
    byId: actor.id,
  });
  await audit(db, actor, 'user.create', 'user', id, { email: p.email, role: p.role, committeeId: p.committeeId }, ip);
  return { id };
}

/** The fixed sub-committees of a committee, in display order. */
export const subCommitteesOf = async (db: D1Database, committeeId: string | null) =>
  committeeId ? (await all<{ name: string }>(db, 'SELECT name FROM sub_committees WHERE committee_id = ? ORDER BY sort_order, name', committeeId)).map((r) => r.name) : [];

/**
 * A sub-committee must be one of the committee's own (from the final list). A committee created later with no list
 * accepts free text, so nobody is blocked.
 */
export async function checkSubCommittee(db: D1Database, committeeId: string | null, name: string): Promise<string> {
  const list = await subCommitteesOf(db, committeeId);
  if (!list.length) return name.trim();
  const hit = list.find((x) => x.toLowerCase() === name.trim().toLowerCase());
  if (!hit) throw new HttpError(422, 'VALIDATION', `Choose one of this committee's sub-committees: ${list.join(', ')}`, { subCommittee: 'Choose from the list' });
  return hit;
}
