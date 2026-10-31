// Copies the shared logos, icons, service worker and offline page into one client's public/ folder.
// Runs automatically before dev, build and cf:build:  node ../scripts/sync-assets.mjs <client>
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = process.argv[2];
if (!client || !existsSync(join(root, client))) {
  console.error('Usage: node scripts/sync-assets.mjs <convenor|admin|others>');
  process.exit(1);
}
const from = join(root, 'shared', 'web', 'public');
const to = join(root, client, 'web', 'public');
cpSync(from, to, { recursive: true, force: true });
console.log(`[assets] shared/web/public -> ${client}/web/public`);
