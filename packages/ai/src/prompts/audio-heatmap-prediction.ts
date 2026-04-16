import type { TriggerTag, TimedTranscriptSegment } from "@tingle/types";

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

export function buildAudioHeatmapPredictionPrompt(
  input: AudioHeatmapPredictionInput
): string {
  const tagList = input.availableTags
    .map((t) => `- ${t.slug} (${t.category}): ${t.label}`)
    .join("\n");

  const transcriptBlock = input.timedSegments
    ? `## Timed Captions (timestamp: text)\n${formatSegments(input.timedSegments)}`
    : "No captions available — use title and description to estimate.";

  const totalMinutes = Math.ceil(input.durationSeconds / 60);
  const bucketSizeMs = 30_000;

  return `You are predicting which 30-second windows of an ASMR video will cause the strongest tingle response in listeners.

## Video Information
**Title:** ${input.title}
**Duration:** ${totalMinutes} minutes
${input.description ? `**Description:** ${input.description.slice(0, 500)}` : ""}

${transcriptBlock}

## Trigger Taxonomy
${tagList}

## Your Task
Identify the 30-second windows (buckets) most likely to trigger tingles. Focus on:
- Sustained soft whispering or slow speech sections
- Repetitive tactile sounds (tapping, crinkling, scratching, typing)
- Binaural or close-mic audio moments
- Roleplay or care scenarios
- Noticeably quiet, deliberate pacing

Return ONLY the notable peak buckets — windows where predicted intensity is 3.0 or higher.
Skip the intro/outro unless they contain strong ASMR activity.
Return at most 40 buckets.

Bucket size: ${bucketSizeMs}ms (30 seconds).

Each bucket object must have:
- \`bucket_start_ms\`: integer, milliseconds from start (multiple of ${bucketSizeMs})
- \`bucket_end_ms\`: integer, equals bucket_start_ms + ${bucketSizeMs}
- \`predicted_intensity\`: float 1.0–5.0 (3.0 minimum since you're only returning peaks)
- \`confidence\`: float 0.0–1.0
- \`dominant_trigger_slugs\`: array of 1–3 slugs from the taxonomy above

Respond with ONLY a valid JSON array, no markdown or explanation.

Example:
[
  { "bucket_start_ms": 60000, "bucket_end_ms": 90000, "predicted_intensity": 4.2, "confidence": 0.85, "dominant_trigger_slugs": ["whispering", "close-up"] },
  { "bucket_start_ms": 150000, "bucket_end_ms": 180000, "predicted_intensity": 3.8, "confidence": 0.7, "dominant_trigger_slugs": ["tapping"] }
]`;
}
