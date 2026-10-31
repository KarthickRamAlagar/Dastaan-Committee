import { PORTAL_ROLES, PORTAL_TITLE, portalForRole, type PortalId, type Role } from '@dastaan/shared';

export type { PortalId };

export interface Portal {
  id: PortalId;
  /** Shown on the sign-in page and the "wrong portal" screen. */
  title: string;
  /** Roles that may use this app. Everyone else is sent to their own app. */
  roles: Role[];
}

export const PORTALS: Record<PortalId, Portal> = {
  convenor: { id: 'convenor', title: PORTAL_TITLE.convenor, roles: PORTAL_ROLES.convenor },
  admin: { id: 'admin', title: PORTAL_TITLE.admin, roles: PORTAL_ROLES.admin },
  others: { id: 'others', title: PORTAL_TITLE.others, roles: PORTAL_ROLES.others },
};

/** Where each app lives. Set in each web app's .env.local (NEXT_PUBLIC_*_URL). */
export const PORTAL_URL: Record<PortalId, string> = {
  convenor: process.env.NEXT_PUBLIC_CONVENOR_URL ?? 'http://localhost:3001',
  admin: process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3002',
  others: process.env.NEXT_PUBLIC_OTHERS_URL ?? 'http://localhost:3000',
};

export const portalOfRole = (role: Role): Portal => PORTALS[portalForRole(role)];
