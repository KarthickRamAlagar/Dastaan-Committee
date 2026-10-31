import { WorkerMailer } from 'worker-mailer';
import { emailMode, type Bindings } from '../../env.js';
import { nowIso, run } from '../db.js';

export interface OutMail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
}
export interface Mailer {
  send(m: OutMail): Promise<void>;
  close(): Promise<void>;
}

const yes = (v: string | undefined, fallback: boolean) => (v == null || v.trim() === '' ? fallback : /^(true|1|yes|on)$/i.test(v.trim()));

/** Checks the SMTP values and says exactly what is missing, so a wrong .env is easy to fix. */
export function smtpSettings(env: Bindings) {
  const host = (env.SMTP_HOST ?? '').trim();
  const fromEmail = (env.SMTP_FROM_EMAIL ?? '').trim();
  const missing = [!host && 'SMTP_HOST', !fromEmail && 'SMTP_FROM_EMAIL'].filter(Boolean);
  if (missing.length) throw new Error(`Email is set to smtp but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} empty. Fill them in server/.env.`);
  const secure = yes(env.SMTP_SECURE, false);
  const port = Number(env.SMTP_PORT) || (secure ? 465 : 587);
  return { host, port, secure, startTls: !secure && yes(env.SMTP_START_TLS, true), fromEmail, fromName: (env.SMTP_FROM_NAME ?? env.APP_NAME ?? 'Dastaan').trim() };
}

/** One SMTP connection per queue batch. In development EMAIL_MODE=log writes to the dev outbox (and the console) instead. */
export async function openMailer(env: Bindings): Promise<Mailer> {
  const mode = emailMode(env);
  if (mode === 'off') {
    return {
      async send(m) { console.log(`[mail:off] not sent: to=${[...m.to, ...(m.bcc ?? [])].length} recipient(s) subject="${m.subject}"`); },
      async close() {},
    };
  }
  if (mode === 'log') {
    return {
      async send(m) {
        await run(env.DB, 'INSERT INTO dev_outbox (at, to_list, cc_list, subject, text) VALUES (?,?,?,?,?)', nowIso(), JSON.stringify([...m.to, ...(m.bcc ?? [])]), JSON.stringify(m.cc ?? []), m.subject, m.text);
        console.log(`[mail:log] to=${[...m.to, ...(m.bcc ?? [])].join(',')} subject="${m.subject}"\n${m.text}`);
      },
      async close() {},
    };
  }
  const c = smtpSettings(env);
  const mailer = await WorkerMailer.connect({
    host: c.host,
    port: c.port,
    secure: c.secure,
    startTls: c.startTls,
    credentials: env.SMTP_USER ? { username: env.SMTP_USER, password: env.SMTP_PASS ?? '' } : undefined,
    authType: ['plain', 'login'],
  });
  const from = { name: c.fromName, email: c.fromEmail };
  return {
    async send(m) {
      await mailer.send({
        from,
        to: m.to,
        cc: m.cc?.length ? m.cc : undefined,
        bcc: m.bcc?.length ? m.bcc : undefined,
        reply: m.replyTo ?? undefined,
        subject: m.subject,
        html: m.html,
        text: m.text,
      });
    },
    async close() {
      await mailer.close();
    },
  };
}

/** Sends one message straight away (not through the queue) so a wrong SMTP setting shows up as a clear error. */
export async function sendTestMail(env: Bindings, to: string): Promise<{ mode: 'smtp' | 'log' | 'off' }> {
  const mailer = await openMailer(env);
  try {
    const name = env.APP_NAME ?? 'Dastaan';
    await mailer.send({
      to: [to],
      subject: `${name}: test email`,
      text: `This is a test email from ${name}. If you can read it, sign-in codes and notifications will reach people.`,
      html: `<p style="font-family:Arial,sans-serif">This is a test email from <b>${name}</b>. If you can read it, sign-in codes and notifications will reach people.</p>`,
    });
  } finally {
    await mailer.close().catch(() => {});
  }
  return { mode: emailMode(env) };
}
