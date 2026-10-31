import { OTP_MINUTES } from '@dastaan/shared';
import { portalOrigin, type Bindings, type SessionUser } from '../../env.js';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function shell(env: Bindings, title: string, inner: string): string {
  const name = esc(env.APP_NAME);
  return `<!doctype html><html><body style="margin:0;background:#14100c;padding:24px;font-family:Segoe UI,Arial,sans-serif;color:#f4ece1">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#1f1812;border:1px solid #3a2c1e;border-radius:16px;overflow:hidden">
<tr><td style="padding:20px 28px;background:#2a1f15;border-bottom:1px solid #3a2c1e"><span style="font-size:20px;font-weight:700;color:#fbbf24">${name}</span><span style="color:#b9a58c;font-size:13px;margin-left:8px">${esc(env.APP_TAGLINE ?? 'Fest coordination')}</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 14px;font-size:20px;color:#fff">${esc(title)}</h1>${inner}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #3a2c1e;color:#9c8870;font-size:12px">Sent by ${name}. If this was not meant for you, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (s: string) => `<p style="margin:0 0 12px;line-height:1.55;color:#e8dccb;font-size:15px">${s}</p>`;
const link = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:6px 0 14px;padding:11px 20px;background:#f59e0b;color:#1a1208;font-weight:700;text-decoration:none;border-radius:10px">${esc(label)}</a>`;

/** Where the logos in emails are loaded from. Emails are read outside the app, so this must be a public https address in production. */
const assetBase = (env: Bindings, role?: SessionUser['role']) => (env.MAIL_ASSET_URL?.trim() || portalOrigin(env, role)).replace(/\/+$/, '');

const FONT = "Inter,'Segoe UI',Helvetica,Arial,sans-serif";
const ROW = 1.6; // height of one digit, in em, so the animation lands on the right digit at any font size

/** One rolling digit: the real digit comes first (so it is what shows without animation), the filler digits sit below it. */
function rollingSlot(digit: string, i: number) {
  const d = Number(digit);
  const fillers = 12 + i * 3;
  const rows = [d, ...Array.from({ length: fillers }, (_, j) => (d + 1 + j * 7 + i * 3) % 10)];
  const cells = rows.map((n, k) => `<span ${k ? 'aria-hidden="true" ' : ''}style="display:block;height:${ROW}em;line-height:${ROW}em">${n}</span>`).join('');
  return `<span class="slot" style="display:inline-block;vertical-align:top;width:1.15em;height:${ROW}em;margin:0 3px;overflow:hidden;font-size:40px;font-weight:700;font-family:${FONT};color:#fbbf24;background:#1f1710;border:1px solid #4a3520;border-radius:10px;text-align:center"><span class="strip s${i}" style="display:block">${cells}</span></span>`;
}
const keyframes = (n: number) =>
  Array.from({ length: n }, (_, i) => `@keyframes roll${i}{from{margin-top:-${((12 + i * 3) * ROW).toFixed(1)}em}to{margin-top:0}}.s${i}{animation:roll${i} ${(1.7 + i * 0.35).toFixed(2)}s cubic-bezier(.12,.85,.25,1) ${(i * 0.12).toFixed(2)}s 1 both}`).join('');

export function otpMail(
  env: Bindings,
  name: string,
  code: string,
  welcome?: { by: string; role: string; committee: string | null },
  role?: SessionUser['role'],
  email?: string,
) {
  const app = esc(env.APP_NAME ?? 'Dastaan');
  const tagline = esc(env.APP_TAGLINE ?? 'Fest coordination');
  const base = portalOrigin(env, role);
  const assets = assetBase(env, role);
  // The code goes in the link's fragment (#), which browsers never send to any server. The sign-in page fills the boxes and removes it.
  const login = `${base}/login${email ? `?email=${encodeURIComponent(email)}` : ''}#code=${encodeURIComponent(code)}`;
  const digits = code.split('');
  const heading = welcome ? `Welcome to ${env.APP_NAME}` : 'Your sign-in code';
  const intro = welcome
    ? `${esc(welcome.by)} added you to ${app} as <b style="color:#fff">${esc(welcome.role)}</b>${welcome.committee ? ` in the <b style="color:#fff">${esc(welcome.committee)}</b> committee` : ''}. Use this code to sign in for the first time.`
    : `Use this code to sign in to ${app}.`;

  const staticCells = digits
    .map((d) => `<td class="cell" align="center" style="width:1.15em;height:${ROW}em;font-size:40px;line-height:${ROW}em;font-weight:700;font-family:${FONT};color:#fbbf24;background:#1f1710;border:1px solid #4a3520;border-radius:10px">${esc(d)}</td>`)
    .join('<td style="width:6px;font-size:0">&nbsp;</td>');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(heading)}</title>
<style>
body{margin:0;padding:0;background:#0f0c09}
a{color:#fbbf24}
.anim{display:none;max-height:0;overflow:hidden;mso-hide:all}
.only-anim{display:none;max-height:0;overflow:hidden;mso-hide:all}
@media screen and (max-width:520px){
  .px{padding-left:20px!important;padding-right:20px!important}
  .slot,.cell{font-size:30px!important}
  .h1{font-size:26px!important}
  .tag{display:none!important}
  .amrita{height:22px!important}
  .btn{display:block!important;text-align:center!important}
}
@media screen and (max-width:340px){ .slot,.cell{font-size:25px!important} }
@supports (animation-name:none){
  .anim{display:block!important;max-height:none!important;overflow:visible!important}
  .stat{display:none!important;max-height:0!important;overflow:hidden!important}
  .only-anim{display:block!important;max-height:none!important;overflow:visible!important}
  ${keyframes(digits.length)}
}
@media (prefers-reduced-motion:reduce){ ${digits.map((_, i) => `.s${i}`).join(',')}{animation:none!important} }
</style></head>
<body style="margin:0;padding:0;background:#0f0c09;font-family:${FONT};color:#e8dccb">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0f0c09;font-size:1px;line-height:1px">Your ${app} sign-in code is inside. It works for ${OTP_MINUTES} minutes.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0c09"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#1a130d;border:1px solid #3a2c1e;border-radius:18px;overflow:hidden">

<!-- Top bar: app on the left, campus on the right -->
<tr><td class="px" style="padding:16px 32px;background:#241a11;border-bottom:2px solid #f59e0b">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
<td align="left" valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td valign="middle" style="padding-right:10px"><img src="${esc(assets)}/brand/dastaan-logo.png" width="38" alt="" style="display:block;width:38px;height:auto;border:0"></td>
<td valign="middle" style="font-family:${FONT}"><div style="font-size:20px;line-height:22px;font-weight:700;color:#ffffff">${app}</div><div class="tag" style="font-size:12px;line-height:16px;color:#b9a58c">${tagline}</div></td>
</tr></table></td>
<td align="right" valign="middle"><img class="amrita" src="${esc(assets)}/brand/amrita-logo.png" height="28" alt="Amrita Vishwa Vidyapeetham, Bengaluru" style="display:block;height:28px;width:auto;border:0;color:#e8dccb;font-size:12px"></td>
</tr></table></td></tr>

<!-- Body -->
<tr><td class="px" style="padding:36px 32px 8px">
<p style="margin:0 0 6px;font-size:15px;color:#b9a58c">Hi ${esc(name)},</p>
<h1 class="h1" style="margin:0 0 12px;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;font-family:${FONT}">${esc(heading)}</h1>
<p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#e8dccb">${intro}</p>

<!-- The code -->
<div style="padding:22px 8px;background:#120d09;border:1px solid #3a2c1e;border-radius:16px;text-align:center">
  <div class="stat" style="user-select:all;-webkit-user-select:all"><table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto"><tr>${staticCells}</tr></table></div>
  <div class="anim" aria-label="Your code is ${esc(code)}" style="font-size:0;line-height:0;text-align:center">${digits.map(rollingSlot).join('')}</div>
  <p style="margin:16px 0 0;font-size:13px;color:#9c8870">Works for ${OTP_MINUTES} minutes and can be used once.</p>
  <p class="only-anim" style="margin:6px 0 0;font-size:13px;color:#9c8870">To copy it by hand: <span style="color:#e8dccb;letter-spacing:2px;user-select:all;-webkit-user-select:all">${esc(code)}</span></p>
</div>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 0"><tr><td align="left">
<a class="btn" href="${esc(login)}" style="display:inline-block;padding:14px 26px;background:#f59e0b;color:#1a1208;font-weight:700;font-size:16px;text-decoration:none;border-radius:12px;font-family:${FONT}">Sign in with this code</a>
</td></tr></table>
<p style="margin:12px 0 0;font-size:13px;color:#9c8870">The button opens the sign-in page with the code already filled in.</p>
</td></tr>

<!-- Security note -->
<tr><td class="px" style="padding:26px 32px 32px">
<div style="padding:14px 16px;background:#211810;border-left:3px solid #f59e0b;border-radius:8px;font-size:14px;line-height:1.55;color:#cbb9a1">Did not ask for this? You can ignore this email, nobody can sign in without the code. ${app} will never ask you to share it.</div>
</td></tr>

<!-- Footer -->
<tr><td class="px" style="padding:18px 32px;border-top:1px solid #3a2c1e;font-size:12px;line-height:1.6;color:#8a7761">Sent by ${app}, ${tagline}.<br>Amrita Vishwa Vidyapeetham, Bengaluru Campus.</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${welcome ? `Welcome to ${env.APP_NAME}. ` : ''}Your sign-in code is ${code}. It works for ${OTP_MINUTES} minutes and can be used once.\n\nSign in: ${login}\n\nDid not ask for this? Ignore this email.`;
  return { subject: welcome ? `Welcome to ${env.APP_NAME}: your sign-in code` : `Your ${env.APP_NAME} sign-in code`, html, text };
}

export function userCreatedMail(
  env: Bindings,
  newUser: { name: string; email: string; role: string; committee: string | null },
  by: string,
) {
  const rows = [
    ['Name', newUser.name],
    ['Email', newUser.email],
    ['Designation', newUser.role],
    ['Committee', newUser.committee ?? 'None'],
    ['Created by', by],
  ]
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#9c8870;font-size:14px">${esc(k!)}</td><td style="padding:6px 0;color:#fff;font-size:14px">${esc(v!)}</td></tr>`)
    .join('');
  const html = shell(env, 'A new person was added', `${p('A new account was created and the person has been sent a one-time sign-in code.')}<table role="presentation" cellspacing="0" cellpadding="0">${rows}</table>`);
  const text = `A new account was created.\nName: ${newUser.name}\nEmail: ${newUser.email}\nDesignation: ${newUser.role}\nCommittee: ${newUser.committee ?? 'None'}\nCreated by: ${by}`;
  return { subject: `New ${newUser.role} added: ${newUser.name}`, html, text };
}

export function broadcastMail(
  env: Bindings,
  m: { subject: string; body: string; senderName: string; senderRole: string },
  files: { name: string; size: number; url: string }[],
) {
  const paras = m.body
    .split(/\n{2,}/)
    .map((b) => p(esc(b).replace(/\n/g, '<br>')))
    .join('');
  const fileHtml = files.length
    ? `<p style="margin:18px 0 6px;color:#9c8870;font-size:13px">Files</p>` +
      files
        .map((f) => `<div style="margin:4px 0"><a href="${esc(f.url)}" style="color:#fbbf24;font-size:14px">${esc(f.name)}</a> <span style="color:#9c8870;font-size:12px">${(f.size / 1048576).toFixed(1)} MB</span></div>`)
        .join('')
    : '';
  const html = shell(env, m.subject, `${paras}${fileHtml}<p style="margin:20px 0 0;color:#9c8870;font-size:13px">From ${esc(m.senderName)} (${esc(m.senderRole)})</p>`);
  const text = `${m.body}\n\n${files.map((f) => `${f.name}: ${f.url}`).join('\n')}\n\nFrom ${m.senderName} (${m.senderRole})`;
  return { subject: m.subject, html, text };
}

export function ticketContextMail(
  env: Bindings,
  d: {
    reason: 'assigned' | 'forwarded';
    byName: string;
    recipient: string;
    ticket: { id: string; code: string; title: string; details: string | null; priority: string; neededBy: string; requesterName: string; fromCommittee: string; toCommittee: string };
    history: { committee: string; by: string | null; note: string | null }[];
    files: { name: string; size: number; url: string; fromCommittee: string | null }[];
  },
) {
  const t = d.ticket;
  const open = `${portalOrigin(env, 'lead')}/tickets/${t.id}`;
  const headline = d.reason === 'assigned' ? `${d.byName} assigned a request to you` : `${d.byName} forwarded a request to your committee`;
  const needed = new Date(t.neededBy).toUTCString().replace(' GMT', ' UTC');
  const rows = [['Request', `${t.code}: ${t.title}`], ['Raised by', `${t.requesterName}, ${t.fromCommittee}`], ['Now with', t.toCommittee], ['Priority', t.priority], ['Needed by', needed]]
    .map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#9c8870;font-size:14px;vertical-align:top">${esc(k!)}</td><td style="padding:5px 0;color:#fff;font-size:14px">${esc(v!)}</td></tr>`)
    .join('');
  const requirement = t.details ? `<p style="margin:18px 0 6px;color:#9c8870;font-size:13px">The requirement</p>${p(esc(t.details).replace(/\n/g, '<br>'))}` : '';
  const hist = d.history.length
    ? `<p style="margin:18px 0 6px;color:#9c8870;font-size:13px">Where it has been</p>` +
      d.history.map((h) => `<div style="margin:6px 0;color:#e8dccb;font-size:14px"><b>${esc(h.committee)}</b>${h.by ? ` finished it (${esc(h.by)})` : ''}${h.note ? `<br><span style="color:#b9a58c">“${esc(h.note)}”</span>` : ''}</div>`).join('')
    : '';
  const files = d.files.length
    ? `<p style="margin:18px 0 6px;color:#9c8870;font-size:13px">Files (links work for 14 days)</p>` +
      d.files.map((f) => `<div style="margin:4px 0"><a href="${esc(f.url)}" style="color:#fbbf24;font-size:14px">${esc(f.name)}</a> <span style="color:#9c8870;font-size:12px">${(f.size / 1048576).toFixed(1)} MB${f.fromCommittee ? `, from ${esc(f.fromCommittee)}` : ''}</span></div>`).join('')
    : '';
  const html = shell(env, headline, `<table role="presentation" cellspacing="0" cellpadding="0">${rows}</table>${requirement}${hist}${files}<div style="margin-top:18px">${link(open, 'Open the request')}</div>`);
  const text = [
    headline, '', `${t.code}: ${t.title}`, `Raised by: ${t.requesterName}, ${t.fromCommittee}`, `Now with: ${t.toCommittee}`, `Priority: ${t.priority}`, `Needed by: ${needed}`,
    t.details ? `\nThe requirement:\n${t.details}` : '',
    d.history.length ? `\nWhere it has been:\n${d.history.map((h) => `- ${h.committee}${h.by ? ` (${h.by})` : ''}${h.note ? `: ${h.note}` : ''}`).join('\n')}` : '',
    d.files.length ? `\nFiles:\n${d.files.map((f) => `- ${f.name}: ${f.url}`).join('\n')}` : '',
    `\nOpen: ${open}`,
  ].filter((x) => x !== '').join('\n');
  return { subject: `${d.reason === 'assigned' ? 'Assigned to you' : 'Forwarded to your committee'}: ${t.title}`, html, text };
}
