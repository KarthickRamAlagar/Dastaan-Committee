// First-time setup: creates .env and the web .env.local from their examples. Never overwrites an existing file.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pairs = [
  ['.env.example', '.env'],
  ['others/web/.env.example', 'others/web/.env.local'],
];
for (const [src, dst] of pairs) {
  if (existsSync(join(root, dst))) console.log(`kept     ${dst}`);
  else { copyFileSync(join(root, src), join(root, dst)); console.log(`created  ${dst}`); }
}
console.log('\nNext: open .env in the root folder and fill in the admin and SMTP values.');
