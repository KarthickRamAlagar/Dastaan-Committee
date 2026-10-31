import type { Priority, Role, Status } from './constants';

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  committeeId: string | null;
  committeeName: string | null;
  isEnvAdmin: boolean;
}

export interface CommitteeDto {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  hasLogo: boolean;
  memberCount: number;
  /** Names of the Committee Leads, comma separated (a committee can have several). */
  leadName: string | null;
  leadCount: number;
  archived: boolean;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  committeeId: string | null;
  committeeName: string | null;
  subCommittee: string | null;
  invitedAt: string;
  invitedByName: string | null;
}

export interface AttachmentDto {
  id: string;
  name: string;
  size: number;
  originalSize: number | null;
  mime: string;
  kind: 'request' | 'handoff';
  createdAt: string;
}

/** A file attached to a request, shown in lists so people can open it without going into the request. */
export interface FileRef {
  id: string;
  name: string;
  size: number;
  kind: 'request' | 'handoff';
  /** For hand-over files: the committee that produced them. */
  fromCommittee: string | null;
}

/** Who forwarded this request to the committee that holds it now, and what they said. */
export interface HandoffInfo {
  fromCommittee: string;
  byName: string | null;
  note: string | null;
}

export interface TicketRow {
  id: string;
  code: string;
  title: string;
  priority: Priority;
  status: Status;
  redoPending: boolean;
  createdAt: string;
  neededBy: string;
  requesterId: string;
  requesterName: string;
  fromCommitteeId: string;
  fromCommittee: string;
  toCommitteeId: string;
  toCommittee: string;
  assigneeId: string | null;
  assigneeName: string | null;
  /** The sub-committee the work was given to. */
  subCommittee: string | null;
  /** Set when the assigned member pressed Work done; the Lead then closes it. */
  memberDoneAt: string | null;
  fileCount: number;
  comment: string | null;
  commentAt: string | null;
  hops: number;
  /** The full requirement, as written by the requester. */
  details: string | null;
  /** Set when the request was forwarded here from another committee. */
  handoff: HandoffInfo | null;
  /** Every file on the request so far: the original ones and each committee's hand-over files. */
  fileList: FileRef[];
}

export interface HopDto {
  seq: number;
  committeeId: string;
  committeeName: string;
  committeeColor: string | null;
  committeeIcon: string | null;
  hasLogo: boolean;
  enteredAt: string;
  leftAt: string | null;
  forwardedByName: string | null;
  note: string | null;
  status: Status | 'origin';
  files: AttachmentDto[];
}

export interface TicketEventDto {
  id: string;
  kind: string;
  actorName: string | null;
  message: string;
  createdAt: string;
}

export interface TicketDetail extends TicketRow {
  timeline: HopDto[];
  events: TicketEventDto[];
  comments: { id: string; body: string; authorName: string; createdAt: string; kind: 'comment' | 'redo' }[];
  files: AttachmentDto[];
  can: {
    changeStatus: boolean;
    assign: boolean;
    forward: boolean;
    redo: boolean;
    comment: boolean;
    workDone: boolean;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StatBlock {
  pending: number;
  in_progress: number;
  done: number;
  high: number;
  low: number;
  total: number;
}

export interface NotificationDto {
  id: string;
  title: string;
  body: string;
  byName: string | null;
  createdAt: string;
  read: boolean;
  link: string | null;
}

export interface GrantDto {
  id: string;
  action: 'create' | 'update' | 'delete';
  committeeId: string | null;
  committeeName: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  requestedByName: string;
  decidedByName: string | null;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string | null;
}

export interface SupportDto {
  id: string;
  subject: string;
  body: string;
  status: 'open' | 'done';
  fromName: string;
  fromEmail: string;
  committeeName: string | null;
  createdAt: string;
  /** Set when a member wrote to their Lead instead of the Admin. */
  toName?: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
