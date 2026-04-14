-- =============================================================================
-- Sleep sessions
-- Migration: 20260414000000_sleep_sessions.sql
--
-- Adds the sleep_sessions table to record when a listener activates Sleep Mode
-- while watching ASMR content, and (via a follow-up prompt) whether they
-- actually fell asleep.
--
-- RLS:
--   - Owner: full CRUD on their own rows (anonymous users included — they get
--     a real Supabase UUID via signInAnonymously)
--   - Creator: SELECT on all rows tied to their content (for aggregate analytics)
-- =============================================================================

CREATE TABLE sleep_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  content_id  uuid        NOT NULL REFERENCES content(id)     ON DELETE CASCADE,
  fell_asleep boolean,    -- NULL = unanswered; true/false = listener's response
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sleep_sessions_user_id_idx    ON sleep_sessions (user_id);
CREATE INDEX sleep_sessions_content_id_idx ON sleep_sessions (content_id);

ALTER TABLE sleep_sessions ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own rows
CREATE POLICY "sleep_sessions_owner"
  ON sleep_sessions
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Creator: read all sleep sessions for their content (analytics)
CREATE POLICY "sleep_sessions_creator_read"
  ON sleep_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content
      JOIN creators ON creators.id = content.creator_id
      WHERE content.id = sleep_sessions.content_id
        AND creators.user_id = auth.uid()
    )
  );

-- Keep updated_at current (reuses the function from the initial schema)
CREATE TRIGGER sleep_sessions_updated_at
  BEFORE UPDATE ON sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
