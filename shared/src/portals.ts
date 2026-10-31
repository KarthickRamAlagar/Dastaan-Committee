import type { Role } from './constants';

/** The three apps. Each has its own web app and its own API, and all of them use one database. */
export const PORTAL_IDS = ['convenor', 'admin', 'others'] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

/** Who may sign in to which app. The API enforces this; the web app only mirrors it for nicer messages. */
export const PORTAL_ROLES: Record<PortalId, Role[]> = {
  convenor: ['convenor'],
  admin: ['admin'],
  others: ['lead', 'member'],
};

export const PORTAL_TITLE: Record<PortalId, string> = {
  convenor: 'Convenor portal',
  admin: 'Admin portal',
  others: 'Committee portal',
};

export const portalForRole = (role: Role): PortalId => (role === 'convenor' ? 'convenor' : role === 'admin' ? 'admin' : 'others');
