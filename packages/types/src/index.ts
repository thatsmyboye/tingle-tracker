// =============================================================================
// Tingle Tracker — Shared TypeScript Interfaces
// These mirror the Supabase schema in supabase/migrations/20260408000000_initial_schema.sql
// =============================================================================

// ---- Enums ------------------------------------------------------------------

export type TriggerCategory = "visual" | "aural" | "tactile_adjacent";

export type CreatorPlan = "free" | "pro" | "studio";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
  plan_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TriggerTag {
  id: string;
  label: string;
  slug: string;
  category: TriggerCategory;
  description: string | null;
  /** UI grouping (sensory, vocal_style, style_genre, music, ambience, …) */
  display_group?: string;
  created_at: string;
}

export interface Content {
  id: string;
  /** Null for unclaimed content (creator not yet registered) */
  creator_id: string | null;
  youtube_video_id: string;
  youtube_channel_id: string | null;
  channel_title: string | null;
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

export interface ContentTriggerMoment {
  id: string;
  content_id: string;
  trigger_tag_id: string;
  timestamp_ms: number;
  confidence: number | null;
  source: "llm" | "listener";
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
  is_admin: boolean;
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
  /** Runtime diagnostics from audio.analyze for empty-heatmap triage */
  audio_analysis_diagnostics: AudioAnalysisDiagnostics | null;
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

/** Diagnostic counters emitted by audio.analyze */
export interface AudioAnalysisDiagnostics {
  content_id: string;
  audio_worker_status: "used" | "skipped_unconfigured" | "failed";
  has_timed_segments: boolean;
  timed_segment_count: number;
  has_audio_features: boolean;
  audio_feature_window_count: number;
  predicted_bucket_count: number;
  raw_slug_count: number;
  unique_raw_slug_count: number;
  unresolved_raw_slug_count: number;
  unresolved_unique_slug_count: number;
  canonical_bucket_count: number;
  dropped_bucket_count: number;
  dropped_bucket_ratio: number;
  dropped_due_to_unresolved_only_count: number;
  generated_at: string;
}

/** How the narrative paragraph was grounded (synopsis is never raw waveform audio). */
export type NarrativeInputSource = "transcript" | "title_description_only";

/** Structured listener-facing facets from a dedicated LLM step */
export interface ListenerProfile {
  style_genre: string[];
  vocal_style: string[];
  background_music: "none" | "detected" | "unclear";
  notes?: string;
}

/** Shape of the JSON stored in insights_cache.report */
export interface InsightReport {
  generated_at: string;
  content_id: string;
  /** One-sentence fallback summary (legacy / short form) */
  summary: string;
  /**
   * Claude-authored narrative paragraph describing the video's ASMR character,
   * based on transcript and/or audio features. Available on reports generated
   * after the transcript_analysis pipeline was introduced.
   */
  transcript_analysis?: string;
  /**
   * @deprecated Prefer narrative_input_source. Legacy field; narrative is transcript- or metadata-based only.
   */
  audio_source?: "transcript_analysis" | "audio_features";
  /** Whether the synopsis used transcript text or only title/description. */
  narrative_input_source?: NarrativeInputSource;
  /** Search/listener facets (style, vocal, music) — separate from sensory trigger tags */
  listener_profile?: ListenerProfile;
  top_triggers: Array<{
    trigger_tag_id: string;
    label: string;
    category: TriggerCategory;
    /** Dashboard grouping from trigger_tags.display_group */
    display_group?: string;
    confidence: number;
    timestamp_examples_ms: number[];
  }>;
  heatmap_highlights: Array<{
    bucket_start_ms: number;
    bucket_end_ms: number;
    description: string;
  }>;
  /** Classification diagnostics for taxonomy quality monitoring */
  tagging_health?: {
    candidate_count: number;
    resolved_count: number;
    unresolved_count: number;
    unresolved_unique_slugs: string[];
    low_confidence_count: number;
    phrase_fallback_resolved_count: number;
  };
}

export interface SleepSession {
  id: string;
  user_id: string;
  content_id: string;
  fell_asleep: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---- Creator Intake Submissions ----------------------------------------------

export type IntakeStatus = "pending" | "approved" | "rejected";

export interface CreatorIntakeSubmission {
  id: string;
  submitted_by_user_id: string;
  youtube_channel_id: string;
  youtube_channel_url: string;
  channel_title: string;
  uploads_playlist_id: string;
  status: IntakeStatus;
  rejection_reason: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreatorIntakeSubmissionInsert = Omit<
  CreatorIntakeSubmission,
  "id" | "rejection_reason" | "reviewed_by_user_id" | "reviewed_at" | "created_at" | "updated_at"
>;

// ---- Insert / Update helpers ------------------------------------------------

export type CreatorInsert = Omit<Creator, "id" | "created_at" | "updated_at" | "is_verified">;
export type ContentInsert = Omit<Content, "id" | "created_at" | "updated_at">;
export type TingleEventInsert = Omit<TingleEvent, "id" | "created_at">;
export type UserProfileInsert = Omit<UserProfile, "id" | "created_at" | "updated_at">;
