-- The partial unique index created in the previous migration cannot be targeted
-- by ON CONFLICT (youtube_channel_id) because PostgreSQL requires the conflict
-- target to exactly match the index definition including its WHERE clause.
-- Since NULLs are never equal in PostgreSQL unique checks, the WHERE IS NOT NULL
-- guard is redundant — drop the partial index and use a plain unique index instead.

DROP INDEX IF EXISTS creators_youtube_channel_id_unique;

CREATE UNIQUE INDEX creators_youtube_channel_id_unique
  ON creators (youtube_channel_id);
