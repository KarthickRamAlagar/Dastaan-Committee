import { COLLEGE_EMAIL_EXAMPLE, COLLEGE_EMAIL_RE } from '@dastaan/shared';
import { adminEmails, type Bindings } from '../env.js';
import { badRequest } from './errors.js';

/** On unless COLLEGE_EMAIL_ONLY is set to false/0/no/off. Admin emails (ADMIN_EMAILS) are always allowed, they may use any address. */
export const collegeEmailOnly = (env: Bindings) => !/^(false|0|no|off)$/i.test((env.COLLEGE_EMAIL_ONLY ?? '').trim());

export function emailAllowed(env: Bindings, email: string): boolean {
  const e = email.trim().toLowerCase();
  return !collegeEmailOnly(env) || COLLEGE_EMAIL_RE.test(e) || adminEmails(env).includes(e);
}

/** Used at sign-in and wherever a person's email is created or changed. */
export function assertEmailAllowed(env: Bindings, email: string) {
  if (!emailAllowed(env, email)) throw badRequest(`Use your college email. It starts with bl. and ends with @bl.students.amrita.edu, for example ${COLLEGE_EMAIL_EXAMPLE}`, 'EMAIL_NOT_ALLOWED');
}
