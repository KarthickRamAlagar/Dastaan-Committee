-- Dastaan platform: initial schema (Cloudflare D1 / SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE committees (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description  TEXT,
  color        TEXT,
  logo_key     TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  archived_at  TEXT
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL CHECK (role IN ('admin','convenor','lead','member')),
  source        TEXT NOT NULL DEFAULT 'db' CHECK (source IN ('db','env')),
  committee_id  TEXT REFERENCES committees(id),
  created_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL,
  deleted_at    TEXT,
  CHECK ((role IN ('lead','member') AND committee_id IS NOT NULL) OR (role IN ('admin','convenor') AND committee_id IS NULL))
);
CREATE INDEX idx_users_committee ON users(committee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
-- exactly one Committee Lead per committee
CREATE UNIQUE INDEX uq_one_lead_per_committee ON users(committee_id) WHERE role = 'lead' AND deleted_at IS NULL;

CREATE TABLE sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  ip          TEXT,
  ua          TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE otps (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL COLLATE NOCASE,
  code_hash    TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  consumed_at  TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_otps_email ON otps(email, created_at DESC);

CREATE TABLE rate_limits (
  key       TEXT PRIMARY KEY,
  count     INTEGER NOT NULL,
  reset_at  INTEGER NOT NULL
);

CREATE TABLE tickets (
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  id               TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  details          TEXT,
  requester_id     TEXT NOT NULL REFERENCES users(id),
  from_committee_id TEXT NOT NULL REFERENCES committees(id),
  to_committee_id  TEXT NOT NULL REFERENCES committees(id),
  assignee_id      TEXT REFERENCES users(id),
  priority         TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
  redo_pending     INTEGER NOT NULL DEFAULT 0,
  needed_by        TEXT NOT NULL,
  hop_count        INTEGER NOT NULL DEFAULT 2,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_tickets_to        ON tickets(to_committee_id, status, priority);
CREATE INDEX idx_tickets_from      ON tickets(from_committee_id);
CREATE INDEX idx_tickets_requester ON tickets(requester_id, created_at DESC);
CREATE INDEX idx_tickets_assignee  ON tickets(assignee_id, status);
CREATE INDEX idx_tickets_created   ON tickets(created_at DESC);

-- One row per committee a ticket has visited. seq 0 is the committee that raised it.
CREATE TABLE ticket_hops (
  id            TEXT PRIMARY KEY,
  ticket_id     TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  seq           INTEGER NOT NULL,
  committee_id  TEXT NOT NULL REFERENCES committees(id),
  entered_at    TEXT NOT NULL,
  left_at       TEXT,
  forwarded_by  TEXT REFERENCES users(id),
  note          TEXT,
  UNIQUE (ticket_id, seq)
);
CREATE INDEX idx_hops_committee ON ticket_hops(committee_id, ticket_id);

CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  uploader_id   TEXT NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL CHECK (kind IN ('request','handoff','mail','logo')),
  ticket_id     TEXT REFERENCES tickets(id) ON DELETE CASCADE,
  hop_id        TEXT REFERENCES ticket_hops(id) ON DELETE CASCADE,
  mail_id       TEXT,
  r2_key        TEXT NOT NULL,
  name          TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  original_size INTEGER,
  committed     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_attach_ticket ON attachments(ticket_id);
CREATE INDEX idx_attach_mail ON attachments(mail_id);
CREATE INDEX idx_attach_pending ON attachments(committed, created_at);

CREATE TABLE ticket_comments (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('comment','redo')),
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id, created_at DESC);

CREATE TABLE ticket_events (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES users(id),
  kind        TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_events_ticket ON ticket_events(ticket_id, created_at);

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  by_id       TEXT REFERENCES users(id),
  link        TEXT,
  created_at  TEXT NOT NULL,
  read_at     TEXT
);
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE mail_log (
  id               TEXT PRIMARY KEY,
  sender_id        TEXT NOT NULL REFERENCES users(id),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  audience         TEXT NOT NULL,
  recipient_count  INTEGER NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE TABLE committee_grants (
  id            TEXT PRIMARY KEY,
  action        TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  committee_id  TEXT REFERENCES committees(id),
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','used')),
  requested_by  TEXT NOT NULL REFERENCES users(id),
  decided_by    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL,
  decided_at    TEXT,
  expires_at    TEXT,
  used_at       TEXT
);
CREATE INDEX idx_grants_status ON committee_grants(status, created_at DESC);

CREATE TABLE support_requests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX idx_support_status ON support_requests(status, created_at DESC);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  actor_id   TEXT,
  actor_email TEXT,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  meta       TEXT,
  ip         TEXT
);
CREATE INDEX idx_audit_at ON audit_log(at DESC);

-- Local development only: emails are written here when EMAIL_MODE=log.
CREATE TABLE dev_outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  to_list     TEXT NOT NULL,
  cc_list     TEXT,
  subject     TEXT NOT NULL,
  text        TEXT NOT NULL
);
