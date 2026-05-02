-- =============================================================================
-- FIX: Remove SECURITY DEFINER from views
-- Recreate views with security_invoker = true so they respect the querying
-- user's RLS policies rather than the view owner's permissions.
-- =============================================================================

-- Heatmap data for a piece of content (used by creator dashboard)
CREATE OR REPLACE VIEW content_tingle_heatmap WITH (security_invoker = true) AS
SELECT
  te.content_id,
  -- Bucket into 10-second windows
  (te.timestamp_ms / 10000) * 10000 AS bucket_start_ms,
  COUNT(*)                           AS tingle_count,
  AVG(te.intensity::text::int)       AS avg_intensity
FROM tingle_events te
GROUP BY te.content_id, bucket_start_ms
ORDER BY te.content_id, bucket_start_ms;

-- Top triggers for a creator (across all their content)
CREATE OR REPLACE VIEW creator_top_triggers WITH (security_invoker = true) AS
SELECT
  c.creator_id,
  tt.id          AS trigger_tag_id,
  tt.label       AS trigger_label,
  tt.category    AS trigger_category,
  COUNT(te.id)   AS total_tingles,
  AVG(te.intensity::text::int) AS avg_intensity
FROM tingle_events te
JOIN content c ON c.id = te.content_id
JOIN content_triggers ct ON ct.content_id = c.id
JOIN trigger_tags tt ON tt.id = ct.trigger_tag_id
GROUP BY c.creator_id, tt.id, tt.label, tt.category
ORDER BY total_tingles DESC;

-- User trigger affinity (used for discovery matching)
CREATE OR REPLACE VIEW user_trigger_affinity WITH (security_invoker = true) AS
SELECT
  te.user_id,
  tt.id            AS trigger_tag_id,
  tt.label         AS trigger_label,
  tt.category      AS trigger_category,
  COUNT(te.id)     AS tingle_count,
  AVG(te.intensity::text::int) AS avg_intensity
FROM tingle_events te
JOIN content_triggers ct ON ct.content_id = te.content_id
JOIN trigger_tags tt ON tt.id = ct.trigger_tag_id
GROUP BY te.user_id, tt.id, tt.label, tt.category
ORDER BY tingle_count DESC;
