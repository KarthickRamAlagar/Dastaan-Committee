import type { Bindings, MailJob } from '../../env.js';
import { all, first } from '../db.js';
import { signedFileUrl } from '../files.js';
import { broadcastMail, otpMail, ticketContextMail, userCreatedMail } from './templates.js';
import { ticketContext } from '../../services/tickets.js';
import { openMailer, type Mailer } from './send.js';

async function handle(env: Bindings, mailer: Mailer, job: MailJob) {
  if (job.type === 'otp') {
    const m = otpMail(env, job.name, job.code, job.welcome, job.role, job.to);
    await mailer.send({ to: [job.to], ...m });
  } else if (job.type === 'user-created') {
    const m = userCreatedMail(env, job.newUser, job.by);
    // Convenors are listed in "to" one by one so nobody's address is hidden from the others.
    await mailer.send({ to: job.to, ...m });
  } else if (job.type === 'ticket-context') {
    const [who, ctx] = [await first<{ email: string; name: string }>(env.DB, 'SELECT email, name FROM users WHERE id = ? AND deleted_at IS NULL', job.userId), await ticketContext(env.DB, job.ticketId)];
    if (!who || !ctx) return;
    const files = await Promise.all(ctx.ticket.fileList.map(async (f) => ({ name: f.name, size: f.size, fromCommittee: f.fromCommittee, url: await signedFileUrl(env, f.id, 14) })));
    const t = ctx.ticket;
    const m = ticketContextMail(env, { reason: job.reason, byName: job.byName, recipient: who.name, ticket: { id: t.id, code: t.code, title: t.title, details: t.details, priority: t.priority, neededBy: t.neededBy, requesterName: t.requesterName, fromCommittee: t.fromCommittee, toCommittee: t.toCommittee }, history: ctx.history, files });
    await mailer.send({ to: [who.email], ...m });
  } else if (job.type === 'broadcast') {
    const mail = await first<{ subject: string; body: string; sender_name: string; sender_role: string }>(
      env.DB,
      `SELECT m.subject, m.body, u.name AS sender_name, u.role AS sender_role FROM mail_log m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
      job.mailId,
    );
    if (!mail) return; // the mail was removed, nothing to send
    const files = await all<{ id: string; name: string; size: number }>(env.DB, 'SELECT id, name, size FROM attachments WHERE mail_id = ?', job.mailId);
    const withUrls = await Promise.all(files.map(async (f) => ({ name: f.name, size: f.size, url: await signedFileUrl(env, f.id, 14) })));
    const roleLabel = mail.sender_role === 'convenor' ? 'Convenor' : 'Committee Lead';
    const m = broadcastMail(env, { subject: mail.subject, body: mail.body, senderName: mail.sender_name, senderRole: roleLabel }, withUrls);
    // To: the sender's own copy is not needed; BCC keeps the recipient list private.
    await mailer.send({ to: [env.SMTP_FROM_EMAIL || 'noreply@dastaan.invalid'], bcc: job.bcc, cc: job.cc, replyTo: job.replyTo, ...m });
  }
}

export async function consumeMail(batch: MessageBatch<MailJob>, env: Bindings) {
  let mailer: Mailer;
  try {
    mailer = await openMailer(env);
  } catch (e) {
    console.error('smtp connect failed', e);
    batch.retryAll({ delaySeconds: 30 });
    return;
  }
  try {
    for (const msg of batch.messages) {
      try {
        await handle(env, mailer, msg.body);
        msg.ack();
      } catch (e) {
        console.error('mail job failed', msg.body.type, e);
        msg.retry({ delaySeconds: Math.min(600, 15 * 2 ** msg.attempts) });
      }
    }
  } finally {
    await mailer.close().catch(() => {});
  }
}

/** Sends one job right now (used when no queue is connected). Tries a few times, then logs and gives up. */
async function deliverNow(env: Bindings, jobs: MailJob[]) {
  for (const job of jobs) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let mailer: Mailer | null = null;
      try {
        mailer = await openMailer(env);
        await handle(env, mailer, job);
        break;
      } catch (e) {
        console.error(`mail job ${job.type} failed (attempt ${attempt + 1} of 3)`, e);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      } finally {
        await mailer?.close().catch(() => {});
      }
    }
  }
}

/**
 * Sends mail jobs. With a queue connected they go to the queue (retried by Cloudflare). Without one they are sent directly:
 * in the background when `waitUntil` is given, otherwise before this call returns (sign-in codes use that, so the code is on its way
 * before the page says "sent").
 */
export async function sendMail(env: Bindings, jobs: MailJob | MailJob[], waitUntil?: (p: Promise<unknown>) => void) {
  const list = Array.isArray(jobs) ? jobs : [jobs];
  if (env.MAIL_QUEUE) {
    for (const j of list) await env.MAIL_QUEUE.send(j);
    return;
  }
  const work = deliverNow(env, list);
  if (waitUntil) waitUntil(work);
  else await work;
}
