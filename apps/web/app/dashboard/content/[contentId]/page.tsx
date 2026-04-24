"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import { HeatmapChart } from "@/components/HeatmapChart";
import type { ContentTingleHeatmapRow, InsightReport, PredictedHeatmapBucket, CreatorPlan } from "@tingle/types";

// =============================================================================
// /dashboard/content/[contentId] — Per-video heatmap + trigger analysis
// =============================================================================

interface ContentDetail {
  id: string;
  creator_id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  status: "pending" | "processing" | "ready" | "error";
  transcript_available: boolean;
  created_at: string;
}

interface InsightsCacheRow {
  id: string;
  content_id: string;
  status: "pending" | "generating" | "ready" | "error";
  report: InsightReport | null;
  predicted_heatmap?: PredictedHeatmapBucket[] | null;
  audio_worker_status?: string | null;
  error_message: string | null;
  generated_at: string | null;
}

const STATUS_STYLES: Record<ContentDetail["status"], string> = {
  pending: "border-surface-muted/40 bg-surface-muted/10 text-surface-muted",
  processing: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  ready: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
};

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ContentDetailPage({
  params,
}: {
  params: { contentId: string };
}) {
  const { contentId } = params;
  const { user, isAnonymous, isLoading: authLoading } = useAuth();

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [heatmap, setHeatmap] = useState<ContentTingleHeatmapRow[]>([]);
  const [insights, setInsights] = useState<InsightsCacheRow | null>(null);
  const [creatorPlan, setCreatorPlan] = useState<CreatorPlan>("free");
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    setLoadingData(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    const [contentRes, heatmapRes, insightsRes] = await Promise.all([
      supabase.from("content").select("*").eq("id", contentId).single(),
      supabase
        .from("content_tingle_heatmap")
        .select("*")
        .eq("content_id", contentId)
        .order("bucket_start_ms", { ascending: true }),
      supabase
        .from("insights_cache")
        .select("*")
        .eq("content_id", contentId)
        .maybeSingle(),
    ]);

    if (contentRes.error) {
      setError(contentRes.error.message);
      setLoadingData(false);
      return;
    }

    setContent(contentRes.data as ContentDetail);
    setHeatmap((heatmapRes.data ?? []) as ContentTingleHeatmapRow[]);
    setInsights((insightsRes.data as InsightsCacheRow | null) ?? null);

    // Fetch the creator's plan — used to gate the predicted heatmap preview.
    // user.id is always set here (auth guard runs before loadData is called).
    if (user) {
      const planRes = await supabase
        .from("creators")
        .select("plan")
        .eq("user_id", user.id)
        .single();
      if (planRes.data?.plan) {
        setCreatorPlan(planRes.data.plan as CreatorPlan);
      }
    }

    setLoadingData(false);
  }

  useEffect(() => {
    if (!authLoading && user && !isAnonymous) {
      loadData();
    } else if (!authLoading) {
      setLoadingData(false);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAnonymous, authLoading, contentId]);

  // Poll every 5 seconds while content or insights are still processing
  useEffect(() => {
    const isProcessing =
      content?.status === "processing" || insights?.status === "generating" || insights?.status === "pending";

    if (!isProcessing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return; // already polling

    const supabase = getSupabaseBrowserClient();
    pollRef.current = setInterval(async () => {
      const [contentRes, insightsRes] = await Promise.all([
        supabase.from("content").select("*").eq("id", contentId).single(),
        supabase.from("insights_cache").select("*").eq("content_id", contentId).maybeSingle(),
      ]);

      if (contentRes.data) setContent(contentRes.data as ContentDetail);
      if (insightsRes.data) setInsights(insightsRes.data as InsightsCacheRow);

      // Once ready, also fetch heatmap (may now have data)
      if (contentRes.data?.status === "ready") {
        const heatmapRes = await supabase
          .from("content_tingle_heatmap")
          .select("*")
          .eq("content_id", contentId)
          .order("bucket_start_ms", { ascending: true });
        setHeatmap((heatmapRes.data ?? []) as ContentTingleHeatmapRow[]);
      }
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [content?.status, insights?.status, contentId]);

  // ---- Guards ----------------------------------------------------------------

  if (authLoading || loadingData) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-4xl mx-auto">
        <div className="space-y-3 mt-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded border border-surface-border bg-surface-elevated animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (!user || isAnonymous) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 flex flex-col items-center justify-center">
        <p className="text-sm text-surface-muted mb-4">Sign in to view content analytics.</p>
        <Link href="/" className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20">
          Go home
        </Link>
      </main>
    );
  }

  if (error || !content) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-4xl mx-auto">
        <Link href="/dashboard" className="text-xs text-surface-muted hover:text-tingle-aqua mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error ?? "Video not found or access denied."}
        </p>
      </main>
    );
  }

  // ---- Free-tier predicted heatmap gating -----------------------------------

  // Free plan creators see the first 10 minutes of AI prediction as a preview.
  // Pro and Studio see the full heatmap.
  const FREE_PREDICTED_CUTOFF_MS = 10 * 60 * 1000;
  const allPredictedBuckets = insights?.predicted_heatmap ?? [];
  const visiblePredictedBuckets =
    creatorPlan === "free"
      ? allPredictedBuckets.filter((b) => b.bucket_start_ms < FREE_PREDICTED_CUTOFF_MS)
      : allPredictedBuckets;
  const hasLockedPredicted =
    creatorPlan === "free" && allPredictedBuckets.length > visiblePredictedBuckets.length;

  // ---- Stats -----------------------------------------------------------------

  const totalTingles = heatmap.reduce((sum, b) => sum + b.tingle_count, 0);
  const avgIntensity =
    heatmap.length > 0
      ? heatmap.reduce((sum, b) => sum + b.avg_intensity, 0) / heatmap.length
      : 0;

  // When showing a predicted heatmap with no/few real listener events, the chart will display
  // the AI prediction. The stats row separately communicates the 0 real tingles vs AI triggers.

  // ---- Render ----------------------------------------------------------------

  return (
    <main className="min-h-screen bg-surface font-mono p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/dashboard" className="text-xs text-surface-muted hover:text-tingle-aqua flex items-center gap-1 mb-6">
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        {content.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail
          <img
            src={content.thumbnail_url}
            alt=""
            className="w-36 h-20 rounded object-cover flex-shrink-0 border border-surface-border"
          />
        ) : (
          <div className="w-36 h-20 rounded bg-surface-muted/30 flex-shrink-0 border border-surface-border" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl text-white leading-tight">{content.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span
              className={cn(
                "rounded px-2 py-1 text-[10px] uppercase tracking-wider border",
                STATUS_STYLES[content.status]
              )}
            >
              {content.status === "processing" && (
                <span className="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1" />
              )}
              {content.status}
            </span>
            <span className="text-xs text-surface-muted">{formatDate(content.published_at)}</span>
            <a
              href={`https://youtube.com/watch?v=${content.youtube_video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-tingle-aqua hover:underline"
            >
              View on YouTube ↗
            </a>
          </div>
        </div>
      </div>

      {/* Processing banner */}
      {content.status === "processing" && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-tingle-gold/30 bg-tingle-gold/10 px-4 py-3">
          <span className="w-3 h-3 border border-tingle-gold border-t-transparent rounded-full animate-spin" />
          <p className="font-mono text-xs text-tingle-gold">
            Processing — trigger analysis will appear shortly. This page refreshes automatically.
          </p>
        </div>
      )}

      {/* Error banner */}
      {content.status === "error" && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-mono text-xs text-red-400">
            Processing failed. The video may be private or unavailable.
          </p>
        </div>
      )}

      {/* Acoustic worker did not contribute — transcript/metadata analysis still completed */}
      {content.status === "ready" && insights?.audio_worker_status === "failed" && (
        <div className="mb-6 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3">
          <p className="font-mono text-xs text-amber-200/95">
            Acoustic analysis did not complete for this video. The AI heatmap and triggers used captions and
            metadata only, not the audio waveform.
          </p>
        </div>
      )}
      {content.status === "ready" && insights?.audio_worker_status === "skipped_unconfigured" && (
        <div className="mb-6 rounded-lg border border-surface-border/80 bg-surface-muted/5 px-4 py-2">
          <p className="font-mono text-[10px] text-surface-muted leading-relaxed">
            Acoustic worker is not configured — predictions used captions and metadata only.
          </p>
        </div>
      )}

      {/* Stats row */}
      {content.status === "ready" && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {totalTingles > 0 ? (
            <>
              <StatCard
                label="Total Tingles"
                value={totalTingles.toLocaleString()}
              />
              <StatCard
                label="Avg Intensity"
                value={avgIntensity > 0 ? avgIntensity.toFixed(2) : "—"}
              />
            </>
          ) : (
            <>
              <StatCard
                label="Listener Tingles"
                value="0"
                note="Actual"
              />
              <StatCard
                label="Detected Triggers"
                value={insights?.report?.top_triggers.length.toLocaleString() ?? "—"}
                note="AI"
              />
            </>
          )}
          <StatCard label="Duration" value={formatDuration(content.duration_seconds)} />
        </div>
      )}

      {/* Heatmap */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-4">Tingle Heatmap</h2>
        <HeatmapChart
          buckets={heatmap}
          durationSeconds={content.duration_seconds}
          predictedBuckets={visiblePredictedBuckets}
          realTingleTotal={totalTingles}
          lockedPredictedBuckets={hasLockedPredicted ? allPredictedBuckets.filter((b) => b.bucket_start_ms >= FREE_PREDICTED_CUTOFF_MS) : []}
        />
        {content.status === "ready" && (
          <HeatmapPipelineNote
            predictedBuckets={allPredictedBuckets}
            audioWorkerStatus={insights?.audio_worker_status ?? null}
          />
        )}
        {hasLockedPredicted && (
          <div className="mt-3 flex items-center justify-between rounded border border-tingle-gold/20 bg-tingle-gold/5 px-4 py-3">
            <div>
              <p className="font-mono text-xs text-tingle-gold">
                Prediction preview: First 10 minutes shown
              </p>
              <p className="font-mono text-[10px] text-surface-muted mt-0.5">
                Upgrade to Creator Pro to unlock the full predicted heatmap
              </p>
            </div>
            <Link
              href="/pricing"
              className="ml-4 whitespace-nowrap rounded border border-tingle-gold/40 bg-tingle-gold/10 px-3 py-1.5 text-xs text-tingle-gold hover:bg-tingle-gold/20"
            >
              Upgrade
            </Link>
          </div>
        )}
      </section>

      {/* Content analysis */}
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-4">Content Analysis</h2>
        <ContentAnalysis insights={insights} />
      </section>
    </main>
  );
}

// =============================================================================
// StatCard
// =============================================================================

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs uppercase tracking-widest text-surface-muted">{label}</p>
        {note && (
          <span className="rounded border border-surface-muted/20 bg-surface-muted/5 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-surface-muted/60">
            {note}
          </span>
        )}
      </div>
      <p className="text-2xl text-tingle-aqua tabular-nums">{value}</p>
    </div>
  );
}

// =============================================================================
// HeatmapPipelineNote
// =============================================================================

function HeatmapPipelineNote({
  predictedBuckets,
  audioWorkerStatus,
}: {
  predictedBuckets: PredictedHeatmapBucket[];
  audioWorkerStatus: string | null;
}) {
  const workerLabel =
    audioWorkerStatus === "used"
      ? "Acoustic worker ran and returned feature windows."
      : audioWorkerStatus === "failed"
        ? "Acoustic worker was configured but did not return usable features (often download or timeout); prediction used captions/title."
        : audioWorkerStatus === "skipped_unconfigured"
          ? "Acoustic worker URL is not configured; prediction used captions/title only."
          : predictedBuckets.length > 0
            ? "Acoustic worker status was not recorded for this run (older analysis)."
            : null;

  const heatmapUsesAudio =
    predictedBuckets.length > 0 && predictedBuckets.some((b) => b.source === "audio_features");

  const heatmapLabel = heatmapUsesAudio
    ? "AI heatmap peaks used acoustic features plus captions/context."
    : predictedBuckets.length > 0
      ? "AI heatmap peaks used captions and metadata (no acoustic feature windows in this run)."
      : "No AI heatmap peaks stored yet (analysis may still be running or returned no peaks).";

  return (
    <div className="mt-3 rounded border border-surface-border/60 bg-surface/30 px-3 py-2 space-y-1">
      {workerLabel && <p className="font-mono text-[10px] text-surface-muted leading-relaxed">{workerLabel}</p>}
      <p className="font-mono text-[10px] text-surface-muted leading-relaxed">{heatmapLabel}</p>
    </div>
  );
}

// =============================================================================
// ContentAnalysis
// =============================================================================

const NARRATIVE_SOURCE_LABELS: Record<string, string> = {
  transcript: "Synopsis grounded in captions/transcript text.",
  title_description_only: "Synopsis from title and description only (no usable transcript).",
};

function mergeUniqueStrings(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...a, ...b]) {
    const t = s.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function ContentAnalysis({ insights }: { insights: InsightsCacheRow | null }) {
  if (!insights || insights.status === "pending") {
    return <p className="font-mono text-xs text-surface-muted">Analysis queued…</p>;
  }

  if (insights.status === "generating") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 border border-tingle-aqua border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-xs text-tingle-aqua">Generating analysis…</p>
      </div>
    );
  }

  if (insights.status === "error") {
    return (
      <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
        {insights.error_message ?? "Analysis failed."}
      </p>
    );
  }

  if (!insights.report) {
    return <p className="font-mono text-xs text-surface-muted">No report available.</p>;
  }

  const { report } = insights;
  const profile = report.listener_profile;
  const triggers = report.top_triggers;

  const styleGenreFromTags = triggers
    .filter((t) => (t.display_group ?? "sensory") === "style_genre")
    .map((t) => t.label);
  const vocalFromTags = triggers
    .filter((t) => (t.display_group ?? "sensory") === "vocal_style")
    .map((t) => t.label);
  const musicFromTags = triggers.filter((t) => (t.display_group ?? "sensory") === "music");
  const ambienceFromTags = triggers.filter((t) => (t.display_group ?? "sensory") === "ambience");
  const sensoryTriggers = triggers.filter((t) => {
    const g = t.display_group ?? "sensory";
    return g === "sensory" || !["style_genre", "vocal_style", "music", "ambience"].includes(g);
  });

  const styleGenreChips = mergeUniqueStrings(profile?.style_genre ?? [], styleGenreFromTags);
  const vocalChips = mergeUniqueStrings(profile?.vocal_style ?? [], vocalFromTags);

  const musicLine =
    profile?.background_music === "detected"
      ? "Background music: detected in dialogue/metadata signals."
      : profile?.background_music === "none"
        ? "Background music: none detected."
        : profile?.background_music === "unclear"
          ? "Background music: n/a (unclear from available text)."
          : "Background music: n/a (run a fresh analysis for this field).";

  const narrativeSource = report.narrative_input_source ?? "transcript";

  return (
    <div className="space-y-6">
      {/* Synopsis */}
      {report.transcript_analysis ? (
        <div className="rounded border border-surface-border bg-surface/50 px-4 py-3">
          <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">Synopsis</p>
          <p className="text-sm text-white/85 leading-relaxed">{report.transcript_analysis}</p>
          <p className="mt-2 font-mono text-[10px] text-surface-muted">
            {NARRATIVE_SOURCE_LABELS[narrativeSource] ??
              NARRATIVE_SOURCE_LABELS.transcript}
          </p>
        </div>
      ) : (
        report.summary && <p className="text-sm text-white/80 leading-relaxed">{report.summary}</p>
      )}

      {/* Taxonomy: listener profile + tag groups */}
      <div className="space-y-5">
        <TaxonomyBlock title="Style / genre">
          {styleGenreChips.length > 0 ? (
            <ChipRow items={styleGenreChips} />
          ) : (
            <p className="text-xs text-surface-muted">—</p>
          )}
        </TaxonomyBlock>

        <TaxonomyBlock title="Vocal style">
          {vocalChips.length > 0 ? (
            <ChipRow items={vocalChips} />
          ) : (
            <p className="text-xs text-surface-muted">—</p>
          )}
        </TaxonomyBlock>

        <TaxonomyBlock title="Background music">
          <p className="text-xs text-white/80">{musicLine}</p>
        </TaxonomyBlock>

        {musicFromTags.length > 0 && (
          <TaxonomyBlock title="Music (taxonomy tags)">
            <TriggerConfidenceList triggers={musicFromTags} />
          </TaxonomyBlock>
        )}

        {ambienceFromTags.length > 0 && (
          <TaxonomyBlock title="Ambience">
            <TriggerConfidenceList triggers={ambienceFromTags} />
          </TaxonomyBlock>
        )}

        {profile?.notes && profile.notes.trim() && (
          <TaxonomyBlock title="Notes">
            <p className="text-xs text-white/75 leading-relaxed">{profile.notes}</p>
          </TaxonomyBlock>
        )}
      </div>

      {/* Sensory & other classified triggers */}
      {triggers.length === 0 && (
        <p className="rounded border border-surface-border bg-surface/40 px-3 py-2 text-xs text-surface-muted">
          No trigger tags were resolved for this video yet.
          {insights.error_message ? ` Diagnostic: ${insights.error_message}` : ""}
        </p>
      )}
      {sensoryTriggers.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-surface-muted mb-3">
            Sensory triggers
          </h3>
          <div className="space-y-4">
            {(["visual", "aural", "tactile_adjacent"] as const).map((cat) => {
              const inCat = sensoryTriggers.filter((t) => t.category === cat);
              if (inCat.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-[10px] uppercase tracking-wider text-surface-muted/80 mb-2">
                    {cat.replace("_", " ")}
                  </p>
                  <TriggerConfidenceList triggers={inCat} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap highlights — shown when available */}
      {report.heatmap_highlights.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Highlights</h3>
          <div className="space-y-2">
            {report.heatmap_highlights.map((h, i) => (
              <div key={i} className="rounded border border-surface-border p-3">
                <p className="text-xs text-tingle-aqua mb-1">
                  {formatMs(h.bucket_start_ms)} – {formatMs(h.bucket_end_ms)}
                </p>
                <p className="text-xs text-white/70">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-surface-muted">
        Generated {new Date(report.generated_at).toLocaleString()}
      </p>
    </div>
  );
}

function TaxonomyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-widest text-surface-muted mb-2">{title}</h3>
      {children}
    </div>
  );
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-surface-border bg-surface/60 px-2.5 py-1 text-xs text-white/90"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function TriggerConfidenceList({
  triggers,
}: {
  triggers: InsightReport["top_triggers"];
}) {
  return (
    <div className="space-y-3">
      {triggers.map((t) => (
        <div key={t.trigger_tag_id} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white flex-1">{t.label}</span>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
                CATEGORY_STYLES[t.category as keyof typeof CATEGORY_STYLES]
              )}
            >
              {t.category.replace("_", " ")}
            </span>
            <span className="text-xs text-surface-muted tabular-nums">
              {Math.round(t.confidence * 100)}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-surface-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-tingle-aqua/50"
              style={{ width: `${Math.round(t.confidence * 100)}%` }}
            />
          </div>
          {t.timestamp_examples_ms.length > 0 && (
            <p className="text-[10px] text-surface-muted">
              Examples:{" "}
              {t.timestamp_examples_ms
                .slice(0, 3)
                .map((ms) => formatMs(ms))
                .join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
