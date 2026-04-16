import { z } from "zod";
import { inngest } from "@/inngest/client";
import { getSupabaseServerClient } from "@tingle/database";
import { getAnthropicClient, CLAUDE_MODEL, buildAudioHeatmapPredictionPrompt } from "@tingle/ai";
import { fetchYouTubeTimedTranscript } from "@/lib/youtube";
import type { PredictedHeatmapBucket } from "@tingle/types";

// =============================================================================
// audio.analyze
// Triggered by "content/ingested" in parallel with content.process.
// Fetches timed captions, asks Claude to predict a tingle heatmap, and writes
// the result to insights_cache.predicted_heatmap.
//
// Deliberately does NOT touch insights_cache.report or insights_cache.status —
// those are owned by content.process.
// =============================================================================

const EventPayloadSchema = z.object({
  contentId: z.string().uuid(),
  creatorId: z.string().uuid(),
});

const PredictedBucketSchema = z.array(
  z.object({
    bucket_start_ms: z.number().int().nonnegative(),
    bucket_end_ms: z.number().int().positive(),
    predicted_intensity: z.number().min(1).max(5),
    confidence: z.number().min(0).max(1),
    dominant_trigger_slugs: z.array(z.string()).min(1).max(3),
  })
);

export const audioAnalyze = inngest.createFunction(
  { id: "audio.analyze", name: "Audio Analysis: Predict Tingle Heatmap" },
  { event: "content/ingested" },
  async ({ event, step }) => {
    const { contentId } = EventPayloadSchema.parse(event.data);
    const db = getSupabaseServerClient();

    try {
      // ---- 1. Fetch content metadata ------------------------------------------
      const contentMeta = await step.run("fetch-content-meta", async () => {
        const { data, error } = await db
          .from("content")
          .select("youtube_video_id, duration_seconds, transcript_available, title, description")
          .eq("id", contentId)
          .single();
        if (error || !data) throw new Error(`Content not found: ${error?.message}`);
        return data;
      });

      // ---- 2. Fetch timed transcript (best-effort) -----------------------------
      const timedSegments = await step.run("fetch-timed-transcript", async () => {
        if (!contentMeta.transcript_available) return null;
        return fetchYouTubeTimedTranscript(contentMeta.youtube_video_id);
      });

      // ---- 3. Fetch trigger tags -----------------------------------------------
      const triggerTags = await step.run("fetch-trigger-tags", async () => {
        const { data, error } = await db
          .from("trigger_tags")
          .select("slug, label, category");
        if (error) throw new Error(`Failed to fetch trigger tags: ${error.message}`);
        return data ?? [];
      });

      // ---- 4. Predict heatmap with Claude -------------------------------------
      const predictedBuckets = await step.run("predict-heatmap-with-claude", async () => {
        const prompt = buildAudioHeatmapPredictionPrompt({
          title: contentMeta.title,
          description: contentMeta.description ?? null,
          timedSegments,
          durationSeconds: contentMeta.duration_seconds ?? 0,
          availableTags: triggerTags,
        });

        const anthropic = getAnthropicClient();
        const message = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });

        const rawText =
          message.content[0]?.type === "text" ? message.content[0].text : "";
        const jsonText = rawText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
        }

        return PredictedBucketSchema.parse(parsed);
      });

      if (predictedBuckets.length === 0) {
        return { contentId, skipped: true, reason: "Claude returned no peak buckets" };
      }

      // ---- 5. Persist predicted heatmap ----------------------------------------
      // Upsert only the predicted_heatmap column so content.process's report/status
      // fields are never overwritten, regardless of job ordering.
      await step.run("store-predicted-heatmap", async () => {
        const buckets: PredictedHeatmapBucket[] = predictedBuckets.map((b) => ({
          ...b,
          source: "transcript_analysis" as const,
        }));

        const { error } = await db
          .from("insights_cache")
          .upsert(
            {
              content_id: contentId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB lacks index signature
              predicted_heatmap: buckets as any,
            },
            { onConflict: "content_id" }
          );

        if (error) throw new Error(`Failed to store predicted heatmap: ${error.message}`);
      });

      return { contentId, bucketsStored: predictedBuckets.length };
    } catch (err) {
      // audio.analyze errors are non-fatal — do not mark insights_cache as error.
      // content.process owns the status field.
      const reason = err instanceof Error ? err.message : String(err);
      return { contentId, skipped: true, reason };
    }
  }
);
