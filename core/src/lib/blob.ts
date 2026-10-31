import type { Bindings } from '../env.js';
import { first, run } from './db.js';

/**
 * File storage. If an R2 bucket is connected (env.FILES) files go there. Otherwise they are kept inside the D1 database,
 * in pieces of at most 1 MB (one D1 row can hold 2 MB). Callers do not need to know which one is used.
 */
export const CHUNK_BYTES = 1024 * 1024;

export async function putBlobD1(db: D1Database, key: string, parts: AsyncIterable<Uint8Array>, length: number): Promise<void> {
  const buf = new Uint8Array(CHUNK_BYTES);
  let fill = 0;
  let seq = 0;
  let total = 0;
  const flush = async () => {
    if (!fill) return;
    await db.prepare('INSERT INTO file_chunks (key, seq, data) VALUES (?,?,?)').bind(key, seq++, buf.slice(0, fill).buffer).run();
    fill = 0;
  };
  for await (const part of parts) {
    total += part.length;
    if (total > length) throw new Error('The file is larger than announced');
    let off = 0;
    while (off < part.length) {
      const n = Math.min(CHUNK_BYTES - fill, part.length - off);
      buf.set(part.subarray(off, off + n), fill);
      fill += n;
      off += n;
      if (fill === CHUNK_BYTES) await flush();
    }
  }
  await flush();
  if (total !== length) throw new Error('The upload did not finish');
}

const toBytes = (v: unknown): Uint8Array => (v instanceof ArrayBuffer ? new Uint8Array(v) : ArrayBuffer.isView(v) ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : new Uint8Array(v as number[]));

async function readChunk(db: D1Database, key: string, seq: number): Promise<Uint8Array | null> {
  const row = await first<{ data: unknown }>(db, 'SELECT data FROM file_chunks WHERE key = ? AND seq = ?', key, seq);
  return row ? toBytes(row.data) : null;
}

/** Opens a stored file as a stream, or returns null when it is missing. `size` is the size recorded when it was uploaded. */
export async function getBlob(env: Bindings, key: string, size: number): Promise<ReadableStream<Uint8Array> | null> {
  if (env.FILES) return (await env.FILES.get(key))?.body ?? null;
  let prefetched = await readChunk(env.DB, key, 0);
  if (!prefetched) return null;
  let next = 0;
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (sent >= size) return ctrl.close();
      const row = prefetched ?? (await readChunk(env.DB, key, next));
      prefetched = null;
      if (!row) return ctrl.error(new Error('A piece of the file is missing'));
      next++;
      sent += row.length;
      ctrl.enqueue(row);
    },
  });
}

export async function deleteBlob(env: Bindings, key: string): Promise<void> {
  if (env.FILES) await env.FILES.delete(key);
  else await run(env.DB, 'DELETE FROM file_chunks WHERE key = ?', key);
}
