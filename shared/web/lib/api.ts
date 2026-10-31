import type { ApiErrorBody } from '@dastaan/shared';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

async function parse(res: Response) {
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Something went wrong. Please try again.', e?.fields);
  }
  return (json as { data: unknown } | null)?.data;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      credentials: 'same-origin',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
  return (await parse(res)) as T;
}
export const get = <T,>(p: string) => api<T>(p);
export const post = <T,>(p: string, body: unknown = {}) => api<T>(p, { method: 'POST', body });
export const patch = <T,>(p: string, body: unknown) => api<T>(p, { method: 'PATCH', body });
export const del = <T,>(p: string) => api<T>(p, { method: 'DELETE' });

export const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Upload with progress. fetch cannot report upload progress, so this uses XMLHttpRequest. */
export function uploadFile(
  file: Blob,
  opts: { kind: 'request' | 'handoff' | 'mail' | 'logo'; name: string; originalSize?: number; onProgress?: (pct: number) => void; signal?: AbortSignal },
): Promise<{ id: string; name: string; size: number; originalSize: number | null }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    const local = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    x.open('POST', `${local ? (process.env.NEXT_PUBLIC_UPLOAD_ORIGIN ?? '') : ''}/api/uploads?kind=${opts.kind}&name=${encodeURIComponent(opts.name)}`);
    x.withCredentials = true;
    x.setRequestHeader('Content-Type', 'application/octet-stream');
    if (opts.originalSize) x.setRequestHeader('X-Original-Size', String(opts.originalSize));
    x.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onerror = () => reject(new ApiError(0, 'NETWORK', 'The upload was interrupted. Check your connection and try again.'));
    x.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled'));
    x.onload = () => {
      try {
        const j = JSON.parse(x.responseText);
        if (x.status >= 200 && x.status < 300) resolve(j.data);
        else reject(new ApiError(x.status, j?.error?.code ?? 'ERROR', j?.error?.message ?? 'The upload failed'));
      } catch {
        reject(new ApiError(x.status, 'ERROR', 'The upload failed'));
      }
    };
    opts.signal?.addEventListener('abort', () => x.abort());
    x.send(file);
  });
}
