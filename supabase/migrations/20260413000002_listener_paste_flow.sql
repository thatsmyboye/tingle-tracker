-- =============================================================================
-- Listener paste flow
-- Migration: 20260413000002_listener_paste_flow.sql
--
-- Changes:
--   1. content.creator_id is now nullable — listener-pasted videos have no
--      creator until the channel owner creates an account and claims it.
--   2. youtube_channel_id + channel_title stored on content to enable
--      automatic backfill when a creator verifies their channel.
--   3. get_trending_content() RPC for the /listen browse page — ranks
--      content by tingle activity in the past 7 days.
-- =============================================================================

-- 1. Make creator_id nullable
--    Existing rows are unaffected (they have valid creator_ids already).
ALTER TABLE content ALTER COLUMN creator_id DROP NOT NULL;

-- 2. Channel metadata columns
--    youtube_channel_id: the stable "UC..." channel ID from YouTube Data API
--    channel_title:      the human-readable channel name (friendly fallback
--                        for unclaimed content where creators.display_name
--                        is not yet available)
ALTER TABLE content ADD COLUMN IF NOT EXISTS youtube_channel_id TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS channel_title       TEXT;

CREATE INDEX IF NOT EXISTS content_youtube_channel_id_idx
  ON content (youtube_channel_id);

-- 3. Trending content RPC
--    Joins content ← creators (optional) ← tingle_events (last 7 days).
--    SECURITY DEFINER so the anon role can read tingle_events via this
--    function without exposing per-user rows directly.
CREATE OR REPLACE FUNCTION get_trending_content(p_limit INT DEFAULT 12)
RETURNS TABLE (
  id                   UUID,
  youtube_video_id     TEXT,
  youtube_channel_id   TEXT,
  channel_title        TEXT,
  title                TEXT,
  duration_seconds     INTEGER,
  thumbnail_url        TEXT,
  creator_display_name TEXT,
  tingle_count         BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.youtube_video_id,
    c.youtube_channel_id,
    c.channel_title,
    c.title,
    c.duration_seconds,
    c.thumbnail_url,
    cr.display_name  AS creator_display_name,
    COUNT(te.id)::BIGINT AS tingle_count
  FROM content c
  LEFT JOIN creators cr
    ON cr.id = c.creator_id
  LEFT JOIN tingle_events te
    ON  te.content_id = c.id
    AND te.created_at > now() - INTERVAL '7 days'
  WHERE c.status = 'ready'
  GROUP BY
    c.id,
    c.youtube_video_id,
    c.youtube_channel_id,
    c.channel_title,
    c.title,
    c.duration_seconds,
    c.thumbnail_url,
    cr.display_name
  ORDER BY tingle_count DESC, c.created_at DESC
  LIMIT p_limit;
END;
$$;
