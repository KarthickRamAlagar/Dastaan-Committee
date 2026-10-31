# database

The one database (Cloudflare D1, named `dastaan`) that all three APIs use.

- `migrations/` the schema, applied in order. **Only this folder changes the schema.** The three APIs never run migrations.
- `seed/seed.sql` the 6 committees and 22 sub-committees (safe to run on production)
- `seed/dev-users.sql` sample people and requests (local only)
- `seed/clean.sql`, `seed/reset.sql` wipe data (local only)
- `seed/people.csv` the real member list; `npm run db:people` turns it into accounts; `npm run db:import -- file.xlsx` clears everything and loads an Excel/CSV list

All commands are npm scripts at the root: see the README there.
