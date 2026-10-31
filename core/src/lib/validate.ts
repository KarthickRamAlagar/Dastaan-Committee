import type { Context } from 'hono';
import type { ZodTypeAny, z } from 'zod';
import { HttpError } from './errors.js';

export async function body<S extends ZodTypeAny>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'The request body must be valid JSON');
  }
  return check(schema, raw);
}
export function check<S extends ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const r = schema.safeParse(raw);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.') || '_';
    if (!fields[k]) fields[k] = i.message;
  }
  const first = Object.values(fields)[0] ?? 'Check the highlighted fields';
  throw new HttpError(422, 'VALIDATION', first, fields);
}
export const pageParams = (c: Context, defaultSize = 7) => {
  const page = Math.max(1, Number.parseInt(c.req.query('page') ?? '1', 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(c.req.query('pageSize') ?? String(defaultSize), 10) || defaultSize));
  return { page, pageSize, offset: (page - 1) * pageSize };
};
