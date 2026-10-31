// Sends the credentials in .env to the API on Cloudflare as encrypted secrets:  npm run secrets
// Only the listed keys are sent. ENVIRONMENT and the three *_ORIGIN values are NOT sent: they live in each api/wrangler.json (production values).
// IMPORTANT: the SAME values must be sent to the other two Dastaan repositories too (a signed file link made by one API must verify on another).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = root;
const envFile = join(dir, '.env');
if (!existsSync(envFile)) { console.error('The .env file was not found. Run: npm run setup'); process.exit(1); }

const KEYS = ['SESSION_SECRET', 'ADMIN_PASSWORD', 'ADMIN_EMAILS', 'LOGIN_OTP', 'EMAIL_MODE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_START_TLS', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL', 'SMTP_FROM_NAME'];
const values = {};
for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m || !KEYS.includes(m[1])) continue;
  const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
  if (v !== '') values[m[1]] = v;
}
const problems = [];
if (!values.SESSION_SECRET || values.SESSION_SECRET.length < 32) problems.push('SESSION_SECRET must be at least 32 characters (node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")');
if (!values.ADMIN_PASSWORD || values.ADMIN_PASSWORD.length < 12) problems.push('ADMIN_PASSWORD must be at least 12 characters');
if (!values.ADMIN_EMAILS) problems.push('ADMIN_EMAILS is empty');
if ((values.EMAIL_MODE ?? (values.SMTP_HOST ? 'smtp' : 'off')) === 'smtp' && (!values.SMTP_HOST || !values.SMTP_FROM_EMAIL)) problems.push('SMTP_HOST and SMTP_FROM_EMAIL are needed when email is on');
if (values.LOGIN_OTP === 'false') console.warn('WARNING: LOGIN_OTP=false lets anyone with a registered email sign in without a code. Use it for testing only.');
if (problems.length) { console.error('Fix these in .env first:\n - ' + problems.join('\n - ')); process.exit(1); }

const tmp = join(root, '.secrets.tmp.json');
writeFileSync(tmp, JSON.stringify(values));
try {
  for (const app of ['others']) {
    console.log(`\n== ${app}-api`);
    execFileSync('npx', ['wrangler', 'secret', 'bulk', tmp], { cwd: join(root, app, 'api'), stdio: 'inherit', shell: process.platform === 'win32' });
  }
  console.log(`\nSent ${Object.keys(values).length} secrets to the API: ${Object.keys(values).join(', ')}`);
} finally { rmSync(tmp, { force: true }); }
