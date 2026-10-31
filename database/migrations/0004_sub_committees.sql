-- The fixed list of sub-committees under each committee (filled by seed/seed.sql).
CREATE TABLE sub_committees (
  id           TEXT PRIMARY KEY,
  committee_id TEXT NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (committee_id, name)
);
CREATE INDEX idx_sub_committees_committee ON sub_committees(committee_id, sort_order);
