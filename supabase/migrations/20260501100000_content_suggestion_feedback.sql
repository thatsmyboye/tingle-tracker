-- =============================================================================
-- content_suggestion_feedback
--
-- Stores per-user feedback on recommended content tiles (thumbs_up, thumbs_down,
-- hidden). Used to adjust scores in get_recommended_content and to exclude
-- hidden items from future suggestions.
-- =============================================================================

CREATE TABLE content_suggestion_feedback (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  uuid        NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  feedback    text        NOT NULL CHECK (feedback IN ('thumbs_up', 'thumbs_down', 'hidden')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);

ALTER TABLE content_suggestion_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own suggestion feedback"
  ON content_suggestion_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own suggestion feedback"
  ON content_suggestion_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own suggestion feedback"
  ON content_suggestion_feedback FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on row change
CREATE TRIGGER set_updated_at_content_suggestion_feedback
  BEFORE UPDATE ON content_suggestion_feedback
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- =============================================================================
-- Update get_recommended_content to incorporate feedback signals:
--   hidden      → excluded from results entirely
--   thumbs_up   → score ×1.5
--   thumbs_down → score ×0.5
--   no feedback → score ×1.0
-- =============================================================================

CREATE OR REPLACE FUNCTION get_recommended_content(
  p_user_id UUID,
  p_limit   INT DEFAULT 12
)
RETURNS TABLE (
  content_id           UUID,
  youtube_video_id     TEXT,
  title                TEXT,
  thumbnail_url        TEXT,
  creator_id           UUID,
  creator_display_name TEXT,
  score                NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_weights AS (
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
  hidden_content AS (
    SELECT content_id
    FROM content_suggestion_feedback
    WHERE user_id = p_user_id AND feedback = 'hidden'
  ),
  scored AS (
    SELECT
      c.id AS content_id,
      SUM(ct.confidence * uw.weight) AS raw_score
    FROM content_triggers ct
    JOIN user_weights uw ON uw.trigger_tag_id = ct.trigger_tag_id
    JOIN content c ON c.id = ct.content_id
    WHERE c.status = 'ready'
      AND c.id NOT IN (SELECT content_id FROM already_watched)
      AND c.id NOT IN (SELECT content_id FROM hidden_content)
    GROUP BY c.id
  )
  SELECT
    c.id,
    c.youtube_video_id,
    c.title,
    c.thumbnail_url,
    c.creator_id,
    cr.display_name AS creator_display_name,
    s.raw_score * COALESCE(
      (
        SELECT CASE csf.feedback
          WHEN 'thumbs_up'   THEN 1.5
          WHEN 'thumbs_down' THEN 0.5
          ELSE 1.0
        END
        FROM content_suggestion_feedback csf
        WHERE csf.user_id = p_user_id AND csf.content_id = c.id
        LIMIT 1
      ),
      1.0
    ) AS score
  FROM scored s
  JOIN content c ON c.id = s.content_id
  LEFT JOIN creators cr ON cr.id = c.creator_id
  ORDER BY score DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_recommended_content(UUID, INT) TO authenticated;
