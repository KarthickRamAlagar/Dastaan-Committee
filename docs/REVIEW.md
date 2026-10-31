# Review guide (for the club review)

## 1. Five-minute story

1. **What it is.** One place where committees ask each other for work and everyone can see who has it now.
2. **Three apps, one system.** Convenor, Admin, and Committee (Leads and Members) each have their own app and their own server. They share one database, so what one person does appears for the others at once.
3. **Why separate apps.** Each group sees only what it needs. A Lead's login cannot reach Admin or Convenor features, even by hand, because those servers refuse it.
4. **Safe sign-in.** A 6-digit code is emailed. The Admin uses a password. People who open the wrong app are told where to go.
5. **Reliable email.** Mail is sent in the background with retries, so a slow mail server never slows the site.

## 2. Demo order (about 10 minutes)

| Step | App | Do |
|---|---|---|
| 1 | Admin (3002) | Sign in with the password. People list. Click **Send test email**. |
| 2 | Admin | Create a Committee Lead (shows the welcome email going out). |
| 3 | Others (3000) | Sign in as a Lead (`events.lead@dastaan.test`). Raise a request to Media, High priority, with a file. |
| 4 | Others | Sign in as the Media Lead in a private window. Accept it, assign it to a member. |
| 5 | Others | Sign in as the member. Press **Work done**. |
| 6 | Others | Media Lead marks it Done, then forwards it to Marketing. |
| 7 | Convenor (3001) | Sign in as `convenor@dastaan.test`. Show Workflows and the full history. Ask for a Redo. |
| 8 | Any | Type a Lead's email into the Convenor app: it points to the right app. |

Sign-in codes appear in the terminal running the APIs while `EMAIL_MODE=log`. With `EMAIL_MODE=smtp` they arrive by email.

## 3. Likely questions

**Why one database for three servers?** One source of truth: no copying data between apps, no mismatches. Cloudflare D1 handles the load of a fest easily (see HLD section 5).

**What if the database is busy?** Writes are tiny and run in turn, in milliseconds. Reads are indexed and paginated. The expensive work (email, cleanup) is off the request path.

**Can one app break another?** Each app is its own deployment. A fault in the Admin app does not stop Leads from working.

**Can we use our own email design?** Yes. SMTP only carries the message; the design is our HTML. Share a reference image and the template (`core/src/lib/mail/templates.ts`) is matched to it. Email clients allow simple HTML only (tables, inline styles), so the result is a faithful match rather than pixel-perfect animation. Logos need a public web address (the production domain).

**How do new members get in?** The member list is loaded from a spreadsheet (`database/seed/people.csv`). People enter their email in their app and receive a code. No passwords to hand out.

**What does it cost to run?** Cloudflare Workers, D1, R2 and Queues for a fest of this size fit within low-cost plans; check the current Cloudflare pricing page before the review.

## 4. Before the review

- [ ] `npm run db:reset` for a clean demo database (local only)
- [ ] `npm run dev` and open the three apps
- [ ] `NEXT_PUBLIC_DEV_TOOLS=false` in each `*/web/.env.local`
- [ ] If showing real email: `EMAIL_MODE=smtp`, then `npm run mail:test -- <your email>`
- [ ] Browser windows: normal window for one role, private window for another
