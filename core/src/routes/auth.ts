import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { adminLoginBody, requestOtpBody, verifyOtpBody, type Me } from '@dastaan/shared';
import { adminEmails, isProd, otpRequired, type AppEnv, type SessionUser } from '../env.js';
import { assertEmailAllowed, collegeEmailOnly } from '../lib/college-email.js';
import { assertPortal, cookieName, loadSession, requireAuth, SESSION_DAYS } from '../middleware/auth.js';
import { body } from '../lib/validate.js';
import { all, first, newId, nowIso, run } from '../lib/db.js';
import { randomToken, safeEqual, sha256Hex } from '../lib/crypto.js';
import { badRequest } from '../lib/errors.js';
import { limit } from '../lib/ratelimit.js';
import { audit } from '../lib/audit.js';
import { issueOtp, otpHash } from '../services/users.js';

export const auth = new Hono<AppEnv>();

const GENERIC = 'That code is not right or has expired. Ask for a new one.';

export const toMe = (u: SessionUser, env: AppEnv['Bindings']): Me => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  committeeId: u.committeeId, committeeName: u.committeeName,
  isEnvAdmin: u.source === 'env' && adminEmails(env).includes(u.email.toLowerCase()),
});

async function startSession(c: import('hono').Context<AppEnv>, userId: string) {
  const token = randomToken(32);
  const exp = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await run(
    c.env.DB,
    'INSERT INTO sessions (id_hash, user_id, created_at, last_seen, expires_at, ip, ua) VALUES (?,?,?,?,?,?,?)',
    await sha256Hex(token), userId, nowIso(), nowIso(), exp.toISOString(), c.get('ip'), (c.req.header('user-agent') ?? '').slice(0, 200),
  );
  setCookie(c, cookieName(c.env, c.get('portal')), token, { httpOnly: true, secure: isProd(c.env), sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 86_400 });
}

/** Tells the sign-in page whether a code is needed. */
auth.get('/config', (c) => c.json({ data: { otpRequired: otpRequired(c.env), collegeEmailOnly: collegeEmailOnly(c.env) } }));

/** Step 1 for everyone but env admins: ask for a code. The answer never says whether the email is registered. */
auth.post('/otp/request', async (c) => {
  const { email } = await body(c, requestOtpBody);
  const db = c.env.DB;
  await limit(db, `otp-ip:${c.get('ip')}`, isProd(c.env) ? 25 : 1000, 600); // generous locally so test runs do not trip it
  if (adminEmails(c.env).includes(email)) {
    assertPortal(c.get('portal'), 'admin');
    return c.json({ data: { next: 'password' } });
  }
  assertEmailAllowed(c.env, email);
  if (!otpRequired(c.env)) {
    // TEST MODE (LOGIN_OTP=false): a registered email is enough. Never leave this on for real use.
    const t = await first<{ id: string; source: string; role: SessionUser['role'] }>(db, 'SELECT id, source, role FROM users WHERE email = ? AND deleted_at IS NULL', email);
    if (!t || t.source === 'env') throw badRequest('This email is not registered. Ask your Committee Lead or the Admin to add you.', 'NOT_REGISTERED');
    assertPortal(c.get('portal'), t.role);
    await startSession(c, t.id);
    await audit(db, { id: t.id, email }, 'auth.login', 'user', t.id, { method: 'email-only (LOGIN_OTP=false)' }, c.get('ip'));
    return c.json({ data: { next: 'done', me: await loadSessionFromCookieJar(c, t.id) } });
  }
  const u = await first<{ name: string; role: SessionUser['role'] }>(db, 'SELECT name, role FROM users WHERE email = ? AND deleted_at IS NULL', email);
  // Tell people straight away when they are at the wrong app, instead of mailing a code they cannot use here.
  if (u) assertPortal(c.get('portal'), u.role);
  await limit(db, `otp-gap:${email}`, 1, 30, 'Please wait 30 seconds before asking for another code.');
  await limit(db, `otp-hour:${email}`, 6, 3600, 'Too many codes asked for this email. Try again in an hour.');
  if (u) await issueOtp(c.env, { name: u.name, email, role: u.role });
  return c.json({ data: { next: 'otp' } });
});

auth.post('/otp/verify', async (c) => {
  const { email, code } = await body(c, verifyOtpBody);
  assertEmailAllowed(c.env, email);
  const db = c.env.DB;
  await limit(db, `verify-ip:${c.get('ip')}`, isProd(c.env) ? 40 : 1000, 600);
  // Every code sent in the last OTP_MINUTES still works (asking again does not cancel the earlier email, which may arrive late).
  // Each guess counts as one attempt against every open code, so five wrong guesses lock them all.
  const open = await all<{ id: string; code_hash: string }>(
    db,
    'SELECT id, code_hash FROM otps WHERE email = ? AND consumed_at IS NULL AND expires_at > ? AND attempts < 5 ORDER BY created_at DESC LIMIT 8',
    email,
    nowIso(),
  );
  if (!open.length) throw badRequest(GENERIC, 'OTP_INVALID');
  await run(db, 'UPDATE otps SET attempts = attempts + 1 WHERE email = ? AND consumed_at IS NULL AND expires_at > ?', email, nowIso());
  const given = await otpHash(c.env, email, code);
  let hit: { id: string } | null = null;
  for (const r of open) if (await safeEqual(r.code_hash, given)) hit = r;
  if (!hit) throw badRequest(GENERIC, 'OTP_INVALID');
  const claimed = await run(db, 'UPDATE otps SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', nowIso(), hit.id);
  if (!claimed.meta.changes) throw badRequest(GENERIC, 'OTP_INVALID');
  await run(db, 'UPDATE otps SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL', nowIso(), email); // a used code closes all the others
  const u = await first<{ id: string; source: string; role: SessionUser['role'] }>(db, 'SELECT id, source, role FROM users WHERE email = ? AND deleted_at IS NULL', email);
  if (!u || u.source === 'env') throw badRequest(GENERIC, 'OTP_INVALID');
  assertPortal(c.get('portal'), u.role);
  await startSession(c, u.id);
  await audit(db, { id: u.id, email }, 'auth.login', 'user', u.id, { method: 'otp' }, c.get('ip'));
  const s = await loadSessionFromCookieJar(c, u.id);
  return c.json({ data: s });
});

async function loadSessionFromCookieJar(c: import('hono').Context<AppEnv>, userId: string): Promise<Me> {
  const r = await first<{ id: string; name: string; email: string; phone: string; role: SessionUser['role']; committee_id: string | null; committee_name: string | null; source: 'db' | 'env' }>(
    c.env.DB,
    'SELECT u.id,u.name,u.email,u.phone,u.role,u.committee_id,c.name AS committee_name,u.source FROM users u LEFT JOIN committees c ON c.id=u.committee_id WHERE u.id=?',
    userId,
  );
  const x = r!;
  return toMe({ id: x.id, name: x.name, email: x.email, phone: x.phone, role: x.role, committeeId: x.committee_id, committeeName: x.committee_name, source: x.source }, c.env);
}

/** Admins listed in ADMIN_EMAILS sign in with a password instead of a code. */
auth.post('/admin/login', async (c) => {
  const { email, password } = await body(c, adminLoginBody);
  const db = c.env.DB;
  await limit(db, `admin-ip:${c.get('ip')}`, 10, 900);
  await limit(db, `admin-email:${email}`, 10, 900);
  const bad = badRequest('Email or password is not right', 'LOGIN_FAILED');
  if (!adminEmails(c.env).includes(email) || !c.env.ADMIN_PASSWORD) {
    await safeEqual(password, 'x'.repeat(16)); // same work either way
    throw bad;
  }
  if (!(await safeEqual(password, c.env.ADMIN_PASSWORD))) throw bad;
  assertPortal(c.get('portal'), 'admin');
  const name = email.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const row = await first<{ id: string }>(
    db,
    `INSERT INTO users (id, name, email, phone, role, source, committee_id, created_at)
     VALUES (?1, ?2, ?3, '', 'admin', 'env', NULL, ?4)
     ON CONFLICT(email) DO UPDATE SET role = 'admin', source = 'env', committee_id = NULL, deleted_at = NULL
     RETURNING id`,
    newId(), name, email, nowIso(),
  );
  await startSession(c, row!.id);
  await audit(db, { id: row!.id, email }, 'auth.login', 'user', row!.id, { method: 'admin-password' }, c.get('ip'));
  return c.json({ data: await loadSessionFromCookieJar(c, row!.id) });
});

auth.get('/me', requireAuth, (c) => c.json({ data: toMe(c.get('user'), c.env) }));

auth.post('/logout', async (c) => {
  const token = getCookie(c, cookieName(c.env, c.get('portal')));
  const s = await loadSession(c.env, token);
  if (s) await run(c.env.DB, 'DELETE FROM sessions WHERE id_hash = ?', s.hash);
  deleteCookie(c, cookieName(c.env, c.get('portal')), { path: '/', secure: isProd(c.env) });
  return c.json({ data: { ok: true } });
});
