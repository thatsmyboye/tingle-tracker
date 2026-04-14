"use client";

// =============================================================================
// /listen/[contentId] — Tingle logger
//
// Public page — no auth required to watch or log tingles.
//
// Feature gating by auth state:
//   Unauthenticated / anonymous → tap ✦, see blurred heatmap teaser + sign-up CTA
//   Authenticated (non-anonymous) → tap ✦, see full personal heatmap
//
// Content loads immediately without waiting for auth resolution so there is no
// unnecessary delay for anonymous visitors. Historical tingle events are
// fetched only once the auth state settles to a real (non-anonymous) user.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { YouTubePlayer, type YouTubePlayerRef } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import { TingleLogger } from "@/components/TingleLogger";
import { HeatmapChart } from "@/components/HeatmapChart";
import { AuthModal } from "@/components/AuthModal";
import type { ContentTingleHeatmapRow, TingleIntensity } from "@tingle/types";

// =============================================================================
// Types
// =============================================================================

interface ContentRow {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  channel_title: string | null;
  creators: { display_name: string } | null;
}

interface SessionEvent {
  timestamp_ms: number;
  intensity: TingleIntensity;
}

// =============================================================================
// Heatmap helpers
// =============================================================================

const BUCKET_SIZE_MS = 30_000; // 30-second buckets

// Placeholder buckets shown blurred to unauthenticated users.
// Provides a sense of what the heatmap looks like before sign-up.
const HEATMAP_PLACEHOLDER: ContentTingleHeatmapRow[] = [
  { content_id: "", bucket_start_ms: 0,      tingle_count: 1, avg_intensity: 2 },
  { content_id: "", bucket_start_ms: 30000,  tingle_count: 4, avg_intensity: 3 },
  { content_id: "", bucket_start_ms: 60000,  tingle_count: 6, avg_intensity: 4 },
  { content_id: "", bucket_start_ms: 90000,  tingle_count: 2, avg_intensity: 3 },
  { content_id: "", bucket_start_ms: 120000, tingle_count: 8, avg_intensity: 5 },
  { content_id: "", bucket_start_ms: 150000, tingle_count: 3, avg_intensity: 3 },
  { content_id: "", bucket_start_ms: 180000, tingle_count: 5, avg_intensity: 4 },
  { content_id: "", bucket_start_ms: 210000, tingle_count: 2, avg_intensity: 2 },
];

function buildHeatmapBuckets(
  events: Array<{ timestamp_ms: number; intensity: TingleIntensity }>,
  contentId: string
): ContentTingleHeatmapRow[] {
  const bucketMap = new Map<number, { count: number; intensitySum: number }>();
  for (const ev of events) {
    const bucketStart =
      Math.floor(ev.timestamp_ms / BUCKET_SIZE_MS) * BUCKET_SIZE_MS;
    const existing = bucketMap.get(bucketStart) ?? {
      count: 0,
      intensitySum: 0,
    };
    bucketMap.set(bucketStart, {
      count: existing.count + 1,
      intensitySum: existing.intensitySum + parseInt(ev.intensity, 10),
    });
  }
  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucket_start_ms, { count, intensitySum }]) => ({
      content_id: contentId,
      bucket_start_ms,
      tingle_count: count,
      avg_intensity: intensitySum / count,
    }));
}

// =============================================================================
// Page
// =============================================================================

export default function ListenContentPage({
  params,
}: {
  params: { contentId: string };
}) {
  const { contentId } = params;
  const { user, isAnonymous, isLoading: authLoading } = useAuth();

  // Authenticated = has a real (non-anonymous) account
  const isAuthenticated = !!user && !isAnonymous;

  const playerRef = useRef<YouTubePlayerRef | null>(null);

  const [content, setContent] = useState<ContentRow | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);
  const [historicalBuckets, setHistoricalBuckets] = useState<
    ContentTingleHeatmapRow[]
  >([]);

  // Auth modal for the heatmap sign-up CTA
  const [heatmapAuthOpen, setHeatmapAuthOpen] = useState(false);

  // ---- Load content (immediate, no auth dependency) -------------------------

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    supabase
      .from("content")
      .select(
        "id, youtube_video_id, title, description, duration_seconds, thumbnail_url, channel_title, creators(display_name)"
      )
      .eq("id", contentId)
      .eq("status", "ready")
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError(err?.message ?? "Content not found or not yet available.");
        } else {
          setContent(data as ContentRow);
        }
        setLoadingData(false);
      });
  }, [contentId]);

  // ---- Load tingle history (only for authenticated users) -------------------

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;

    const supabase = getSupabaseBrowserClient();
    supabase
      .from("tingle_events")
      .select("timestamp_ms, intensity")
      .eq("content_id", contentId)
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const buckets = buildHeatmapBuckets(
            data as Array<{ timestamp_ms: number; intensity: TingleIntensity }>,
            contentId
          );
          setHistoricalBuckets(buckets);
        }
      });
  }, [authLoading, isAuthenticated, user, contentId]);

  // ---- onLog callback -------------------------------------------------------

  const handleLog = useCallback(
    (timestampMs: number, intensity: TingleIntensity) => {
      setSessionEvents((prev) => [
        ...prev,
        { timestamp_ms: timestampMs, intensity },
      ]);
    },
    []
  );

  // ---- Heatmap computation --------------------------------------------------

  const sessionBuckets = useMemo(
    () => buildHeatmapBuckets(sessionEvents, contentId),
    [sessionEvents, contentId]
  );

  // Merge historical (prior sessions) + current session buckets
  const mergedBuckets = useMemo((): ContentTingleHeatmapRow[] => {
    const bucketMap = new Map<
      number,
      { count: number; intensitySum: number }
    >();

    for (const b of historicalBuckets) {
      bucketMap.set(b.bucket_start_ms, {
        count: b.tingle_count,
        intensitySum: b.avg_intensity * b.tingle_count,
      });
    }

    for (const b of sessionBuckets) {
      const existing = bucketMap.get(b.bucket_start_ms);
      if (existing) {
        bucketMap.set(b.bucket_start_ms, {
          count: existing.count + b.tingle_count,
          intensitySum:
            existing.intensitySum + b.avg_intensity * b.tingle_count,
        });
      } else {
        bucketMap.set(b.bucket_start_ms, {
          count: b.tingle_count,
          intensitySum: b.avg_intensity * b.tingle_count,
        });
      }
    }

    return Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([bucket_start_ms, { count, intensitySum }]) => ({
        content_id: contentId,
        bucket_start_ms,
        tingle_count: count,
        avg_intensity: intensitySum / count,
      }));
  }, [historicalBuckets, sessionBuckets, contentId]);

  // ---- Loading / error states -----------------------------------------------

  if (loadingData) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-4xl mx-auto">
        <div className="space-y-3 mt-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-16 rounded border border-surface-border bg-surface-elevated animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  if (error || !content) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-4xl mx-auto">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 mb-4">
          {error ?? "Content not found."}
        </div>
        <Link
          href="/listen"
          className="text-xs text-tingle-aqua hover:underline underline-offset-2"
        >
          ← Back to listen
        </Link>
      </main>
    );
  }

  // Prefer claimed creator display name; fall back to raw channel title
  const creatorName =
    content.creators?.display_name ?? content.channel_title ?? "Unknown";

  const hasPriorHistory = historicalBuckets.length > 0;
  const priorTingleCount = historicalBuckets.reduce(
    (sum, b) => sum + b.tingle_count,
    0
  );

  // ---- Main render ----------------------------------------------------------

  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between border-b border-surface-border/50">
        <Link
          href="/listen"
          className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
        >
          ← Browse
        </Link>
        <div className="flex items-center gap-4 text-xs text-surface-muted">
          {isAuthenticated ? (
            <Link
              href="/profile"
              className="hover:text-tingle-aqua transition-colors"
            >
              Profile
            </Link>
          ) : (
            <button
              onClick={() => setHeatmapAuthOpen(true)}
              className="hover:text-tingle-aqua transition-colors"
            >
              Sign in
            </button>
          )}
          <Link href="/" className="hover:text-tingle-aqua transition-colors">
            Home
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-16 space-y-6">
        {/* Video info */}
        <div>
          <h1 className="font-serif text-2xl text-white leading-snug mb-1">
            {content.title}
          </h1>
          <p className="text-xs text-surface-muted">{creatorName}</p>
        </div>

        {/* YouTube player */}
        <YouTubePlayer
          ref={playerRef}
          videoId={content.youtube_video_id}
          className="w-full"
        />

        {/* Logger + heatmap */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tingle Logger — available to everyone */}
          <section className="rounded-lg border border-surface-border bg-surface-elevated p-5">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-5">
              Log a Tingle
            </p>
            <TingleLogger
              contentId={content.id}
              userId={user?.id ?? null}
              playerRef={playerRef}
              onLog={handleLog}
              className="w-full"
            />
            {sessionEvents.length > 0 && (
              <div className="mt-5 border-t border-surface-border pt-4">
                <p className="text-xs text-surface-muted mb-2">This session</p>
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {[...sessionEvents]
                    .reverse()
                    .slice(0, 10)
                    .map((ev, i) => {
                      const s = Math.floor(ev.timestamp_ms / 1000);
                      const mm = Math.floor(s / 60);
                      const ss = s % 60;
                      return (
                        <li
                          key={i}
                          className="flex items-center gap-3 text-xs font-mono"
                        >
                          <span className="text-tingle-aqua tabular-nums w-10">
                            {mm}:{String(ss).padStart(2, "0")}
                          </span>
                          <span className="text-surface-muted">
                            intensity {ev.intensity}
                          </span>
                        </li>
                      );
                    })}
                </ul>
                <p className="text-[10px] text-surface-muted/60 mt-2">
                  {sessionEvents.length} tingle
                  {sessionEvents.length !== 1 ? "s" : ""} this session
                </p>
              </div>
            )}
          </section>

          {/* Heatmap — gated to authenticated users */}
          <section className="rounded-lg border border-surface-border bg-surface-elevated p-5">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">
              Your Tingle Heatmap
            </p>

            {isAuthenticated ? (
              <>
                <HeatmapChart
                  buckets={mergedBuckets}
                  durationSeconds={content.duration_seconds}
                />
                {mergedBuckets.length === 0 && (
                  <p className="font-mono text-[10px] text-surface-muted/60 mt-2">
                    Play the video and tap ✦ to start building your heatmap.
                  </p>
                )}
                {hasPriorHistory && (
                  <p className="text-[10px] text-surface-muted/50 mt-3">
                    Includes {priorTingleCount} tingle
                    {priorTingleCount !== 1 ? "s" : ""} from previous sessions.
                  </p>
                )}
              </>
            ) : (
              // Blurred teaser for anonymous / unauthenticated visitors
              <div className="relative">
                <div
                  className="blur-sm pointer-events-none select-none"
                  aria-hidden="true"
                >
                  <HeatmapChart
                    buckets={
                      sessionBuckets.length > 0
                        ? sessionBuckets
                        : HEATMAP_PLACEHOLDER
                    }
                    durationSeconds={content.duration_seconds}
                  />
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded bg-surface/70">
                  <p className="text-sm text-white mb-1 text-center leading-snug px-4">
                    Sign in to see your heatmap
                  </p>
                  <p className="text-xs text-surface-muted mb-4 text-center px-4">
                    Your tingles are being saved.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHeatmapAuthOpen(true)}
                      className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
                    >
                      Create free account →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Info footer */}
        <p className="text-[10px] text-surface-muted/50 text-center">
          Your taps are saved in real time and contribute to the creator&apos;s
          analytics dashboard.
        </p>
      </div>

      {/* Auth modal — shared by nav sign-in and heatmap CTA */}
      <AuthModal
        open={heatmapAuthOpen}
        onClose={() => setHeatmapAuthOpen(false)}
        defaultTab="signup"
      />
    </main>
  );
}
