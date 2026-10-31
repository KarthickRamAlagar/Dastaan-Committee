import { Building2, FilePlus2, Headset, Home, LifeBuoy, Mail, ShieldCheck, UserPlus, UserRound, Users, Waypoints, type LucideIcon } from 'lucide-react';
import type { Role } from '@dastaan/shared';

export interface NavItem { href?: string; label: string; icon: LucideIcon; action?: 'mail'; badge?: 'grants' | 'support' | 'team' }

export const NAV: Record<Role, NavItem[]> = {
  convenor: [
    { href: '/home', label: 'Overview', icon: Home },
    { href: '/workflows', label: 'Workflows', icon: Waypoints },
    { href: '/convenor/permissions', label: 'Admin permissions', icon: ShieldCheck, badge: 'grants' },
    { label: 'Send email', icon: Mail, action: 'mail' },
    { href: '/support', label: 'Contact admin', icon: LifeBuoy },
  ],
  lead: [
    { href: '/home', label: 'Committee home', icon: Home },
    { href: '/requests/new', label: 'New request', icon: FilePlus2 },
    { href: '/team', label: 'My committee', icon: Users, badge: 'team' },
    { href: '/members/new', label: 'Add committee members', icon: UserPlus },
    { label: 'Send email', icon: Mail, action: 'mail' },
    { href: '/me', label: 'My page', icon: UserRound },
    { href: '/support', label: 'Contact admin', icon: LifeBuoy },
  ],
  member: [
    { href: '/home', label: 'Committee home', icon: Home },
    { href: '/me', label: 'My work', icon: UserRound },
    { href: '/support', label: 'Contact my Lead', icon: LifeBuoy },
  ],
  admin: [
    { href: '/admin', label: 'People', icon: Users },
    { href: '/admin/create', label: 'Create Convenor / Lead', icon: UserPlus },
    { href: '/admin/committees', label: 'Committees', icon: Building2 },
    { href: '/admin/support', label: 'Requests', icon: Headset, badge: 'support' },
  ],
};
