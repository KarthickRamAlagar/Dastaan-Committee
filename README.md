# Dastaan-Committee

The Dastaan app for Committee Leads and Members. Committee Leads raise, work on and forward requests. Members do the work they are given. This is the "others" app of the main project.

This is one of three repositories. The other two are **Dastaan-Convenor** and **Dastaan-Admin**. All three use the **same Cloudflare database (`dastaan`) and file bucket (`dastaan-files`)**, so a person created in one app can sign in to their own app.

| Folder | What it is |
|---|---|
| `others/web` | The web app (Next.js), port 3000 |
| `others/api` | Its API (Cloudflare Worker), port 8787 |
| `core` | Server logic shared by all three APIs |
| `shared` | UI pages, components and types shared by all three apps |
| `database` | Migrations and seed data for the one shared database |
| `scripts` | Setup, people import, email tests |

## Run it on your computer

```bash
npm install
npm run setup          # creates .env and others/web/.env.local
# open .env and fill in ADMIN_EMAILS, ADMIN_PASSWORD, SESSION_SECRET and the email values
npm run db:migrate
npm run db:seed
npm run db:import -- path/to/people.xlsx     # loads the real people (or: npm run db:sample for test accounts)
npm run dev            # api on http://localhost:8787, web on http://localhost:3000
```

Use `EMAIL_MODE=log` in `.env` while testing, so nobody is emailed and the sign-in code prints in the terminal.

This repository keeps its **own local database** in `.data`. To try several roles on one computer, load the same people file in each repository, or run the combined project.

## Deploy

```bash
npm run db:migrate:prod     # only from ONE repository; the database is shared
npm run secrets             # send the .env values to this app's API. Send the same values from the other two repositories
npm run deploy
```

## Keeping the three in step

`core`, `shared` and `database` are copies. A change to them must reach all three repositories, and a new migration must be applied only once. The three repositories are generated from the combined project with `node scripts/split-repos.mjs <folder>`; change the code there and generate again.

More detail is in `docs/`. Never commit `.env`.
