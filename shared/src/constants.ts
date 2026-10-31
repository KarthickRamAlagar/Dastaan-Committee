export const ROLES = ['admin', 'convenor', 'lead', 'member'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  convenor: 'Convenor',
  lead: 'Committee Lead',
  member: 'Committee Member',
};

export const STATUSES = ['pending', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  done: 'Done',
};

export const PRIORITIES = ['high', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', low: 'Low' };
export const PRIORITY_RANK: Record<Priority, number> = { high: 2, low: 1 };

/** Table pages everywhere show seven rows. */
export const PAGE_SIZE = 7;

/** Files bigger than this are compressed before upload. */
export const COMPRESS_ABOVE_BYTES = 20 * 1024 * 1024;
/** The most the browser will accept to compress. */
export const MAX_PICK_BYTES = 200 * 1024 * 1024;
/** The most the server will store for one ticket file, after compression. Files live inside the D1 database, 1 MB at a time. */
export const MAX_STORED_BYTES = 25 * 1024 * 1024;
/** Mass-mail files: stored with the other files and linked from the email. */
export const MAX_MAIL_FILE_BYTES = 25 * 1024 * 1024;

export const TICKET_FILE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'pdf', 'doc', 'docx', 'ppt', 'pptx',
] as const;

export const OTP_MINUTES = 30;
/** College emails: always bl.<anything>@bl.students.amrita.edu (the part after "bl." can vary). */
export const COLLEGE_EMAIL_RE = /^bl\.[a-z0-9][a-z0-9._-]*@bl\.students\.amrita\.edu$/;
export const COLLEGE_EMAIL_EXAMPLE = 'bl.sc.p2dsc26034@bl.students.amrita.edu';
export const TOAST_MS_LEAD_LOCKED = 7000;

export const GRANT_ACTIONS = ['create', 'update', 'delete'] as const;
export type GrantAction = (typeof GRANT_ACTIONS)[number];

/** Icons a committee can show. The web app maps each key to a drawing; unknown keys fall back to a building. */
export const COMMITTEE_ICONS = [
  'events', 'media', 'marketing', 'sponsorship', 'operations', 'administration',
  'design', 'technical', 'logistics', 'hospitality', 'finance', 'volunteers',
] as const;
export type CommitteeIcon = (typeof COMMITTEE_ICONS)[number];
