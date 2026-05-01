CREATE TABLE creator_intake_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_channel_id    TEXT NOT NULL,
  youtube_channel_url   TEXT NOT NULL,
  channel_title         TEXT NOT NULL,
  uploads_playlist_id   TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason      TEXT,
  reviewed_by_user_id   UUID REFERENCES auth.users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prevent duplicate active submissions for the same channel globally
CREATE UNIQUE INDEX uq_intake_channel_active
  ON creator_intake_submissions (youtube_channel_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX idx_intake_submitted_by ON creator_intake_submissions (submitted_by_user_id);
CREATE INDEX idx_intake_status       ON creator_intake_submissions (status);

CREATE TRIGGER set_creator_intake_updated_at
  BEFORE UPDATE ON creator_intake_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE creator_intake_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake: owner read"
  ON creator_intake_submissions FOR SELECT
  USING (submitted_by_user_id = auth.uid());

CREATE POLICY "intake: admin read"
  ON creator_intake_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "intake: authenticated insert"
  ON creator_intake_submissions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND submitted_by_user_id = auth.uid());
