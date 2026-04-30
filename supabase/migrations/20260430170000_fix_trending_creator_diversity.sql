-- Fix get_trending_content to return at most one video per creator so the
-- trending pool is always creator-diverse. Uses a window function to pick each
-- creator's best-performing video (most tingles in the last 7 days, then most
-- recently added as a tiebreaker), then ranks creators by that score.

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
  WITH scored AS (
    SELECT
      c.id,
      c.youtube_video_id,
      c.youtube_channel_id,
      c.channel_title,
      c.title,
      c.duration_seconds,
      c.thumbnail_url,
      cr.display_name AS creator_display_name,
      COUNT(te.id)::BIGINT AS tingle_count,
      -- Stable creator key: prefer youtube_channel_id, fall back to creator FK
      COALESCE(c.youtube_channel_id, cr.id::TEXT, c.id::TEXT) AS creator_key,
      -- Rank videos within each creator: best tingle week first, then newest
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.youtube_channel_id, cr.id::TEXT, c.id::TEXT)
        ORDER BY COUNT(te.id) DESC, c.created_at DESC
      ) AS creator_rank
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
      cr.id,
      cr.display_name
  )
  SELECT
    s.id,
    s.youtube_video_id,
    s.youtube_channel_id,
    s.channel_title,
    s.title,
    s.duration_seconds,
    s.thumbnail_url,
    s.creator_display_name,
    s.tingle_count
  FROM scored s
  WHERE s.creator_rank = 1
  ORDER BY s.tingle_count DESC, s.id
  LIMIT p_limit;
END;
$$;
