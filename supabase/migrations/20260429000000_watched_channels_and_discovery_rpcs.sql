-- =============================================================================
-- watched_channels: admin-curated list of ASMR channels to auto-track
-- find_similar_creators: Jaccard similarity on content_triggers fingerprints
-- get_recommended_content: user trigger affinity → scored content ranking
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. watched_channels table
-- ---------------------------------------------------------------------------

CREATE TABLE watched_channels (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id   TEXT UNIQUE NOT NULL,
  channel_title        TEXT,
  uploads_playlist_id  TEXT,
  latest_video_count   INTEGER NOT NULL DEFAULT 20 CHECK (latest_video_count BETWEEN 1 AND 50),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_refreshed_at    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX watched_channels_is_active_idx ON watched_channels (is_active);

-- updated_at trigger (uses set_updated_at() defined in initial_schema migration)
CREATE TRIGGER watched_channels_updated_at
  BEFORE UPDATE ON watched_channels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE watched_channels ENABLE ROW LEVEL SECURITY;

-- Admins (is_admin = true on user_profiles) can read and write
CREATE POLICY "watched_channels_admin_read"
  ON watched_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = TRUE
    )
  );

CREATE POLICY "watched_channels_admin_write"
  ON watched_channels FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.is_admin = TRUE
    )
  );

-- ---------------------------------------------------------------------------
-- 2. find_similar_creators(p_creator_id, p_limit)
--
-- Computes Jaccard similarity between the given creator and all other creators
-- using their content_triggers fingerprint (LLM confidence, no tingle events
-- required). Filters candidate creators to those with ≥1 processed content row.
--
-- jaccard = |intersection| / |union|
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION find_similar_creators(
  p_creator_id UUID,
  p_limit      INT DEFAULT 10
)
RETURNS TABLE (
  creator_id          UUID,
  display_name        TEXT,
  youtube_channel_id  TEXT,
  jaccard_similarity  NUMERIC,
  shared_trigger_count INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH source_triggers AS (
    -- Distinct trigger set for the source creator
    SELECT DISTINCT ct.trigger_tag_id
    FROM content_triggers ct
    JOIN content c ON c.id = ct.content_id
    WHERE c.creator_id = p_creator_id
  ),
  source_count AS (
    SELECT COUNT(*) AS n FROM source_triggers
  ),
  candidate_triggers AS (
    -- Distinct trigger set per candidate creator (excludes source)
    SELECT c.creator_id, ct.trigger_tag_id
    FROM content_triggers ct
    JOIN content c ON c.id = ct.content_id
    WHERE c.creator_id != p_creator_id
      AND c.creator_id IS NOT NULL
    GROUP BY c.creator_id, ct.trigger_tag_id
  ),
  candidate_counts AS (
    SELECT creator_id, COUNT(*) AS n FROM candidate_triggers GROUP BY creator_id
  ),
  intersections AS (
    SELECT
      ct.creator_id,
      COUNT(*) AS shared
    FROM candidate_triggers ct
    JOIN source_triggers st ON st.trigger_tag_id = ct.trigger_tag_id
    GROUP BY ct.creator_id
  )
  SELECT
    cr.id                                                          AS creator_id,
    cr.display_name,
    cr.youtube_channel_id,
    ROUND(
      i.shared::NUMERIC / NULLIF(sc.n + cc.n - i.shared, 0)::NUMERIC,
      4
    )                                                              AS jaccard_similarity,
    i.shared::INT                                                  AS shared_trigger_count
  FROM intersections i
  JOIN candidate_counts cc ON cc.creator_id = i.creator_id
  CROSS JOIN source_count sc
  JOIN creators cr ON cr.id = i.creator_id
  WHERE sc.n > 0
  ORDER BY jaccard_similarity DESC NULLS LAST, shared_trigger_count DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION find_similar_creators(UUID, INT) TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. get_recommended_content(p_user_id, p_limit)
--
-- Scores content by how well it matches the user's trigger affinity.
-- Score = sum of (content_triggers.confidence * user_weight) across shared
-- trigger_tag_ids, where user_weight = tingle_count * avg_intensity from
-- the user_trigger_affinity view.
-- Excludes content the user has already logged tingle events for.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_recommended_content(
  p_user_id UUID,
  p_limit   INT DEFAULT 12
)
RETURNS TABLE (
  content_id          UUID,
  youtube_video_id    TEXT,
  title               TEXT,
  thumbnail_url       TEXT,
  creator_id          UUID,
  creator_display_name TEXT,
  score               NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_weights AS (
    -- User's trigger preferences (from user_trigger_affinity view)
    SELECT
      uta.trigger_tag_id,
      (uta.tingle_count * uta.avg_intensity) AS weight
    FROM user_trigger_affinity uta
    WHERE uta.user_id = p_user_id
  ),
  already_watched AS (
    SELECT DISTINCT content_id
    FROM tingle_events
    WHERE user_id = p_user_id
  ),
  scored AS (
    SELECT
      c.id            AS content_id,
      SUM(ct.confidence * uw.weight) AS score
    FROM content_triggers ct
    JOIN user_weights uw ON uw.trigger_tag_id = ct.trigger_tag_id
    JOIN content c ON c.id = ct.content_id
    WHERE c.status = 'ready'
      AND c.id NOT IN (SELECT content_id FROM already_watched)
    GROUP BY c.id
  )
  SELECT
    c.id,
    c.youtube_video_id,
    c.title,
    c.thumbnail_url,
    c.creator_id,
    cr.display_name   AS creator_display_name,
    s.score
  FROM scored s
  JOIN content c ON c.id = s.content_id
  LEFT JOIN creators cr ON cr.id = c.creator_id
  ORDER BY s.score DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_recommended_content(UUID, INT) TO authenticated;
