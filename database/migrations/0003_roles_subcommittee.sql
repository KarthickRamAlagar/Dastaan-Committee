-- Member details go to the Committee Lead, work has a sub-committee, members can say "work done", priorities are High/Low.
ALTER TABLE users ADD COLUMN sub_committee TEXT;
ALTER TABLE tickets ADD COLUMN sub_committee TEXT;
ALTER TABLE tickets ADD COLUMN member_done_at TEXT;
ALTER TABLE support_requests ADD COLUMN to_user_id TEXT REFERENCES users(id);
ALTER TABLE mail_log ADD COLUMN channel TEXT NOT NULL DEFAULT 'both';
CREATE INDEX idx_support_to_user ON support_requests(to_user_id, status);
-- Medium priority no longer exists; the old CHECK still allows the value, the app never writes it.
UPDATE tickets SET priority = 'low' WHERE priority = 'medium';
