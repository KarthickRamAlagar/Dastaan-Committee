import { portalMiddleware } from '@ui/middleware';

export const middleware = portalMiddleware('others');

// Next reads this literally, so it cannot be imported.
export const config = { matcher: ['/((?!api|_next|brand|favicon|icon|robots|manifest|sw\\.js|offline).*)'] };
