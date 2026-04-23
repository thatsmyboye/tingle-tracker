import { z } from "zod";
import { inngest } from "@/inngest/client";
import { getSupabaseServerClient } from "@tingle/database";
import { getAnthropicClient, CLAUDE_MODEL, buildAudioHeatmapPredictionPrompt } from "@tingle/ai";
import { fetchYouTubeTimedTranscript } from "@/lib/youtube";
import type { PredictedHeatmapBucket, AudioFeatureWindow } from "@tingle/types";

// =============================================================================
// audio.analyze
// Triggered by "content/ingested" in parallel with content.process.
// Fetches timed captions + acoustic features, asks Claude to predict a tingle
// heatmap, and writes the result to insights_cache.predicted_heatmap.
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
    dominant_trigger_slugs: z.array(z.string()).max(3),
  })
);

const AudioFeatureWindowSchema = z.array(
  z.object({
    bucket_start_ms: z.number().int().nonnegative(),
    bucket_end_ms: z.number().int().positive(),
    rms_energy: z.number().nonnegative(),
    spectral_centroid: z.number().nonnegative(),
    zero_crossing_rate: z.number().nonnegative(),
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
      // Always attempt regardless of transcript_available flag — the Data API
      // misreports auto-generated captions as unavailable.
      const timedSegments = await step.run("fetch-timed-transcript", async () => {
        return fetchYouTubeTimedTranscript(contentMeta.youtube_video_id);
      });

      // ---- 3. Extract acoustic features via Python worker (best-effort) --------
      // Returns null when AUDIO_WORKER_URL is unset or the worker is unavailable.
      // The job proceeds with transcript-only analysis in that case.
      const audioFeatures = await step.run("extract-audio-features", async () => {
        const workerUrl = process.env.AUDIO_WORKER_URL;
        if (!workerUrl) {
          console.log(`[audio.analyze] AUDIO_WORKER_URL not set — skipping worker for contentId=${contentId}`);
          return null;
        }

        const secret = process.env.AUDIO_WORKER_SECRET ?? "";

        try {
          const res = await fetch(`${workerUrl}/extract`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Worker-Secret": secret,
            },
            body: JSON.stringify({
              youtube_video_id: contentMeta.youtube_video_id,
              duration_seconds: contentMeta.duration_seconds ?? 0,
            }),
            // 4-minute ceiling — fits within the route's maxDuration=300s with buffer for
            // Inngest overhead. Fly suspend wake-up (~1s) + extraction must land under this.
            signal: AbortSignal.timeout(240_000),
          });

          if (!res.ok) {
            const body = await res.text().catch(() => "(unreadable)");
            console.error(`[audio.analyze] worker returned HTTP ${res.status} for contentId=${contentId}: ${body.slice(0, 400)}`);
            return null;
          }

          const data = await res.json() as { features?: unknown };
          const parsed = AudioFeatureWindowSchema.safeParse(data.features);
          if (!parsed.success) {
            console.error(`[audio.analyze] worker response failed schema validation for contentId=${contentId}:`, parsed.error.flatten());
            return null;
          }
          return parsed.data as AudioFeatureWindow[];
        } catch (err) {
          console.error(`[audio.analyze] worker fetch failed for contentId=${contentId}:`, err instanceof Error ? err.message : String(err));
          return null;
        }
      });

      // ---- 4. Fetch trigger tags -----------------------------------------------
      const triggerTags = await step.run("fetch-trigger-tags", async () => {
        const { data, error } = await db
          .from("trigger_tags")
          .select("slug, label, category");
        if (error) throw new Error(`Failed to fetch trigger tags: ${error.message}`);
        return data ?? [];
      });

      // ---- 5. Predict heatmap with Claude -------------------------------------
      const predictedBuckets = await step.run("predict-heatmap-with-claude", async () => {
        console.log(`[audio.analyze:predict] contentId=${contentId} segments=${timedSegments?.length ?? 0} audioFeatures=${audioFeatures?.length ?? 0}`);
        const prompt = buildAudioHeatmapPredictionPrompt({
          title: contentMeta.title,
          description: contentMeta.description ?? null,
          timedSegments,
          durationSeconds: contentMeta.duration_seconds ?? 0,
          availableTags: triggerTags,
          audioFeatures,
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

      // ---- 6. Persist predicted heatmap ----------------------------------------
      // Upsert only the predicted_heatmap column so content.process's report/status
      // fields are never overwritten, regardless of job ordering.
      await step.run("store-predicted-heatmap", async () => {
        // Mark source as "audio_features" when the worker contributed data,
        // "transcript_analysis" when falling back to captions/title only.
        const source: PredictedHeatmapBucket["source"] =
          audioFeatures != null ? "audio_features" : "transcript_analysis";

        const buckets: PredictedHeatmapBucket[] = predictedBuckets.map((b) => ({
          ...b,
          source,
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

      return {
        contentId,
        bucketsStored: predictedBuckets.length,
        source: audioFeatures != null ? "audio_features" : "transcript_analysis",
      };
    } catch (err) {
      // audio.analyze errors are non-fatal — do not mark insights_cache as error.
      // content.process owns the status field.
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[audio.analyze] skipped contentId=${contentId}: ${reason}`);
      return { contentId, skipped: true, reason };
    }
  }
);
