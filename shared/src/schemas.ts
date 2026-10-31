import { z } from 'zod';
import { COMMITTEE_ICONS, GRANT_ACTIONS, PRIORITIES } from './constants';

export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const name = z.string().trim().min(2, 'Enter a name').max(80);
const phone = z
  .string()
  .trim()
  .regex(/^[+]?[0-9 ()-]{7,18}$/, 'Enter a valid phone number');
const id = z.string().trim().min(8).max(64);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const requestOtpBody = z.object({ email });
export const verifyOtpBody = z.object({ email, code: z.string().trim().regex(/^[0-9]{6}$/, 'The code has 6 digits') });
export const adminLoginBody = z.object({ email, password: z.string().min(1).max(200) });

export const createUserBody = z
  .object({
    name,
    email,
    phone,
    designation: z.enum(['convenor', 'lead', 'admin']),
    committeeId: id.optional(),
  })
  .refine((v) => v.designation !== 'lead' || Boolean(v.committeeId), {
    path: ['committeeId'],
    message: 'Choose a committee for a Committee Lead',
  });
export type CreateUserBody = z.infer<typeof createUserBody>;

const subCommittee = z.string().trim().min(2, 'Enter a sub-committee').max(60);
export const createMemberBody = z.object({ name, email, phone, subCommittee });
export type CreateMemberBody = z.infer<typeof createMemberBody>;

export const updateMemberBody = z
  .object({ name: name.optional(), email: email.optional(), phone: phone.optional(), subCommittee: subCommittee.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });

export const updateUserBody = z
  .object({ name: name.optional(), email: email.optional(), phone: phone.optional(), committeeId: id.optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change' });

export const createTicketBody = z.object({
  title: text(3, 200),
  details: z.string().trim().max(2000).optional(),
  toCommitteeId: id,
  assigneeId: id.optional(),
  priority: z.enum(PRIORITIES),
  neededBy: z.string().datetime({ offset: true }),
  attachmentIds: z.array(id).max(5).default([]),
});
export type CreateTicketBody = z.infer<typeof createTicketBody>;

export const statusBody = z.object({ status: z.enum(['in_progress', 'done']) });
export const assignBody = z.object({ assigneeId: id, subCommittee: subCommittee.optional() });
export const forwardBody = z.object({
  toCommitteeId: id,
  note: z.string().trim().max(1000).optional(),
  attachmentIds: z.array(id).min(1, 'Attach the work you finished').max(5),
});
export const commentBody = z.object({ body: text(2, 2000) });
export const redoBody = z.object({ reason: text(5, 1000) });

export const mailBody = z.object({
  subject: text(3, 200),
  body: text(2, 10000),
  audience: z.discriminatedUnion('type', [
    z.object({ type: z.literal('all') }),
    z.object({ type: z.literal('leads') }),
    z.object({ type: z.literal('committees'), committeeIds: z.array(id).min(1).max(40) }),
    z.object({ type: z.literal('members'), userIds: z.array(id).min(1).max(500) }),
  ]),
  attachmentIds: z.array(id).max(5).default([]),
  /** 'both' = email and bell notification, 'notification' = bell notification only. */
  channel: z.enum(['both', 'notification']).default('both'),
});
export type MailBody = z.infer<typeof mailBody>;

export const committeeBody = z.object({
  name: text(2, 60),
  description: z.string().trim().max(300).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.enum(COMMITTEE_ICONS).optional(),
  logoAttachmentId: id.optional(),
  grantId: id,
});
export const committeeUpdateBody = committeeBody.partial({ name: true }).extend({ grantId: id });

export const grantRequestBody = z.object({
  action: z.enum(GRANT_ACTIONS),
  committeeId: id.optional(),
  note: z.string().trim().max(500).optional(),
});
export const grantDecisionBody = z.object({ approve: z.boolean(), note: z.string().trim().max(500).optional() });

export const supportBody = z.object({ subject: text(3, 160), body: text(5, 3000) });
export const supportUpdateBody = z.object({ status: z.enum(['open', 'done']) });
