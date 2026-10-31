import { describe, expect, it } from 'vitest';
import { ticketCan } from '../src/services/access.js';
import { toCsv } from '../src/lib/csv.js';
import { magicMatches } from '../src/lib/files.js';
import type { SessionUser } from '../src/env.js';

const user = (role: SessionUser['role'], committeeId: string | null = null): SessionUser => ({ id: 'u1', name: 'T', email: 't@x.test', phone: '', role, committeeId, committeeName: null, source: 'db' });
const ticket = (status: 'pending' | 'in_progress' | 'done', to = 'A', assigneeId: string | null = null) => ({ status, toCommitteeId: to, assigneeId });

describe('ticketCan (zero trust)', () => {
  it('lets only the holding committee Lead change status', () => {
    expect(ticketCan(user('lead', 'A'), ticket('pending')).changeStatus).toBe(true);
    expect(ticketCan(user('lead', 'B'), ticket('pending')).changeStatus).toBe(false);
    expect(ticketCan(user('member', 'A'), ticket('pending')).changeStatus).toBe(false);
    expect(ticketCan(user('convenor'), ticket('pending')).changeStatus).toBe(false);
    expect(ticketCan(user('admin'), ticket('pending')).changeStatus).toBe(false);
  });
  it('allows forwarding only when Done and only by the holding Lead', () => {
    expect(ticketCan(user('lead', 'A'), ticket('in_progress')).forward).toBe(false);
    expect(ticketCan(user('lead', 'A'), ticket('done')).forward).toBe(true);
    expect(ticketCan(user('lead', 'B'), ticket('done')).forward).toBe(false);
  });
  it('lets the Convenor comment (the Done rule is enforced where the comment is stored)', () => {
    expect(ticketCan(user('convenor'), ticket('done')).comment).toBe(true);
    expect(ticketCan(user('lead', 'A'), ticket('done')).comment).toBe(false);
  });
  it('allows Convenor Redo only on Done work', () => {
    expect(ticketCan(user('convenor'), ticket('done')).redo).toBe(true);
    expect(ticketCan(user('convenor'), ticket('pending')).redo).toBe(false);
  });
});

describe('toCsv', () => {
  it('neutralises spreadsheet formulas and escapes quotes', () => {
    const out = toCsv([{ a: '=HYPERLINK("x")', b: 'say "hi"' }], [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }]);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain('"say ""hi"""');
  });
  it('writes null as an empty cell', () => {
    expect(toCsv([{ a: null }], [{ key: 'a', title: 'A' }])).toContain('\r\n""');
  });
});

describe('magicMatches', () => {
  const b = (...n: number[]) => Uint8Array.from(n);
  it('accepts real files', () => {
    expect(magicMatches('jpg', b(0xff, 0xd8, 0xff))).toBe(true);
    expect(magicMatches('png', b(0x89, 0x50, 0x4e, 0x47))).toBe(true);
    expect(magicMatches('pdf', new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(magicMatches('docx', b(0x50, 0x4b, 3, 4))).toBe(true);
  });
  it('rejects a program renamed as a picture or document', () => {
    const exe = new TextEncoder().encode('MZ\x90\x00');
    for (const ext of ['jpg', 'png', 'pdf', 'docx', 'doc', 'gif', 'webp']) expect(magicMatches(ext, exe)).toBe(false);
  });
});

describe('college email rule', () => {
  const env = (extra: Record<string, string> = {}) => ({ ADMIN_EMAILS: 'boss@gmail.com', ...extra }) as never;
  it('accepts bl.<anything>@bl.students.amrita.edu and nothing else', async () => {
    const { emailAllowed } = await import('../src/lib/college-email.js');
    expect(emailAllowed(env(), 'bl.sc.p2dsc26034@bl.students.amrita.edu')).toBe(true);
    expect(emailAllowed(env(), 'BL.EN.U4CSE24001@bl.students.amrita.edu')).toBe(true);
    for (const bad of ['karthi@gmail.com', 'sc.p2dsc26034@bl.students.amrita.edu', 'bl.sc@students.amrita.edu', 'bl.sc@bl.students.amrita.edu.evil.com', 'xbl.sc@bl.students.amrita.edu', 'bl.@bl.students.amrita.edu'])
      expect(emailAllowed(env(), bad)).toBe(false);
  });
  it('always allows the admin emails, and can be switched off for testing', async () => {
    const { emailAllowed } = await import('../src/lib/college-email.js');
    expect(emailAllowed(env(), 'boss@gmail.com')).toBe(true);
    expect(emailAllowed(env({ COLLEGE_EMAIL_ONLY: 'false' }), 'someone@dastaan.test')).toBe(true);
  });
});
