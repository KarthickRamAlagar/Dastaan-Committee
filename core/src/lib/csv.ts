/** CSV with protection against spreadsheet formula injection. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; title: string }[]): string {
  const cell = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [columns.map((c) => cell(c.title)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c.key])).join(','));
  return '﻿' + lines.join('\r\n');
}
