// Sends one test email through the running local server:  npm run mail:test -- you@example.com
// Start the server first (npm run dev:server). It uses the same path as sign-in codes, so it proves SMTP works.
const to = process.argv[2];
const base = process.env.API_URL ?? 'http://localhost:8787/others/api';
if (!to) { console.error('Usage: npm run mail:test -- you@example.com'); process.exit(1); }
const res = await fetch(`${base}/dev/test-mail`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' }, body: JSON.stringify({ to }) }).catch((e) => {
  console.error(`Cannot reach ${base}. Is the server running? (npm run dev:server)\n${e.message}`); process.exit(1);
});
const json = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`FAILED (${res.status}): ${json?.error?.message ?? 'unknown error'}`); process.exit(1); }
const { mode } = json.data;
console.log(mode === 'smtp' ? `Sent to ${to} through your SMTP server. Check the inbox (and spam).` : mode === 'log' ? 'Mode is "log": nothing was emailed. Set SMTP_HOST in server/.env to send for real.' : 'Mode is "off": email is switched off.');
