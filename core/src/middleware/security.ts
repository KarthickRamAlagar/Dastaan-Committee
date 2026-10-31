import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';
import { isProd, originAllowed } from '../env.js';
import { HttpError } from '../lib/errors.js';

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  c.set('ip', c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local');
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'same-origin');
  h.set('X-Frame-Options', 'DENY');
  if (!h.has('Cache-Control')) h.set('Cache-Control', 'no-store');
  if (isProd(c.env)) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

/** Cookie sessions plus same-site cookies already stop most cross-site requests. This also refuses any write from another origin. */
export const originCheck = createMiddleware<AppEnv>(async (c, next) => {
  const m = c.req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  const origin = c.req.header('origin');
  if (!originAllowed(c.env, origin)) {
    throw new HttpError(403, 'BAD_ORIGIN', 'This request did not come from a Dastaan app');
  }
  return next();
});

/**
 * Development only. Next's dev proxy drops large request bodies, so in dev the browser sends uploads straight to the API
 * (NEXT_PUBLIC_UPLOAD_ORIGIN). Production is same-origin and never uses this. It is never active when ENVIRONMENT=production.
 */
export const devUploadCors = createMiddleware<AppEnv>(async (c, next) => {
  if (isProd(c.env) || !c.req.path.startsWith('/api/uploads')) return next();
  const origin = c.req.header('origin');
  const ok = originAllowed(c.env, origin);
  const cors = (r: Headers) => {
    if (!ok || !origin) return;
    r.set('Access-Control-Allow-Origin', origin);
    r.set('Access-Control-Allow-Credentials', 'true');
    r.set('Access-Control-Allow-Headers', 'Content-Type, X-Original-Size');
    r.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    r.set('Vary', 'Origin');
  };
  if (c.req.method === 'OPTIONS') { const h = new Headers(); cors(h); return new Response(null, { status: 204, headers: h }); }
  await next();
  cors(c.res.headers);
});
