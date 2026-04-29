-- The UNIQUE(user_id) constraint on creators prevents admin batch import from
-- creating more than one creator row, since all batch-imported creators share
-- the admin's user_id. Drop it and use youtube_channel_id as the dedup key
-- for channel-linked creators instead.

ALTER TABLE creators DROP CONSTRAINT creators_user_id_unique;

CREATE UNIQUE INDEX creators_youtube_channel_id_unique
  ON creators (youtube_channel_id)
  WHERE youtube_channel_id IS NOT NULL;
