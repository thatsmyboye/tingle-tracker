-- Trigger tag UI grouping, LLM slug aliases, and audio worker outcome on insights.

-- ---------------------------------------------------------------------------
-- trigger_tags.display_group — UI grouping only (not RLS-sensitive)
-- ---------------------------------------------------------------------------
ALTER TABLE trigger_tags
  ADD COLUMN IF NOT EXISTS display_group TEXT NOT NULL DEFAULT 'sensory';

COMMENT ON COLUMN trigger_tags.display_group IS
  'Dashboard grouping: sensory, vocal_style, style_genre, music, ambience, etc.';

-- Backfill known tags for taxonomy UI
UPDATE trigger_tags SET display_group = 'vocal_style'
WHERE slug IN ('whispering', 'soft-speaking');

UPDATE trigger_tags SET display_group = 'style_genre'
WHERE slug = 'roleplay';

-- ---------------------------------------------------------------------------
-- trigger_tag_aliases — alternate slugs the LLM may emit → canonical tag
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trigger_tag_aliases (
  alias_slug     TEXT PRIMARY KEY,
  trigger_tag_id UUID NOT NULL REFERENCES trigger_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS trigger_tag_aliases_trigger_tag_id_idx
  ON trigger_tag_aliases (trigger_tag_id);

COMMENT ON TABLE trigger_tag_aliases IS
  'Curated alternate slugs for LLM output; seeded only, never app-inserted.';

ALTER TABLE trigger_tag_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trigger_tag_aliases_public_read"
  ON trigger_tag_aliases FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- insights_cache.audio_worker_status — set by audio.analyze (service role)
-- ---------------------------------------------------------------------------
ALTER TABLE insights_cache
  ADD COLUMN IF NOT EXISTS audio_worker_status TEXT;

COMMENT ON COLUMN insights_cache.audio_worker_status IS
  'used | skipped_unconfigured | failed — whether acoustic worker contributed data.';
