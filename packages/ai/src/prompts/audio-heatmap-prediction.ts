import type { TriggerTag, TimedTranscriptSegment, AudioFeatureWindow } from "@tingle/types";

// =============================================================================
// Prompt: Audio Heatmap Prediction
// Used by the audio.analyze Inngest job to generate a predicted tingle heatmap
// from timed captions before any real listener data exists.
// =============================================================================

export interface AudioHeatmapPredictionInput {
  title: string;
  description: string | null;
  /** Timed caption segments; null when captions are unavailable */
  timedSegments: TimedTranscriptSegment[] | null;
  durationSeconds: number;
  availableTags: Pick<TriggerTag, "slug" | "label" | "category">[];
  /** Per-window acoustic features from the Python worker; null when worker is unavailable */
  audioFeatures?: AudioFeatureWindow[] | null;
}

/** Serialise timed segments into a compact text block for the prompt */
function formatSegments(segments: TimedTranscriptSegment[]): string {
  // Keep at most 200 segments to stay within token budget
  return segments
    .slice(0, 200)
    .map((s) => {
      const mins = Math.floor(s.start_ms / 60000);
      const secs = Math.floor((s.start_ms % 60000) / 1000);
      const timestamp = `${mins}:${String(secs).padStart(2, "0")}`;
      return `[${timestamp}] ${s.text}`;
    })
    .join("\n");
}

/** Serialise audio features into a compact text block for the prompt */
function formatAudioFeatures(features: AudioFeatureWindow[]): string {
  // Cap at 120 windows (~1 hour) to stay within token budget
  return features
    .slice(0, 120)
    .map((f) => {
      const mins = Math.floor(f.bucket_start_ms / 60000);
      const secs = Math.floor((f.bucket_start_ms % 60000) / 1000);
      const ts = `${mins}:${String(secs).padStart(2, "0")}`;
      return `[${ts}] rms=${f.rms_energy.toFixed(4)} centroid=${Math.round(f.spectral_centroid)}Hz zcr=${f.zero_crossing_rate.toFixed(4)}`;
    })
    .join("\n");
}

export function buildAudioHeatmapPredictionPrompt(
  input: AudioHeatmapPredictionInput
): string {
  const tagList = input.availableTags
    .map((t) => `- ${t.slug} (${t.category}): ${t.label}`)
    .join("\n");

  const transcriptBlock = input.timedSegments
    ? `## Timed Captions (timestamp: text)\n${formatSegments(input.timedSegments)}`
    : "No captions available — use title, description, and audio features to estimate.";

  const audioBlock = input.audioFeatures && input.audioFeatures.length > 0
    ? `## Acoustic Features (per 30-second window)
Format: [timestamp] rms=<amplitude> centroid=<Hz> zcr=<zero-crossing-rate>

Interpretation:
- rms_energy: loudness (higher = louder; ASMR whispers typically 0.005–0.03)
- spectral_centroid: frequency character (lower ≈ bass/whisper; higher ≈ crisp/bright)
- zero_crossing_rate: texture (higher = noise/texture like tapping/crinkling; lower = pure tone)

ASMR signal patterns:
- Whispering/soft speaking: low rms + low zcr + low-mid centroid
- Tapping/crinkling/scratching: moderate rms + high zcr
- Near silence or deliberate pause: very low rms
- Page turning/plastic sounds: moderate rms + mid-high centroid

${formatAudioFeatures(input.audioFeatures)}`
    : null;

  const totalMinutes = Math.ceil(input.durationSeconds / 60);
  const bucketSizeMs = 30_000;

  return `You are predicting which 30-second windows of an ASMR video will cause the strongest tingle response in listeners.

## Video Information
**Title:** ${input.title}
**Duration:** ${totalMinutes} minutes
${input.description ? `**Description:** ${input.description.slice(0, 500)}` : ""}

${transcriptBlock}

${audioBlock ?? "No acoustic feature data available."}

## Trigger Taxonomy
${tagList}

## Your Task
Identify the 30-second windows (buckets) most likely to trigger tingles. Focus on:
- Sustained soft whispering or slow speech sections
- Repetitive tactile sounds (tapping, crinkling, scratching, typing)
- Binaural or close-mic audio moments
- Roleplay or care scenarios
- Noticeably quiet, deliberate pacing

${audioBlock ? "Use the acoustic features as primary signal — windows with low rms + low zcr strongly indicate whispering; high zcr indicates tactile triggers. Captions provide context for the trigger type." : ""}

Return ONLY the notable peak buckets — windows where predicted intensity is 3.0 or higher.
Skip the intro/outro unless they contain strong ASMR activity.
Return at most 40 buckets.

Bucket size: ${bucketSizeMs}ms (30 seconds).

Each bucket object must have:
- \`bucket_start_ms\`: integer, milliseconds from start (multiple of ${bucketSizeMs})
- \`bucket_end_ms\`: integer, equals bucket_start_ms + ${bucketSizeMs}
- \`predicted_intensity\`: float 1.0–5.0 (3.0 minimum since you're only returning peaks)
- \`confidence\`: float 0.0–1.0
- \`dominant_trigger_slugs\`: array of 1–3 slugs — use ONLY canonical slugs that appear in the taxonomy above (the exact value before the category in each bullet, e.g. \`close-up\`, not labels like "Close-up shots"), do not invent new ones

Respond with ONLY a valid JSON array, no markdown or explanation.

Example:
[
  { "bucket_start_ms": 60000, "bucket_end_ms": 90000, "predicted_intensity": 4.2, "confidence": 0.85, "dominant_trigger_slugs": ["whispering", "close-up"] },
  { "bucket_start_ms": 150000, "bucket_end_ms": 180000, "predicted_intensity": 3.8, "confidence": 0.7, "dominant_trigger_slugs": ["tapping"] }
]`;
}
