import { format, formatDistanceToNowStrict, isSameDay, isValid, parseISO } from 'date-fns';

const d = (v?: string | null) => {
  if (!v) return null;
  const x = parseISO(v);
  return isValid(x) ? x : null;
};
export const fDate = (v?: string | null) => { const x = d(v); return x ? format(x, 'd MMM yyyy') : '—'; };
export const fTime = (v?: string | null) => { const x = d(v); return x ? format(x, 'h:mm a') : ''; };
export const fDateTime = (v?: string | null) => { const x = d(v); return x ? format(x, 'd MMM yyyy, h:mm a') : '—'; };
export const fShort = (v?: string | null) => { const x = d(v); return x ? format(x, 'd MMM') : '—'; };
export const ago = (v?: string | null) => { const x = d(v); return x ? `${formatDistanceToNowStrict(x)} ago` : ''; };
export const dayLabel = (v?: string | null) => { const x = d(v); if (!x) return ''; return isSameDay(x, new Date()) ? 'Today' : format(x, 'EEE d MMM'); };
export const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
/** <input type="datetime-local"> value → ISO */
export const localToIso = (v: string) => { const x = new Date(v); return isValid(x) ? x.toISOString() : ''; };
export const nextHourLocal = () => { const x = new Date(Date.now() + 86_400_000); x.setMinutes(0, 0, 0); return format(x, "yyyy-MM-dd'T'HH:mm"); };
