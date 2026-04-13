"use client";

// =============================================================================
// /listen/[contentId] — Production tingle logger
//
// Embeds the YouTube video via YouTubePlayer and wires TingleLogger so every
// tap is persisted to tingle_events in Supabase. Displays a live heatmap that
// merges this session's taps with the user's historical taps on this video.
// Auth-guarded by middleware (/listen prefix).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { YouTubePlayer, type YouTubePlayerRef } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import { TingleLogger } from "@/components/TingleLogger";
import { HeatmapChart } from "@/components/HeatmapChart";
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
  creators: { display_name: string } | null;
}

interface SessionEvent {
  timestamp_ms: number;
  intensity: TingleIntensity;
}

// =============================================================================
// Helpers
// =============================================================================

const BUCKET_SIZE_MS = 30_000; // 30-second buckets

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
  const { user, isLoading: authLoading } = useAuth();

  const playerRef = useRef<YouTubePlayerRef | null>(null);

  const [content, setContent] = useState<ContentRow | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session events: taps logged during this page visit
  const [sessionEvents, setSessionEvents] = useState<SessionEvent[]>([]);

  // Historical buckets: aggregated from the user's prior tingle_events for this content
  const [historicalBuckets, setHistoricalBuckets] = useState<
    ContentTingleHeatmapRow[]
  >([]);

  // ---- Data load ------------------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    const fetchContent = supabase
      .from("content")
      .select(
        "id, youtube_video_id, title, description, duration_seconds, thumbnail_url, creators(display_name)"
      )
      .eq("id", contentId)
      .eq("status", "ready")
      .single();

    const fetchHistory =
      user && !authLoading
        ? supabase
            .from("tingle_events")
            .select("timestamp_ms, intensity")
            .eq("content_id", contentId)
            .eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null });

    Promise.all([fetchContent, fetchHistory]).then(
      ([contentRes, historyRes]) => {
        if (contentRes.error || !contentRes.data) {
          setError(
            contentRes.error?.message ??
              "Content not found or not yet available."
          );
          setLoadingData(false);
          return;
        }

        setContent(contentRes.data as ContentRow);

        if (!historyRes.error && historyRes.data && historyRes.data.length > 0) {
          const buckets = buildHeatmapBuckets(
            historyRes.data as Array<{
              timestamp_ms: number;
              intensity: TingleIntensity;
            }>,
            contentId
          );
          setHistoricalBuckets(buckets);
        }

        setLoadingData(false);
      }
    );
  }, [authLoading, user, contentId]);

  // ---- onLog callback -------------------------------------------------------

  const handleLog = useCallback(
    (timestampMs: number, intensity: TingleIntensity) => {
      setSessionEvents((prev) => [...prev, { timestamp_ms: timestampMs, intensity }]);
    },
    []
  );

  // ---- Heatmap computation --------------------------------------------------

  const sessionBuckets = useMemo(
    () => buildHeatmapBuckets(sessionEvents, contentId),
    [sessionEvents, contentId]
  );

  // Merge historical + session buckets; session taps update the existing buckets
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

  if (authLoading || loadingData) {
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
          ← Browse content
        </Link>
      </main>
    );
  }

  const creatorName = content.creators?.display_name ?? "Unknown creator";
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
          <Link href="/profile" className="hover:text-tingle-aqua transition-colors">
            Profile
          </Link>
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
          {/* Tingle Logger */}
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

          {/* Heatmap */}
          <section className="rounded-lg border border-surface-border bg-surface-elevated p-5">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">
              Your Tingle Heatmap
            </p>
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
          </section>
        </div>

        {/* Info footer */}
        <p className="text-[10px] text-surface-muted/50 text-center">
          Your taps are saved in real time and contribute to the creator&apos;s
          analytics dashboard.
        </p>
      </div>
    </main>
  );
}
