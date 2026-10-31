// Writes the sign-in code email to .data/otp-preview.html so you can open it in a browser:  npm run mail:preview
// Optional: npm run mail:preview -- https://public-address   (where the logos load from)
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.data', '_templates.mjs');
mkdirSync(join(root, '.data'), { recursive: true });
await build({ entryPoints: [join(root, 'core/src/lib/mail/templates.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { otpMail } = await import(pathToFileURL(out).href);

const assets = process.argv[2] ?? pathToFileURL(join(root, 'shared/web/public')).href;
const env = { APP_NAME: 'Dastaan', APP_TAGLINE: 'Multi Fest coordination', OTHERS_ORIGIN: 'http://localhost:3000', CONVENOR_ORIGIN: 'http://localhost:3001', ADMIN_ORIGIN: 'http://localhost:3002', MAIL_ASSET_URL: assets };
const code = String(Math.floor(100000 + Math.random() * 900000));
const m = otpMail(env, 'Anika Rao', code, undefined, 'lead', 'anika@example.com');
const w = otpMail(env, 'Anika Rao', code, { by: 'Karthi', role: 'Member', committee: 'Events' }, 'lead', 'anika@example.com');
writeFileSync(join(root, '.data', 'otp-preview.html'), m.html);
writeFileSync(join(root, '.data', 'otp-preview-welcome.html'), w.html);
console.log(`Subject: ${m.subject}\nWritten: .data/otp-preview.html  (and otp-preview-welcome.html)`);
