-- Files kept inside D1 (used when no R2 bucket is connected). A file is stored in pieces of at most 1 MB,
-- because one D1 row can hold at most 2 MB. `key` is the attachments.r2_key value of the file.
CREATE TABLE file_chunks (
  key  TEXT NOT NULL,
  seq  INTEGER NOT NULL,
  data BLOB NOT NULL
);
CREATE UNIQUE INDEX uq_file_chunks ON file_chunks(key, seq);
