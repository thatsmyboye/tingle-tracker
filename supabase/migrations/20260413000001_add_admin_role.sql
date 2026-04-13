-- =============================================================================
-- Add is_admin flag to user_profiles and allow admins to read all insights
-- =============================================================================

-- Add is_admin column (default false — no user is admin until manually granted)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Allow admin users to read any row in insights_cache
-- (existing policy only allows the content owner)
CREATE POLICY "insights_cache_admin_read"
  ON insights_cache
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND is_admin = true
    )
  );

-- Allow admin users to read all creators
-- (creators table already has a public read policy, so this is a no-op in
--  practice, but makes the intent explicit)

-- To grant admin access to a user, run in the Supabase SQL editor:
--   UPDATE user_profiles SET is_admin = true WHERE user_id = '<uuid>';
