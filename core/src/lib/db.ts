import { HttpError } from './errors.js';

export const nowIso = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();
export const addMinutes = (m: number, from = Date.now()) => new Date(from + m * 60_000).toISOString();

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function all<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...params).all<T>();
  return r.results;
}
export async function first<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}
export async function run(db: D1Database, sql: string, ...params: unknown[]) {
  return db.prepare(sql).bind(...params).run();
}
/** `?,?,?` for an IN list. D1 allows 100 bound values per statement, so callers chunk by 90. */
export const marks = (n: number) => Array.from({ length: n }, () => '?').join(',');

export function mustFind<T>(row: T | null | undefined, what: string): T {
  if (!row) throw new HttpError(404, 'NOT_FOUND', `${what} was not found`);
  return row;
}
