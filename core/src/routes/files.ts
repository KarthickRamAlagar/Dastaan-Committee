import { Hono } from 'hono';
import { TICKET_FILE_EXTENSIONS, MAX_MAIL_FILE_BYTES, MAX_STORED_BYTES } from '@dastaan/shared';
import type { AppEnv } from '../env.js';
import { getCookie } from 'hono/cookie';
import { cookieName, loadSession, requireAuth } from '../middleware/auth.js';
import { first, newId, nowIso, run } from '../lib/db.js';
import { HttpError, notFound, forbidden } from '../lib/errors.js';
import { extOf, isBlockedForMail, magicMatches, MIME_BY_EXT, verifyFileSignature } from '../lib/files.js';
import { limit } from '../lib/ratelimit.js';
import { canSee } from '../services/tickets.js';
import { deleteBlob, getBlob, putBlobD1 } from '../lib/blob.js';

export const files = new Hono<AppEnv>();

const KIND_RULES = {
  request: { roles: ['lead', 'member'], max: MAX_STORED_BYTES },
  handoff: { roles: ['lead'], max: MAX_STORED_BYTES },
  mail: { roles: ['convenor', 'lead'], max: MAX_MAIL_FILE_BYTES },
  logo: { roles: ['admin'], max: 1024 * 1024 },
} as const;
type Kind = keyof typeof KIND_RULES;

const cleanName = (n: string) =>
  n.replace(/[\\/\u0000-\u001f"<>|:*?]+/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || 'file';

/**
 * Raw upload: the file is the request body. With R2 it streams straight in; without R2 it is stored in D1, 1 MB at a time.
 * The browser compresses big files first and tells us the original size in X-Original-Size.
 */
files.post('/', requireAuth, async (c) => {
  const me = c.get('user');
  const kind = c.req.query('kind') as Kind;
  const rules = KIND_RULES[kind];
  if (!rules) throw new HttpError(400, 'BAD_REQUEST', 'Unknown upload type');
  if (!(rules.roles as readonly string[]).includes(me.role)) throw forbidden('You cannot upload this kind of file');
  await limit(c.env.DB, `upload:${me.id}`, 60, 3600, 'Too many uploads in the last hour. Please wait a little.');

  const name = cleanName(c.req.query('name') ?? 'file');
  const ext = extOf(name);
  const allowed = kind === 'logo' ? ['png', 'jpg', 'jpeg', 'webp'] : kind === 'mail' ? null : TICKET_FILE_EXTENSIONS;
  if (allowed ? !(allowed as readonly string[]).includes(ext) : isBlockedForMail(name)) {
    throw new HttpError(415, 'BAD_TYPE', kind === 'mail' ? 'This kind of file cannot be sent for safety reasons' : 'Only images, PDF, Word and PowerPoint files are accepted');
  }
  const length = Number(c.req.header('content-length'));
  if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'LENGTH_REQUIRED', 'The file size is missing');
  if (length > rules.max) throw new HttpError(413, 'TOO_LARGE', `This file is still ${(length / 1048576).toFixed(0)} MB after compression. The limit is ${(rules.max / 1048576).toFixed(0)} MB.`);
  if (!c.req.raw.body) throw new HttpError(400, 'BAD_REQUEST', 'The file is empty');

  // Read the first bytes to check the file really is what its name says, then stream the whole thing on.
  const reader = c.req.raw.body.getReader();
  const firstChunk = await reader.read();
  const head = firstChunk.value ?? new Uint8Array();
  if (!magicMatches(ext, head.slice(0, 16))) throw new HttpError(415, 'BAD_TYPE', 'The file content does not match its name');
  const id = newId();
  const key = `${kind}/${new Date().toISOString().slice(0, 7)}/${id}`;
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
  if (c.env.FILES) {
    // R2 is connected: stream the file straight in without holding it in memory.
    const { readable, writable } = new FixedLengthStream(length);
    const pump = (async () => {
      const w = writable.getWriter();
      try {
        if (firstChunk.value) await w.write(firstChunk.value);
        while (!firstChunk.done) {
          const n = await reader.read();
          if (n.done) break;
          await w.write(n.value);
        }
        await w.close();
      } catch (e) {
        await w.abort(e).catch(() => {});
      }
    })();
    try {
      await c.env.FILES.put(key, readable, { httpMetadata: { contentType: mime }, customMetadata: { name, uploader: me.id } });
    } catch {
      throw new HttpError(400, 'UPLOAD_FAILED', 'The upload did not finish. Please try again.');
    }
    await pump;
  } else {
    // No R2: keep the file inside the D1 database, 1 MB at a time.
    const parts = (async function* () {
      if (firstChunk.value) yield firstChunk.value;
      while (!firstChunk.done) {
        const n = await reader.read();
        if (n.done) break;
        yield n.value;
      }
    })();
    try {
      await putBlobD1(c.env.DB, key, parts, length);
    } catch {
      await deleteBlob(c.env, key).catch(() => {});
      throw new HttpError(400, 'UPLOAD_FAILED', 'The upload did not finish. Please try again.');
    }
  }
  const orig = Number(c.req.header('x-original-size'));
  await run(
    c.env.DB,
    'INSERT INTO attachments (id, uploader_id, kind, r2_key, name, mime, size, original_size, committed, created_at) VALUES (?,?,?,?,?,?,?,?,0,?)',
    id, me.id, kind, key, name, mime, length, Number.isFinite(orig) && orig > length ? orig : null, nowIso(),
  );
  return c.json({ data: { id, name, size: length, originalSize: Number.isFinite(orig) && orig > length ? orig : null } }, 201);
});

/**
 * Download. Signed-in people need access to the request the file belongs to. Mail files can also be opened
 * with the signed link in the email, so people who read mail on their phone do not need to sign in first.
 */
files.get('/:id', async (c) => {
  const id = c.req.param('id');
  const a = await first<{ r2_key: string; name: string; mime: string; kind: Kind; ticket_id: string | null; uploader_id: string; committed: number; size: number }>(
    c.env.DB,
    'SELECT r2_key, name, mime, kind, ticket_id, uploader_id, committed, size FROM attachments WHERE id = ?',
    id,
  );
  if (!a) throw notFound('That file');
  let allowed = false;
  if (a.kind === 'mail' && (await verifyFileSignature(c.env, id, c.req.query('exp'), c.req.query('sig')))) allowed = true;
  if (!allowed) {
    const s = await loadSession(c.env, getCookie(c, cookieName(c.env, c.get('portal'))));
    if (!s) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in to open this file');
    const u = s.user;
    if (a.uploader_id === u.id) allowed = true;
    else if (a.kind === 'mail') allowed = u.role === 'convenor';
    else if (a.ticket_id && a.committed) allowed = await canSee(c.env.DB, u, a.ticket_id);
  }
  if (!allowed) throw notFound('That file');
  const body = await getBlob(c.env, a.r2_key, a.size);
  if (!body) throw notFound('That file');
  const inline = c.req.query('inline') === '1' && a.mime.startsWith('image/') && a.mime !== 'image/svg+xml';
  const safeName = encodeURIComponent(a.name);
  return new Response(body, {
    headers: {
      'Content-Type': inline ? a.mime : 'application/octet-stream',
      'Content-Length': String(a.size),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${safeName}`,
      'Cache-Control': 'private, max-age=600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
