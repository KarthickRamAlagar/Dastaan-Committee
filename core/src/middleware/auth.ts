import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { adminEmails, isProd, type AppEnv, type Bindings, type SessionUser } from '../env.js';
import { first } from '../lib/db.js';
import { sha256Hex } from '../lib/crypto.js';
import { forbidden, unauthorized, HttpError } from '../lib/errors.js';
import { PORTAL_ROLES, PORTAL_TITLE, portalForRole, type PortalId } from '@dastaan/shared';

/** Production: one cookie per domain, so the same name is fine. Development: all apps share "localhost", so each gets its own name. */
export const cookieName = (env: Bindings, portal: PortalId) => (isProd(env) ? '__Host-dastaan_sid' : `dastaan_${portal}_sid`);
export const SESSION_DAYS = 1; // fixed: everyone signs in again once a day

interface Row {
  id: string; name: string; email: string; phone: string; role: SessionUser['role'];
  committee_id: string | null; committee_name: string | null; source: 'db' | 'env'; last_seen: string;
}

export async function loadSession(env: Bindings, token: string | undefined): Promise<{ user: SessionUser; hash: string; lastSeen: string } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const r = await first<Row>(
    env.DB,
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.committee_id, c.name AS committee_name, u.source, s.last_seen
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN committees c ON c.id = u.committee_id
      WHERE s.id_hash = ? AND s.expires_at > ? AND u.deleted_at IS NULL`,
    hash,
    new Date().toISOString(),
  );
  if (!r) return null;
  // Env admins stop being admins the moment their email leaves ADMIN_EMAILS.
  if (r.source === 'env' && !adminEmails(env).includes(r.email.toLowerCase())) return null;
  return {
    hash,
    lastSeen: r.last_seen,
    user: { id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, committeeId: r.committee_id, committeeName: r.committee_name, source: r.source },
  };
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const s = await loadSession(c.env, getCookie(c, cookieName(c.env, c.get('portal'))));
  if (!s) throw unauthorized();
  assertPortal(c.get('portal'), s.user.role);
  c.set('user', s.user);
  await next();
});

export const requireRole = (...roles: SessionUser['role'][]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get('user').role)) throw forbidden('Your role cannot do this');
    await next();
  });

/** Each API serves one app. Someone whose role belongs to another app is told where to go instead. */
export function assertPortal(portal: PortalId, role: SessionUser['role']) {
  if (PORTAL_ROLES[portal].includes(role)) return;
  const mine = portalForRole(role);
  throw new HttpError(403, 'WRONG_PORTAL', `That account belongs to the ${PORTAL_TITLE[mine]}.`, { portal: mine });
}
