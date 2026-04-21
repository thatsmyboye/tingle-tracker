// =============================================================================
// Tingle Tracker — Shared TypeScript Interfaces
// These mirror the Supabase schema in supabase/migrations/20260408000000_initial_schema.sql
// =============================================================================

// ---- Enums ------------------------------------------------------------------

export type TriggerCategory = "visual" | "aural" | "tactile_adjacent";

export type CreatorPlan = "free" | "pro" | "studio";

/** String ENUM matching Postgres tingle_intensity enum values */
export type TingleIntensity = "1" | "2" | "3" | "4" | "5";

/** Supported content platforms */
export type ContentPlatform = "youtube" | "vimeo" | "soundcloud";

// ---- Player adapter ---------------------------------------------------------

/**
 * Shared interface all video/audio player components must satisfy.
 * getCurrentTimeMs / getDurationMs may return a Promise because some
 * platforms (Vimeo, SoundCloud) are inherently async (postMessage bridge).
 * YouTube returns synchronously but is also typed as Promise for uniformity.
 */
export interface PlayerAdapterRef {
  getCurrentTimeMs(): Promise<number>;
  getDurationMs(): Promise<number>;
  pause(): void;
  play(): void;
  seekToMs(ms: number): void;
}

export type ContentStatus = "pending" | "processing" | "ready" | "error";

export type InsightStatus = "pending" | "generating" | "ready" | "error";

export type ContentTriggerSource = "creator" | "llm" | "both";

// ---- Database row types -----------------------------------------------------

export interface Creator {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  youtube_channel_id: string | null;
  youtube_channel_url: string | null;
  is_verified: boolean;
  plan: CreatorPlan;
  created_at: string;
  updated_at: string;
}

export interface TriggerTag {
  id: string;
  label: string;
  slug: string;
  category: TriggerCategory;
  description: string | null;
  created_at: string;
}

export interface Content {
  id: string;
  creator_id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  status: ContentStatus;
  transcript_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentTrigger {
  id: string;
  content_id: string;
  trigger_tag_id: string;
  source: ContentTriggerSource;
  /** LLM confidence score 0.000–1.000 */
  confidence: number | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_creator: boolean;
  /** JSONB array of trigger_tag UUIDs */
  preferred_trigger_ids: string[];
  discovery_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface TingleEvent {
  id: string;
  user_id: string;
  content_id: string;
  /** Milliseconds from video start */
  timestamp_ms: number;
  intensity: TingleIntensity;
  /** Optional free text, max 280 chars */
  notes: string | null;
  created_at: string;
}

export interface InsightsCache {
  id: string;
  content_id: string;
  status: InsightStatus;
  /** Structured report JSON from Claude */
  report: InsightReport | null;
  /** Sparse predicted heatmap from audio.analyze — only notable peaks (intensity >= 3) */
  predicted_heatmap: PredictedHeatmapBucket[] | null;
  error_message: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ---- View row types ---------------------------------------------------------

export interface ContentTingleHeatmapRow {
  content_id: string;
  /** Milliseconds — start of 10-second bucket */
  bucket_start_ms: number;
  tingle_count: number;
  avg_intensity: number;
}

export interface CreatorTopTriggerRow {
  creator_id: string;
  trigger_tag_id: string;
  trigger_label: string;
  trigger_category: TriggerCategory;
  total_tingles: number;
  avg_intensity: number;
}

export interface UserTriggerAffinityRow {
  user_id: string;
  trigger_tag_id: string;
  trigger_label: string;
  trigger_category: TriggerCategory;
  tingle_count: number;
  avg_intensity: number;
}

// ---- AI / LLM types ---------------------------------------------------------

// ---- YouTube utilities ------------------------------------------------------

/** A single timed caption segment from YouTube's timedtext API */
export interface TimedTranscriptSegment {
  text: string;
  /** Start time in milliseconds from video start */
  start_ms: number;
  /** Duration in milliseconds */
  duration_ms: number;
}

/** Raw acoustic features for a single 30-second window, returned by the Python audio worker */
export interface AudioFeatureWindow {
  bucket_start_ms: number;
  bucket_end_ms: number;
  /** Root mean square amplitude — higher = louder */
  rms_energy: number;
  /** Center-of-mass of the frequency spectrum in Hz — lower ≈ bass/whisper, higher ≈ crisp/bright */
  spectral_centroid: number;
  /** Rate of audio signal sign changes — higher = more texture/noise (tapping, crinkling) */
  zero_crossing_rate: number;
}

/** One 30-second bucket in the audio-analysis predicted heatmap (sparse — only notable peaks) */
export interface PredictedHeatmapBucket {
  bucket_start_ms: number;
  bucket_end_ms: number;
  /** Predicted tingle intensity 1.0–5.0 */
  predicted_intensity: number;
  /** Claude confidence 0–1 */
  confidence: number;
  /** Trigger slugs that dominate this window */
  dominant_trigger_slugs: string[];
  /** Extensible: "transcript_analysis" now, "audio_features" once a Python worker is wired up */
  source: "transcript_analysis" | "audio_features";
}

/** Shape of the JSON stored in insights_cache.report */
export interface InsightReport {
  generated_at: string;
  content_id: string;
  summary: string;
  top_triggers: Array<{
    trigger_tag_id: string;
    label: string;
    category: TriggerCategory;
    confidence: number;
    timestamp_examples_ms: number[];
  }>;
  heatmap_highlights: Array<{
    bucket_start_ms: number;
    bucket_end_ms: number;
    description: string;
  }>;
}

// ---- Insert / Update helpers ------------------------------------------------

export type CreatorInsert = Omit<Creator, "id" | "created_at" | "updated_at" | "is_verified">;
export type ContentInsert = Omit<Content, "id" | "created_at" | "updated_at">;
export type TingleEventInsert = Omit<TingleEvent, "id" | "created_at">;
export type UserProfileInsert = Omit<UserProfile, "id" | "created_at" | "updated_at">;
