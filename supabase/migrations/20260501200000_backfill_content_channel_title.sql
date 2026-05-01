-- Backfill channel_title on content rows where it is NULL.
--
-- Content ingested via catalog.refresh before the channel_title column was
-- added (migration 20260413000002) has channel_title = NULL. These rows carry
-- a youtube_channel_id that matches an entry in watched_channels, so we can
-- recover the display name from there.
--
-- This is a one-time data fix; the ingest code paths now write channel_title
-- on every new insert.

UPDATE content c
SET    channel_title = wc.channel_title
FROM   watched_channels wc
WHERE  c.youtube_channel_id = wc.youtube_channel_id
  AND  c.channel_title IS NULL
  AND  wc.channel_title IS NOT NULL;
