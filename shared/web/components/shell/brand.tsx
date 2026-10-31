import Link from 'next/link';
import { cn } from '../../lib/utils';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Dastaan';
/** The small line under the name in the sidebar and top bar. */
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE ?? 'Fest coordination';

/** Both logos are white on a transparent background. In light mode `.logo-mono` turns them dark (see globals.css). */

/** Dastaan logo and name. Replace /public/brand/dastaan-logo.png (keep it white on transparent, or remove "logo-mono" below for a coloured logo). */
export function Brand({ className, href = '/home' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-3', className)} aria-label={`${APP_NAME} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/dastaan-logo.png" alt="" width={44} height={36} className="logo-mono h-9 w-auto shrink-0 object-contain" />
      <span className="leading-tight">
        <span className="block font-display text-xl font-semibold tracking-tight">{APP_NAME}</span>
        <span className="block text-[11px] text-muted-foreground">{APP_TAGLINE}</span>
      </span>
    </Link>
  );
}

/** Amrita logo, shown on the right of the top bar. Replace /public/brand/amrita-logo.png. Scales down on phones. */
export function AmritaLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/amrita-logo.png" alt="Amrita Vishwa Vidyapeetham, Bengaluru Campus" width={180} height={36} className={cn('logo-mono h-6 w-auto max-w-[44vw] object-contain sm:h-8 lg:h-9', className)} />;
}
