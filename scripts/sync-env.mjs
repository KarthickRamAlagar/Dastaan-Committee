// Local development: wrangler gives the Worker its settings from a .dev.vars file next to it.
// This copies the one root .env into others/api, so you only ever edit .env. Runs before `npm run dev:api`.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, '.env'))) { console.error('No .env found. Run: npm run setup'); process.exit(1); }
copyFileSync(join(root, '.env'), join(root, 'others', 'api', '.dev.vars'));
console.log('[env] .env -> others/api (.dev.vars)');
