-- Batch-imported creator rows (created by admin on behalf of external channels)
-- share the admin's user_id. Add an explicit flag so the dashboard query can
-- exclude them and return only the user's own personal creator profile.

ALTER TABLE creators
  ADD COLUMN is_batch_import BOOLEAN NOT NULL DEFAULT false;

-- Backfill: for any user_id that appears more than once, the oldest row is the
-- personal profile; every subsequent row was created by the batch import.
UPDATE creators
SET is_batch_import = true
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
    FROM creators
  ) ranked
  WHERE rn > 1
);
