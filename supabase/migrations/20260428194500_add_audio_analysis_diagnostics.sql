-- Store lightweight diagnostics for audio.analyze outcomes.
-- Helps triage empty predicted_heatmap cases without reading function logs.

ALTER TABLE insights_cache
  ADD COLUMN IF NOT EXISTS audio_analysis_diagnostics JSONB;

COMMENT ON COLUMN insights_cache.audio_analysis_diagnostics IS
  'Diagnostics from audio.analyze (bucket counts, unresolved slug stats, signal availability, worker status).';
