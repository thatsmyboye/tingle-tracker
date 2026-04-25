import { z } from "zod";
import { inngest } from "@/inngest/client";
import { getSupabaseServerClient } from "@tingle/database";
import {
  getAnthropicClient,
  CLAUDE_MODEL,
  buildAudioHeatmapPredictionPrompt,
  buildTriggerSlugResolver,
} from "@tingle/ai";
import { fetchYouTubeTimedTranscript } from "@/lib/youtube";
import { parseClaudeJsonArray } from "@/lib/parseClaudeJsonArray";
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

type AudioWorkerStatus = "used" | "skipped_unconfigured" | "failed";

export const audioAnalyze = inngest.createFunction(
  { id: "audio.analyze", name: "Audio Analysis: Predict Tingle Heatmap", triggers: [{ event: "content/ingested" }] },
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
      let audioWorkerStatus: AudioWorkerStatus = "skipped_unconfigured";

      const audioFeatures = await step.run("extract-audio-features", async () => {
        const workerUrl = process.env.AUDIO_WORKER_URL;
        if (!workerUrl) {
          console.log(`[audio.analyze] AUDIO_WORKER_URL not set — skipping worker for contentId=${contentId}`);
          return null;
        }

        const secret = process.env.AUDIO_WORKER_SECRET ?? "";
        // Trailing slash on AUDIO_WORKER_URL would otherwise produce `//extract` (404 on FastAPI).
        const workerBase = workerUrl.trim().replace(/\/+$/, "");

        try {
          const res = await fetch(`${workerBase}/extract`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Worker-Secret": secret,
            },
            body: JSON.stringify({
              youtube_video_id: contentMeta.youtube_video_id,
              duration_seconds: contentMeta.duration_seconds ?? 0,
            }),
            // Stay under Vercel maxDuration=300s with buffer for Inngest + Fly wake-up.
            // Worker yt-dlp timeout is 720s — very long downloads may still fall back to captions-only.
            signal: AbortSignal.timeout(285_000),
          });

          if (!res.ok) {
            const body = await res.text().catch(() => "(unreadable)");
            console.error(`[audio.analyze] worker returned HTTP ${res.status} for contentId=${contentId}: ${body.slice(0, 400)}`);
            return { features: null as AudioFeatureWindow[] | null, workerOk: false as const };
          }

          const data = await res.json() as { features?: unknown };
          const parsed = AudioFeatureWindowSchema.safeParse(data.features);
          if (!parsed.success) {
            console.error(`[audio.analyze] worker response failed schema validation for contentId=${contentId}:`, parsed.error.flatten());
            return { features: null as AudioFeatureWindow[] | null, workerOk: false as const };
          }
          return { features: parsed.data as AudioFeatureWindow[], workerOk: true as const };
        } catch (err) {
          console.error(`[audio.analyze] worker fetch failed for contentId=${contentId}:`, err instanceof Error ? err.message : String(err));
          return { features: null as AudioFeatureWindow[] | null, workerOk: false as const };
        }
      });

      const audioFeaturesResult = audioFeatures as
        | AudioFeatureWindow[]
        | { features: AudioFeatureWindow[] | null; workerOk: boolean }
        | null;

      const rawFeatures: AudioFeatureWindow[] | null = Array.isArray(audioFeaturesResult)
        ? audioFeaturesResult
        : audioFeaturesResult?.features ?? null;

      const audioFeaturesResolved: AudioFeatureWindow[] | null =
        rawFeatures && rawFeatures.length > 0 ? rawFeatures : null;

      if (audioFeaturesResult && !Array.isArray(audioFeaturesResult)) {
        audioWorkerStatus =
          audioFeaturesResult.workerOk && audioFeaturesResolved ? "used" : "failed";
      }

      // ---- 4. Fetch trigger tags + aliases -------------------------------------
      const { triggerTags, tagAliases } = await step.run("fetch-trigger-tags", async () => {
        const [tagsRes, aliasesRes] = await Promise.all([
          db.from("trigger_tags").select("id, slug, label, category, display_group"),
          db.from("trigger_tag_aliases").select("alias_slug, trigger_tag_id"),
        ]);
        if (tagsRes.error) throw new Error(`Failed to fetch trigger tags: ${tagsRes.error.message}`);
        if (aliasesRes.error) throw new Error(`Failed to fetch trigger tag aliases: ${aliasesRes.error.message}`);
        return { triggerTags: tagsRes.data ?? [], tagAliases: aliasesRes.data ?? [] };
      });

      const slugResolver = buildTriggerSlugResolver(triggerTags, tagAliases);

      // ---- 5. Guard: skip if there is no real signal to predict from ----------
      // Without transcript segments or audio features, Claude would hallucinate
      // a heatmap from title/description alone — that data is not trustworthy.
      if (!timedSegments?.length && !audioFeaturesResolved) {
        await step.run("store-no-signal-status", async () => {
          const { error } = await db
            .from("insights_cache")
            .upsert(
              { content_id: contentId, audio_worker_status: audioWorkerStatus },
              { onConflict: "content_id" }
            );
          if (error) throw new Error(`Failed to store audio_worker_status: ${error.message}`);
        });
        return { contentId, skipped: true, reason: "No transcript segments or audio features available", audioWorkerStatus };
      }

      // ---- 6. Predict heatmap with Claude -------------------------------------
      const predictedBuckets = await step.run("predict-heatmap-with-claude", async () => {
        console.log(
          `[audio.analyze:predict] contentId=${contentId} segments=${timedSegments?.length ?? 0} audioFeatures=${audioFeaturesResolved?.length ?? 0}`
        );
        const prompt = buildAudioHeatmapPredictionPrompt({
          title: contentMeta.title,
          description: contentMeta.description ?? null,
          timedSegments,
          durationSeconds: contentMeta.duration_seconds ?? 0,
          availableTags: triggerTags,
          audioFeatures: audioFeaturesResolved,
        });

        const anthropic = getAnthropicClient();
        const message = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        });

        const rawText =
          message.content[0]?.type === "text" ? message.content[0].text : "";

        const parsed = parseClaudeJsonArray(rawText);

        return PredictedBucketSchema.parse(parsed);
      });

      const canonicalBuckets = predictedBuckets
        .map((b) => {
          const dominant = [
            ...new Set(
              b.dominant_trigger_slugs
                .map((raw) => slugResolver.resolve(raw)?.slug)
                .filter((s): s is string => !!s)
            ),
          ].slice(0, 3);
          return { ...b, dominant_trigger_slugs: dominant };
        })
        .filter((b) => b.dominant_trigger_slugs.length > 0);

      if (canonicalBuckets.length === 0) {
        await step.run("store-audio-worker-status-only", async () => {
          const { error } = await db
            .from("insights_cache")
            .upsert({ content_id: contentId, audio_worker_status: audioWorkerStatus }, { onConflict: "content_id" });
          if (error) throw new Error(`Failed to store audio_worker_status: ${error.message}`);
        });
        return { contentId, skipped: true, reason: "No peak buckets with resolvable trigger slugs" };
      }

      // ---- 7. Persist predicted heatmap ----------------------------------------
      // Upsert only the predicted_heatmap column so content.process's report/status
      // fields are never overwritten, regardless of job ordering.
      await step.run("store-predicted-heatmap", async () => {
        // Mark source as "audio_features" when the worker contributed data,
        // "transcript_analysis" when falling back to captions/title only.
        const source: PredictedHeatmapBucket["source"] =
          audioFeaturesResolved != null ? "audio_features" : "transcript_analysis";

        const buckets: PredictedHeatmapBucket[] = canonicalBuckets.map((b) => ({
          ...b,
          source,
        }));

        const { error } = await db
          .from("insights_cache")
          .upsert(
            {
              content_id: contentId,
              audio_worker_status: audioWorkerStatus,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB lacks index signature
              predicted_heatmap: buckets as any,
            },
            { onConflict: "content_id" }
          );

        if (error) throw new Error(`Failed to store predicted heatmap: ${error.message}`);
      });

      return {
        contentId,
        bucketsStored: canonicalBuckets.length,
        source: audioFeaturesResolved != null ? "audio_features" : "transcript_analysis",
        audioWorkerStatus,
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
