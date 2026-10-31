import { Building2, CalendarDays, Camera, Handshake, Landmark, Megaphone, Palette, Settings2, Truck, Users, Wallet, Wrench, UtensilsCrossed, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  events: CalendarDays,
  media: Camera,
  marketing: Megaphone,
  sponsorship: Handshake,
  operations: Settings2,
  administration: Landmark,
  design: Palette,
  technical: Wrench,
  logistics: Truck,
  hospitality: UtensilsCrossed,
  finance: Wallet,
  volunteers: Users,
};
export const ICON_LABEL: Record<string, string> = {
  events: 'Calendar (Events)', media: 'Camera (Media)', marketing: 'Megaphone (Marketing)', sponsorship: 'Handshake (Sponsorship)',
  operations: 'Gear (Operations)', administration: 'Building (Administration)', design: 'Palette (Design)', technical: 'Wrench (Technical)',
  logistics: 'Truck (Logistics)', hospitality: 'Dining (Hospitality)', finance: 'Wallet (Finance)', volunteers: 'People (Volunteers)',
};

/** The committee's icon. Falls back to the name, so committees made before icons existed still get a fitting one. */
export function CommitteeIcon({ icon, name, className }: { icon?: string | null; name?: string; className?: string }) {
  const key = icon && ICONS[icon] ? icon : name ? name.trim().toLowerCase() : '';
  const Icon = ICONS[key] ?? Building2;
  return <Icon className={className ?? 'size-5'} aria-hidden />;
}
