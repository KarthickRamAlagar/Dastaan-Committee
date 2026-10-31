// Loads the real people into the database from an Excel (.xlsx) or CSV file.
//
//   npm run db:import -- "C:/path/members.xlsx"      CLEAR everything (sample people, requests, files, emails, logs) and load this list
//   npm run db:people                                 add/update people from database/seed/people.csv (clears nothing)
//   add  -- --dry-run  to check the file without saving anything
//   add  :prod  to the command name (db:import:prod) to do the same on the real Cloudflare database (asks you to confirm first)
//
// The file needs a header row. Column names are matched by meaning, so "Name", "College Email", "Phone",
// "Committee" and "Committee Lead / Convenor" all work. Every row is checked first; if anything is wrong nothing is touched.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const prod = flag('--prod');
const clear = flag('--clear');
const dry = flag('--dry-run');
const sheetArg = args.find((a) => a.startsWith('--sheet='))?.slice(8);
const fileArg = args.find((a) => !a.startsWith('--'));
const file = fileArg ? resolve(fileArg) : join(root, 'database/seed/people.csv');
const fail = (msg) => { console.error(msg); process.exit(1); };

// ---------- reading the file ----------
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const readCsv = (buf) => buf.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).map(parseCsvLine);

const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
  const k = e.toLowerCase();
  if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>'; if (k === 'quot') return '"'; if (k === 'apos') return "'";
  return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
});
/** Minimal .xlsx reader (a zip of XML files), so no extra package is needed. */
function readXlsx(buf, wantedSheet) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) fail('This does not look like an .xlsx file. Open it in Excel and use Save As, then choose "Excel Workbook (*.xlsx)" or "CSV".');
  const entries = new Map();
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nlen), { method, csize, off });
    p += 46 + nlen + xlen + clen;
  }
  const read = (name) => {
    const e = entries.get(name); if (!e) return null;
    const start = e.off + 30 + buf.readUInt16LE(e.off + 26) + buf.readUInt16LE(e.off + 28);
    const data = buf.subarray(start, start + e.csize);
    return (e.method === 0 ? data : inflateRawSync(data)).toString('utf8');
  };
  const wb = read('xl/workbook.xml'); if (!wb) fail('Could not read this workbook. Save it again as .xlsx or CSV.');
  const rels = read('xl/_rels/workbook.xml.rels') ?? '';
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({ name: unxml(/name="([^"]*)"/.exec(m[0])?.[1] ?? ''), rid: /r:id="([^"]*)"/.exec(m[0])?.[1] }));
  const sheet = (wantedSheet && sheets.find((s) => s.name.toLowerCase() === wantedSheet.toLowerCase())) || sheets[0];
  if (!sheet) fail('The workbook has no sheets.');
  const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => new RegExp(`Id="${sheet.rid}"`).test(r));
  let target = /Target="([^"]*)"/.exec(rel ?? '')?.[1] ?? 'worksheets/sheet1.xml';
  target = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const shared = [];
  for (const si of (read('xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
    shared.push(unxml([...si[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
  const xml = read(target); if (!xml) fail(`Could not find the sheet "${sheet.name}" inside the workbook.`);
  const col = (ref) => [...ref.replace(/\d+/g, '')].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells = []; let last = -1;
    for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+\d+)"/.exec(c[1])?.[1]; const idx = ref ? col(ref) : last + 1; last = idx;
      const t = /\bt="(\w+)"/.exec(c[1])?.[1] ?? 'n'; const inner = c[2] ?? '';
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let val = '';
      if (t === 's') val = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') val = unxml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
      else if (t === 'str') val = unxml(v ?? '');
      else if (t === 'b' || t === 'e') val = '';
      else if (v != null) { const num = Number(v); val = Number.isFinite(num) && Number.isInteger(num) ? String(num) : v; }
      cells[idx] = val.trim();
    }
    rows.push(Array.from(cells, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((x) => x !== ''));
}
function readTable(path) {
  if (!existsSync(path)) fail(`File not found: ${path}\nTip: drag the file into the terminal to paste its path, or put it in the project folder and use its short name.`);
  const buf = readFileSync(path);
  const ext = extname(path).toLowerCase();
  if (ext === '.xlsx' || ext === '.xlsm') return readXlsx(buf, sheetArg);
  if (ext === '.csv' || ext === '.txt') return readCsv(buf);
  if (ext === '.xls') fail('Old .xls files cannot be read. Open it in Excel, choose Save As, and pick "Excel Workbook (*.xlsx)" or "CSV".');
  fail(`Unsupported file type "${ext}". Use .xlsx or .csv.`);
}

// ---------- committees come from seed.sql, so the two can never disagree ----------
const seed = readFileSync(join(root, 'database/seed/seed.sql'), 'utf8');
const committees = new Map(); // lower name -> id
for (const m of seed.matchAll(/\('(cmt-[a-z-]+)',\s*'([^']+)',/g)) committees.set(m[2].toLowerCase(), m[1]);
const subs = new Map(); // committee id -> Map(lower name -> name)
for (const m of seed.matchAll(/\('sub-[a-z-]+-\d+',\s*'(cmt-[a-z-]+)',\s*'([^']+)'/g)) {
  if (!subs.has(m[1])) subs.set(m[1], new Map());
  subs.get(m[1]).set(m[2].toLowerCase(), m[2]);
}
const committeeNames = [...committees.keys()].map((k) => k[0].toUpperCase() + k.slice(1));
const collegeOnly = !/^COLLEGE_EMAIL_ONLY\s*=\s*['"]?(false|0|no|off)/im.test(existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '');
const COLLEGE = /^bl\.[a-z0-9][a-z0-9._-]*@bl\.students\.amrita\.edu$/;

// ---------- understanding the columns ----------
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function mapColumns(header) {
  const idx = {};
  header.forEach((h, i) => {
    const k = norm(h); let f = null;
    if (/\bsub\b|subcommittee/.test(k)) f = 'sub';
    else if (/mail/.test(k)) f = 'email';
    else if (/phone|mobile|contact|whatsapp/.test(k)) f = 'phone';
    else if (/lead|convenor|conveyor|convener|designation|role|position/.test(k)) f = 'role';
    else if (/committee|team|department|\bdept\b/.test(k)) f = 'committee';
    else if (/name/.test(k)) f = 'name';
    if (f && idx[f] === undefined) idx[f] = i;
  });
  return idx;
}
const roleOf = (t) => {
  const k = norm(t);
  if (/convenor|conveyor|convener/.test(k)) return 'convenor';
  if (/\blead\b|\bhead\b|\bcl\b/.test(k)) return 'lead';
  if (k === '' || /member|volunteer/.test(k)) return 'member';
  return null;
};
const committeeKey = (t) => norm(t).replace(/\b(committee|team|department)\b/g, '').trim();

// ---------- checking every row ----------
const table = readTable(file);
if (table.length < 2) fail(`${file}\nhas no people yet (it needs a header row and at least one person).`);
// The header is the first row (within the first 10) that has both a name and an email column, so title rows above it are fine.
let hi = table.slice(0, 10).findIndex((r) => { const m = mapColumns(r); return m.name !== undefined && m.email !== undefined; });
if (hi < 0) hi = 0;
const header = table[hi];
const cols = mapColumns(header);
const missing = ['name', 'email', 'role'].filter((f) => cols[f] === undefined);
if (missing.length) fail(`Could not find the ${missing.map((m) => ({ name: '"Name"', email: '"Email"', role: '"Lead / Convenor" (role)' })[m]).join(', ')} column in the first row.\nThe columns I found: ${header.filter(Boolean).join(' | ') || '(none)'}\nRename the header cells to contain: Name, Email, and Committee Lead/Convenor (role). Optional: Phone, Committee, Sub-committee.`);

const problems = [], warnings = [], people = [], seen = new Map(), leadOf = new Map();
table.slice(hi + 1).forEach((r, i) => {
  const n = hi + i + 2;
  const cell = (f) => (cols[f] === undefined ? '' : String(r[cols[f]] ?? '').trim());
  const name = cell('name').replace(/\s+/g, ' ');
  const email = cell('email').toLowerCase();
  const roleRaw = cell('role');
  if (!name && !email && !roleRaw) return; // blank row
  const bad = (m) => problems.push(`row ${n} (${name || email || 'blank'}): ${m}`);
  if (!name) bad('name is empty');
  if (!/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(email)) bad(`"${cell('email')}" is not an email`);
  else if (collegeOnly && !COLLEGE.test(email)) bad(`"${email}" is not a college email (bl.…@bl.students.amrita.edu)`);
  if (seen.has(email)) bad(`same email as row ${seen.get(email)}`); else seen.set(email, n);
  const role = roleOf(roleRaw);
  if (!role) bad(`could not tell the role from "${roleRaw}". Use Convenor, Lead or Member (or leave it empty for a member)`);
  let phone = cell('phone');
  if (phone && !/^[+]?[0-9 ()-]{7,18}$/.test(phone)) { bad(`phone "${phone}" is not valid (7 to 18 digits, may start with +)`); phone = ''; }
  let cid = null, sub = null;
  if (role === 'lead' || role === 'member') {
    let ckey = committeeKey(cell('committee'));
    if (!ckey) { const found = [...committees.keys()].find((c) => norm(roleRaw).includes(c)); if (found) ckey = found; } // "Events Lead" in the role cell
    cid = committees.get(ckey) ?? null;
    if (!cid) bad(`committee "${cell('committee')}" is not one of: ${committeeNames.join(', ')}`);
    if (role === 'lead' && cid && !leadOf.has(cid)) leadOf.set(cid, n); // a committee can have several Leads
    if (cid) {
      const sraw = cell('sub');
      if (sraw) { sub = subs.get(cid)?.get(sraw.toLowerCase()) ?? null; if (!sub) bad(`sub-committee "${sraw}" is not one of: ${[...(subs.get(cid)?.values() ?? [])].join(', ')}`); }
    }
  }
  people.push({ id: 'u-' + createHash('sha1').update(email).digest('hex').slice(0, 12), name, email, phone, role: role ?? 'member', cid, sub });
});
if (!people.length) fail('No people found below the header row.');
if (problems.length) fail(`Found ${problems.length} problem(s) in ${file}. NOTHING was changed.\n - ${problems.join('\n - ')}\n\nFix the file and run the command again.`);

const count = (r) => people.filter((p) => p.role === r).length;
const noSub = people.filter((p) => (p.role === 'member' || p.role === 'lead') && !p.sub).length;
const missingLead = [...committees.entries()].filter(([, id]) => !leadOf.has(id)).map(([k]) => k[0].toUpperCase() + k.slice(1));
console.log(`File: ${file}\n${people.length} people: ${count('convenor')} convenor(s), ${count('lead')} lead(s), ${count('member')} member(s).`);
if (noSub) console.log(`Note: ${noSub} person(s) have no sub-committee. That is fine; it can be set later under Team or People.`);
if (missingLead.length) console.log(`Note: no Lead listed for: ${missingLead.join(', ')}.`);
if (dry) { console.log(`Dry run: nothing was ${clear ? 'cleared or ' : ''}saved.`); process.exit(0); }

// ---------- saving ----------
const q = (v) => (v == null || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const insert = people.map((p) =>
  `INSERT INTO users (id, name, email, phone, role, committee_id, sub_committee, created_at) VALUES (${q(p.id)}, ${q(p.name)}, ${q(p.email)}, ${p.phone ? q(p.phone) : "''"}, ${q(p.role)}, ${q(p.cid)}, ${q(p.sub)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))\n` +
  `ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone, role = excluded.role, committee_id = excluded.committee_id, sub_committee = excluded.sub_committee, deleted_at = NULL WHERE users.source = 'db';`).join('\n');
const wipe = readFileSync(join(root, 'database/seed/clean.sql'), 'utf8');
const sql = (clear ? `${wipe}\n` : '') + insert;

if (clear) {
  console.log(`\nThis will DELETE ${prod ? 'EVERYTHING in the PRODUCTION database' : 'all sample people, requests, files, emails and logs in the local database'} and then load the ${people.length} people above.`);
  if (prod) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = (await rl.question('Type  DELETE EVERYTHING  to continue: ')).trim(); rl.close();
    if (a !== 'DELETE EVERYTHING') fail('Cancelled. Nothing was changed.');
  }
}
const tmp = join(root, '.import.tmp.sql');
writeFileSync(tmp, sql);
try {
  const target = prod ? ['--remote'] : ['--local', '--persist-to', '.data'];
  // Bring the database structure up to date first (for example, several Leads per committee needs migration 0005).
  console.log('Checking the database structure...');
  execFileSync('npx', ['wrangler', 'd1', 'migrations', 'apply', 'dastaan', '--config', 'database/wrangler.json', ...target], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'dastaan', '--config', 'database/wrangler.json', ...target, '--file', tmp, ...(prod ? ['--yes'] : [])], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  console.log(`\nDone. ${clear ? 'The database was cleared and ' : ''}${people.length} people were saved to the ${prod ? 'PRODUCTION' : 'local'} database.\nEveryone signs in with their college email and the code sent to it. The Admin signs in again (all sessions were ${clear ? 'cleared' : 'kept'}).${clear ? '\nIf you have the app open, sign out and sign in again.' : ''}`);
} finally { rmSync(tmp, { force: true }); }
