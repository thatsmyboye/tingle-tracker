-- Add audio-analysis predicted heatmap column to insights_cache.
-- Written by the audio.analyze Inngest job independently of the existing
-- report column (which content.process owns). Stored as a sparse JSONB array
-- of PredictedHeatmapBucket objects covering only notable peaks (intensity >= 3).
ALTER TABLE insights_cache
  ADD COLUMN IF NOT EXISTS predicted_heatmap JSONB;
