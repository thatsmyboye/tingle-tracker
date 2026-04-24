-- =============================================================================
-- Add content_trigger_moments table for trigger timestamp evidence
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_trigger_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  trigger_tag_id UUID NOT NULL REFERENCES trigger_tags(id) ON DELETE CASCADE,
  timestamp_ms INTEGER NOT NULL CHECK (timestamp_ms >= 0),
  confidence NUMERIC(4,3),
  source TEXT NOT NULL DEFAULT 'llm' CHECK (source IN ('creator', 'llm', 'both')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_trigger_moments_unique UNIQUE (content_id, trigger_tag_id, timestamp_ms)
);

CREATE INDEX IF NOT EXISTS content_trigger_moments_content_id_idx
  ON content_trigger_moments (content_id);
CREATE INDEX IF NOT EXISTS content_trigger_moments_trigger_tag_id_idx
  ON content_trigger_moments (trigger_tag_id);
CREATE INDEX IF NOT EXISTS content_trigger_moments_timestamp_idx
  ON content_trigger_moments (timestamp_ms);

ALTER TABLE content_trigger_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_trigger_moments_public_read"
  ON content_trigger_moments FOR SELECT
  USING (true);

CREATE POLICY "content_trigger_moments_owner_insert"
  ON content_trigger_moments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = content_trigger_moments.content_id
        AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "content_trigger_moments_owner_delete"
  ON content_trigger_moments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = content_trigger_moments.content_id
        AND creators.user_id = auth.uid()
    )
  );
