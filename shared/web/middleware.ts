import { NextResponse, type NextRequest } from 'next/server';
import type { PortalId } from '@dastaan/shared';

// Production uses one name per domain. Development gives each app its own name because all apps share "localhost".
// Each app must look only at ITS OWN cookie: browsers share cookies across localhost ports, so reading the others
// would make a sign-in on one app look like a sign-in on all three.
const cookiesFor = (portal: PortalId) => ['__Host-dastaan_sid', `dastaan_${portal}_sid`];

/** A quick bounce for people with no session cookie. The API still checks every request. Used by all three clients. */
export const portalMiddleware = (portal: PortalId) => (req: NextRequest) => {
  const has = cookiesFor(portal).some((c) => req.cookies.has(c));
  const { pathname } = req.nextUrl;
  if (pathname === '/login') {
    if (has) return NextResponse.redirect(new URL('/home', req.url));
    return NextResponse.next();
  }
  if (!has) {
    const url = new URL('/login', req.url);
    if (pathname !== '/' && pathname !== '/home') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === '/') return NextResponse.redirect(new URL('/home', req.url));
  return NextResponse.next();
};

/** Paths the middleware must not touch (each client repeats this literally in its middleware.ts). */
export const MIDDLEWARE_MATCHER = '/((?!api|_next|brand|favicon|icon|robots|manifest|sw\\.js|offline).*)';
