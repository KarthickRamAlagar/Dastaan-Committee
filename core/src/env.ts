import type { PortalId } from '@dastaan/shared';

export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
  MAIL_QUEUE: Queue<MailJob>;

  APP_NAME: string;
  /** Shown next to the name in emails, for example "Multi Fest coordination". */
  APP_TAGLINE?: string;
  /** Default on. Set false only for local testing with fake addresses (the sample data uses @dastaan.test). */
  COLLEGE_EMAIL_ONLY?: string;
  /** Public https address where /brand/*.png can be loaded from, for logos in emails. Defaults to the app's own address. */
  MAIL_ASSET_URL?: string;
  /** Where each web app lives. The backend uses them for allowed origins and for links inside emails. */
  OTHERS_ORIGIN: string;
  CONVENOR_ORIGIN: string;
  ADMIN_ORIGIN: string;
  ENVIRONMENT: string;
  ADMIN_EMAILS: string;
  /** 'smtp' sends real mail, 'log' (local only) writes it to the dev outbox, 'off' sends nothing. Empty = smtp when SMTP_HOST is set. */
  EMAIL_MODE?: string;
  /** 'false' lets registered people sign in with their email alone. For testing only. Anything else requires the emailed code. */
  LOGIN_OTP?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_START_TLS?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;

  // secrets
  SESSION_SECRET: string;
  ADMIN_PASSWORD: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'convenor' | 'lead' | 'member';
  committeeId: string | null;
  committeeName: string | null;
  source: 'db' | 'env';
}

export type Vars = { user: SessionUser; ip: string; portal: PortalId };
export type AppEnv = { Bindings: Bindings; Variables: Vars };

/** Messages on the mail queue. Bodies of big mails stay in D1, the queue only carries ids. */
export type MailJob =
  | { type: 'otp'; to: string; name: string; code: string; role?: SessionUser['role']; welcome?: { by: string; role: string; committee: string | null } }
  | { type: 'user-created'; to: string[]; newUser: { name: string; email: string; role: string; committee: string | null }; by: string }
  | { type: 'ticket-context'; userId: string; ticketId: string; reason: 'assigned' | 'forwarded'; byName: string }
  | { type: 'broadcast'; mailId: string; bcc: string[]; cc: string[]; replyTo: string | null };

export const isProd = (env: Bindings) => env.ENVIRONMENT === 'production';
export const adminEmails = (env: Bindings): string[] =>
  env.ADMIN_EMAILS.split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Sign-in codes are required unless LOGIN_OTP is explicitly 'false'. */
export const otpRequired = (env: Bindings) => String(env.LOGIN_OTP ?? 'true').trim().toLowerCase() !== 'false';

const trimSlash = (s: string | undefined) => (s ?? '').trim().replace(/\/$/, '');

/** The web app a person with this role signs in to. Used for the links inside emails. */
export const portalOrigin = (env: Bindings, role: SessionUser['role'] | undefined) =>
  trimSlash(role === 'convenor' ? env.CONVENOR_ORIGIN : role === 'admin' ? env.ADMIN_ORIGIN : env.OTHERS_ORIGIN);

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.localhost):300[0-9]$/i;
const TUNNEL_ORIGIN = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.devtunnels\.ms$/i;

/** Browser origins allowed to call this API with cookies. Local development adds localhost on ports 3000-3009 and Dev Tunnels. */
export function originAllowed(env: Bindings, origin: string | undefined): boolean {
  if (!origin) return false;
  const o = trimSlash(origin);
  if ([env.OTHERS_ORIGIN, env.CONVENOR_ORIGIN, env.ADMIN_ORIGIN].some((x) => x && trimSlash(x) === o)) return true;
  return !isProd(env) && (DEV_ORIGIN.test(o) || TUNNEL_ORIGIN.test(o));
}

/** What EMAIL_MODE really means. Unset or unknown: send by SMTP when SMTP_HOST is set, otherwise log locally / send nothing in production. */
export function emailMode(env: Bindings): 'smtp' | 'log' | 'off' {
  const m = (env.EMAIL_MODE ?? '').trim().toLowerCase();
  if (m === 'smtp' || m === 'log' || m === 'off') return m;
  if ((env.SMTP_HOST ?? '').trim()) return 'smtp';
  return isProd(env) ? 'off' : 'log';
}
