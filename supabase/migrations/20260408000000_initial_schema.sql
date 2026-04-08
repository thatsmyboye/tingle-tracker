-- =============================================================================
-- Tingle Tracker — Initial Schema
-- Migration: 20260408000000_initial_schema.sql
-- =============================================================================
-- Run order matters. Tables are created dependency-first.
-- Enable required extensions first.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy creator/content search

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE trigger_category AS ENUM ('visual', 'aural', 'tactile_adjacent');
CREATE TYPE tingle_intensity AS ENUM ('1', '2', '3', '4', '5');
CREATE TYPE content_status AS ENUM ('pending', 'processing', 'ready', 'error');
CREATE TYPE insight_status AS ENUM ('pending', 'generating', 'ready', 'error');

-- =============================================================================
-- CREATORS
-- Profile for creator accounts. One per user who opts in as a creator.
-- =============================================================================

CREATE TABLE creators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  youtube_channel_id  TEXT,
  youtube_channel_url TEXT,
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT creators_user_id_unique UNIQUE (user_id),
  CONSTRAINT creators_display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 80)
);

CREATE INDEX creators_user_id_idx ON creators (user_id);
CREATE INDEX creators_youtube_channel_id_idx ON creators (youtube_channel_id);

-- =============================================================================
-- TRIGGER TAGS
-- Curated taxonomy. Seeded via supabase/seed.sql. Users cannot add tags.
-- =============================================================================

CREATE TABLE trigger_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  category    trigger_category NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT trigger_tags_slug_unique UNIQUE (slug),
  CONSTRAINT trigger_tags_label_unique UNIQUE (label)
);

CREATE INDEX trigger_tags_category_idx ON trigger_tags (category);
CREATE INDEX trigger_tags_slug_idx ON trigger_tags (slug);

-- =============================================================================
-- CONTENT
-- A piece of content linked to a YouTube video.
-- =============================================================================

CREATE TABLE content (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  youtube_video_id    TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  duration_seconds    INTEGER,          -- from YouTube Data API
  thumbnail_url       TEXT,
  published_at        TIMESTAMPTZ,      -- YouTube publish date
  status              content_status NOT NULL DEFAULT 'pending',
  transcript_available BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_youtube_id_unique UNIQUE (youtube_video_id),
  CONSTRAINT content_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds > 0)
);

CREATE INDEX content_creator_id_idx ON content (creator_id);
CREATE INDEX content_youtube_video_id_idx ON content (youtube_video_id);
CREATE INDEX content_status_idx ON content (status);
CREATE INDEX content_title_trgm_idx ON content USING gin (title gin_trgm_ops);

-- =============================================================================
-- CONTENT TRIGGERS
-- Many-to-many: content ↔ trigger_tags.
-- Can be creator-labeled or LLM-inferred (or both).
-- =============================================================================

CREATE TABLE content_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id      UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  trigger_tag_id  UUID NOT NULL REFERENCES trigger_tags(id) ON DELETE CASCADE,
  source          TEXT NOT NULL DEFAULT 'llm' CHECK (source IN ('creator', 'llm', 'both')),
  confidence      NUMERIC(4,3),   -- LLM confidence score 0.000–1.000
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT content_triggers_unique UNIQUE (content_id, trigger_tag_id)
);

CREATE INDEX content_triggers_content_id_idx ON content_triggers (content_id);
CREATE INDEX content_triggers_trigger_tag_id_idx ON content_triggers (trigger_tag_id);

-- =============================================================================
-- USER PROFILES
-- Extended profile for all authenticated users (listeners + creators).
-- =============================================================================

CREATE TABLE user_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  avatar_url            TEXT,
  is_creator            BOOLEAN NOT NULL DEFAULT false,
  -- JSONB array of trigger_tag UUIDs representing preferred triggers
  preferred_trigger_ids JSONB NOT NULL DEFAULT '[]',
  -- Discovery preferences
  discovery_enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id)
);

CREATE INDEX user_profiles_user_id_idx ON user_profiles (user_id);

-- =============================================================================
-- TINGLE EVENTS
-- The core event table. One row per tingle logged by a user.
-- High write volume — partitioning candidate in future.
-- =============================================================================

CREATE TABLE tingle_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id    UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  timestamp_ms  INTEGER NOT NULL,   -- milliseconds from video start
  intensity     tingle_intensity NOT NULL DEFAULT '3',
  notes         TEXT,               -- optional free text (mobile long-press)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tingle_events_timestamp_positive CHECK (timestamp_ms >= 0),
  CONSTRAINT tingle_events_notes_length CHECK (notes IS NULL OR char_length(notes) <= 280)
);

CREATE INDEX tingle_events_user_id_idx ON tingle_events (user_id);
CREATE INDEX tingle_events_content_id_idx ON tingle_events (content_id);
CREATE INDEX tingle_events_content_timestamp_idx ON tingle_events (content_id, timestamp_ms);
CREATE INDEX tingle_events_created_at_idx ON tingle_events (created_at DESC);

-- =============================================================================
-- INSIGHTS CACHE
-- LLM-generated insight reports per content item.
-- Written by Inngest (service role). Read by content owner only.
-- =============================================================================

CREATE TABLE insights_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  status        insight_status NOT NULL DEFAULT 'pending',
  report        JSONB,              -- structured report from Claude
  error_message TEXT,
  generated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT insights_cache_content_id_unique UNIQUE (content_id)
);

CREATE INDEX insights_cache_content_id_idx ON insights_cache (content_id);
CREATE INDEX insights_cache_status_idx ON insights_cache (status);

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Automatically updates updated_at on row changes.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER insights_cache_updated_at
  BEFORE UPDATE ON insights_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE creators        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trigger_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE content         ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tingle_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights_cache  ENABLE ROW LEVEL SECURITY;

-- ---- creators ---------------------------------------------------------------

CREATE POLICY "creators_public_read"
  ON creators FOR SELECT
  USING (true);

CREATE POLICY "creators_owner_insert"
  ON creators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "creators_owner_update"
  ON creators FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "creators_owner_delete"
  ON creators FOR DELETE
  USING (auth.uid() = user_id);

-- ---- trigger_tags -----------------------------------------------------------

CREATE POLICY "trigger_tags_public_read"
  ON trigger_tags FOR SELECT
  USING (true);

-- Write is service-role only (no user-facing policy needed; RLS blocks anon/auth)

-- ---- content ----------------------------------------------------------------

CREATE POLICY "content_public_read"
  ON content FOR SELECT
  USING (true);

CREATE POLICY "content_owner_insert"
  ON content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = content.creator_id
        AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "content_owner_update"
  ON content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = content.creator_id
        AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "content_owner_delete"
  ON content FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM creators
      WHERE creators.id = content.creator_id
        AND creators.user_id = auth.uid()
    )
  );

-- ---- content_triggers -------------------------------------------------------

CREATE POLICY "content_triggers_public_read"
  ON content_triggers FOR SELECT
  USING (true);

CREATE POLICY "content_triggers_owner_insert"
  ON content_triggers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = content_triggers.content_id
        AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "content_triggers_owner_delete"
  ON content_triggers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = content_triggers.content_id
        AND creators.user_id = auth.uid()
    )
  );

-- ---- user_profiles ----------------------------------------------------------

CREATE POLICY "user_profiles_owner_read"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_owner_insert"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_owner_update"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ---- tingle_events ----------------------------------------------------------

CREATE POLICY "tingle_events_owner_read"
  ON tingle_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tingle_events_owner_insert"
  ON tingle_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tingle_events_owner_update"
  ON tingle_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "tingle_events_owner_delete"
  ON tingle_events FOR DELETE
  USING (auth.uid() = user_id);

-- Allow creators to read aggregate tingle data for their own content
-- (used for heatmap dashboards — returns tingle_events without user_id)
CREATE POLICY "tingle_events_creator_aggregate_read"
  ON tingle_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = tingle_events.content_id
        AND creators.user_id = auth.uid()
    )
  );

-- ---- insights_cache ---------------------------------------------------------

CREATE POLICY "insights_cache_owner_read"
  ON insights_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = insights_cache.content_id
        AND creators.user_id = auth.uid()
    )
  );

-- Write is service-role only (Inngest job)

-- =============================================================================
-- USEFUL VIEWS
-- =============================================================================

-- Heatmap data for a piece of content (used by creator dashboard)
-- Returns bucketed tingle counts across the video duration
CREATE OR REPLACE VIEW content_tingle_heatmap AS
SELECT
  te.content_id,
  -- Bucket into 10-second windows
  (te.timestamp_ms / 10000) * 10000 AS bucket_start_ms,
  COUNT(*)                           AS tingle_count,
  AVG(te.intensity::text::int)             AS avg_intensity
FROM tingle_events te
GROUP BY te.content_id, bucket_start_ms
ORDER BY te.content_id, bucket_start_ms;

-- Top triggers for a creator (across all their content)
CREATE OR REPLACE VIEW creator_top_triggers AS
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
CREATE OR REPLACE VIEW user_trigger_affinity AS
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
