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
  youtube_channel_id: string | null;
  creators: { display_name: string } | null;
}

interface SessionEvent {
  timestamp_ms: number;
  intensity: TingleIntensity;
}

interface SleepPromptData {
  sessionId: string;
  contentTitle: string;
  creatorName: string;
}

interface UpNextItem {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  creator_display_name: string | null;
}

// =============================================================================
// Heatmap helpers
// =============================================================================

const BUCKET_SIZE_MS = 10_000; // 10-second buckets

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

  // Session-end prompt shown when the video finishes
  const [videoEnded, setVideoEnded] = useState(false);

  // Up-next recommendations shown in the session-end modal
  const [upNextItems, setUpNextItems] = useState<UpNextItem[]>([]);

  // Sleep mode
  const [sleepMode, setSleepMode] = useState(false);
  const [sleepSessionId, setSleepSessionId] = useState<string | null>(null);
  const [pendingSleepPrompt, setPendingSleepPrompt] = useState<SleepPromptData | null>(null);

  // ---- Load content (immediate, no auth dependency) -------------------------

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    supabase
      .from("content")
      .select(
        "id, youtube_video_id, title, description, duration_seconds, thumbnail_url, channel_title, youtube_channel_id, creators(display_name)"
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

  // ---- Fetch up-next when video ends ----------------------------------------

  useEffect(() => {
    if (!videoEnded) return;

    const supabase = getSupabaseBrowserClient();

    async function fetchUpNext() {
      if (isAuthenticated && user) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          try {
            const res = await fetch("/api/discovery/recommended?limit=6", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const json = (await res.json()) as {
                results?: Array<{
                  content_id: string;
                  youtube_video_id: string;
                  title: string;
                  thumbnail_url: string | null;
                  creator_display_name: string | null;
                }>;
              };
              const items = (json.results ?? [])
                .filter((r) => r.content_id !== contentId)
                .slice(0, 3)
                .map((r) => ({
                  id: r.content_id,
                  youtube_video_id: r.youtube_video_id,
                  title: r.title,
                  thumbnail_url: r.thumbnail_url,
                  creator_display_name: r.creator_display_name,
                }));
              if (items.length > 0) {
                setUpNextItems(items);
                return;
              }
            }
          } catch {
            // fall through to trending
          }
        }
      }

      // Fallback: trending content (works for unauthenticated users too)
      const { data } = await supabase.rpc("get_trending_content", { p_limit: 6 });
      if (data) {
        const items = (data as Array<{
          id: string;
          youtube_video_id: string;
          title: string;
          thumbnail_url: string | null;
          creator_display_name: string | null;
        }>)
          .filter((r) => r.id !== contentId)
          .slice(0, 3);
        setUpNextItems(items);
      }
    }

    fetchUpNext();
  }, [videoEnded, isAuthenticated, user, contentId]);

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

  // ---- Video end prompt -----------------------------------------------------

  const handlePlayerStateChange = useCallback((state: number) => {
    // YouTube PlayerState.ENDED = 0
    if (state === 0) {
      if (sleepMode) {
        // Video ended while sleep mode is on — let it end silently.
        // The pending prompt is already written to localStorage.
        return;
      }
      setVideoEnded(true);
    }
  }, [sleepMode]);

  const handleDismissEndModal = useCallback(() => {
    setVideoEnded(false);
  }, []);

  const handleEndModalSignUp = useCallback(() => {
    setVideoEnded(false);
    setHeatmapAuthOpen(true);
  }, []);

  // ---- Sleep mode -----------------------------------------------------------

  // On auth settle, surface any pending "did you fall asleep?" prompt
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    try {
      const raw = localStorage.getItem("tingle_sleep_pending");
      if (!raw) return;
      const data = JSON.parse(raw) as SleepPromptData;
      if (data?.sessionId) setPendingSleepPrompt(data);
    } catch {
      localStorage.removeItem("tingle_sleep_pending");
    }
  }, [authLoading, isAuthenticated]);

  const handleSleepModeToggle = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (sleepMode) {
      // Cancel: remove the uncommitted sleep record and clear pending prompt
      if (sleepSessionId) {
        await supabase.from("sleep_sessions").delete().eq("id", sleepSessionId);
        setSleepSessionId(null);
      }
      localStorage.removeItem("tingle_sleep_pending");
      setSleepMode(false);
    } else {
      // Activate: ensure a user session exists (anonymous is fine)
      let uid = user?.id;
      if (!uid) {
        const { data: anonData } = await supabase.auth.signInAnonymously();
        uid = anonData.user?.id ?? undefined;
      }
      if (uid && content) {
        const { data, error } = await supabase
          .from("sleep_sessions")
          .insert({ user_id: uid, content_id: contentId })
          .select("id")
          .single();
        if (data && !error) {
          setSleepSessionId(data.id);
          const info: SleepPromptData = {
            sessionId: data.id,
            contentTitle: content.title,
            creatorName:
              content.creators?.display_name ??
              content.channel_title ??
              "Unknown",
          };
          try {
            localStorage.setItem("tingle_sleep_pending", JSON.stringify(info));
          } catch {}
        }
      }
      setSleepMode(true);
    }
  }, [sleepMode, sleepSessionId, user, contentId, content]);

  const handleSleepAnswer = useCallback(
    async (fellAsleep: boolean) => {
      if (!pendingSleepPrompt) return;
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from("sleep_sessions")
        .update({ fell_asleep: fellAsleep, updated_at: new Date().toISOString() })
        .eq("id", pendingSleepPrompt.sessionId);
      setPendingSleepPrompt(null);
      localStorage.removeItem("tingle_sleep_pending");
    },
    [pendingSleepPrompt]
  );

  const handleDismissSleepPrompt = useCallback(() => {
    setPendingSleepPrompt(null);
    localStorage.removeItem("tingle_sleep_pending");
  }, []);

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
          onStateChange={handlePlayerStateChange}
          className="w-full"
        />

        {/* YouTube creator action bar — helps creators receive likes, subs, and comments */}
        <div className="flex items-center gap-4 text-[11px] text-surface-muted">
          <a
            href={`https://www.youtube.com/watch?v=${content.youtube_video_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-tingle-aqua transition-colors"
          >
            Watch on YouTube ↗
          </a>
          {content.youtube_channel_id && (
            <a
              href={`https://www.youtube.com/channel/${content.youtube_channel_id}?sub_confirmation=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-tingle-aqua transition-colors"
            >
              Subscribe to {creatorName} ↗
            </a>
          )}
        </div>

        {/* Logger + heatmap */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tingle Logger — available to everyone */}
          <section className="rounded-lg border border-surface-border bg-surface-elevated p-5">
            {/* Header row with sleep mode toggle */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs uppercase tracking-widest text-surface-muted">
                Log a Tingle
              </p>
              <button
                onClick={handleSleepModeToggle}
                className={[
                  "flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border transition-colors",
                  sleepMode
                    ? "border-tingle-purple/50 bg-tingle-purple/10 text-tingle-purple"
                    : "border-surface-border text-surface-muted hover:border-surface-muted/50 hover:text-white",
                ].join(" ")}
                title={sleepMode ? "Disable sleep mode" : "Enable sleep mode"}
              >
                {/* Moon icon */}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                {sleepMode ? "Sleep on" : "Sleep"}
              </button>
            </div>

            {sleepMode ? (
              /* Sleep mode active — hide logger, show friendly message */
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <svg
                  className="text-tingle-purple/60"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <p className="text-sm text-white">Sleep mode active</p>
                <p className="text-xs text-surface-muted leading-relaxed max-w-[180px]">
                  Have a restful sleep! Your session is being saved.
                </p>
              </div>
            ) : (
              <>
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
                    <ul className="space-y-1 max-h-36 overflow-y-auto scrollbar-dark">
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
              </>
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

      {/* Session-end prompt */}
      {videoEnded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleDismissEndModal}
        >
          <div
            className="relative w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={handleDismissEndModal}
              className="absolute top-4 right-4 text-surface-muted hover:text-white transition-colors text-xs leading-none"
              aria-label="Dismiss"
            >
              ✕
            </button>

            {/* Icon + title */}
            <div className="text-center space-y-2">
              <div className="text-tingle-aqua text-3xl leading-none">✦</div>
              <h2 className="font-serif text-lg text-white">Session complete</h2>
            </div>

            {/* Summary */}
            <div className="text-center space-y-2">
              <p className="text-sm text-white tabular-nums">
                {sessionEvents.length === 0
                  ? "No tingles logged this session"
                  : `${sessionEvents.length} tingle${sessionEvents.length !== 1 ? "s" : ""} logged`}
              </p>
              {isAuthenticated ? (
                <p className="text-xs text-surface-muted leading-relaxed">
                  Your data is saved to your profile and is contributing to{" "}
                  <span className="text-tingle-aqua">{creatorName}</span>
                  &apos;s analytics dashboard.
                </p>
              ) : (
                <p className="text-xs text-surface-muted leading-relaxed">
                  {sessionEvents.length > 0
                    ? "Your tingles are captured for this session. "
                    : ""}
                  Create a free account to save them permanently, unlock your
                  heatmap, and help{" "}
                  <span className="text-tingle-aqua">{creatorName}</span>{" "}
                  understand their audience.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/profile"
                  className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors text-center"
                  onClick={handleDismissEndModal}
                >
                  View profile →
                </Link>
              ) : (
                <button
                  onClick={handleEndModalSignUp}
                  className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
                >
                  Create free account →
                </button>
              )}
              <button
                onClick={handleDismissEndModal}
                className="rounded-lg border border-surface-border px-4 py-2 text-xs text-surface-muted hover:text-white hover:border-surface-muted/50 transition-colors"
              >
                Keep listening
              </button>
            </div>

            {/* Up next */}
            {upNextItems.length > 0 && (
              <div className="border-t border-surface-border pt-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-surface-muted">
                  Up next
                </p>
                {upNextItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/listen/${item.id}`}
                    onClick={handleDismissEndModal}
                    className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface px-3 py-2 hover:border-tingle-aqua/30 transition-colors group"
                  >
                    {item.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="w-14 h-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-9 rounded bg-surface-elevated shrink-0 flex items-center justify-center">
                        <span className="text-surface-muted/40 text-base">▶</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white line-clamp-1 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-surface-muted truncate">
                        {item.creator_display_name ?? "Unknown creator"}
                      </p>
                    </div>
                    <span className="text-[10px] text-tingle-aqua/70 group-hover:text-tingle-aqua transition-colors shrink-0">
                      →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Did you fall asleep?" prompt — shown on next authenticated visit */}
      {pendingSleepPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleDismissSleepPrompt}
        >
          <div
            className="relative w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleDismissSleepPrompt}
              className="absolute top-4 right-4 text-surface-muted hover:text-white transition-colors text-xs leading-none"
              aria-label="Skip"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <svg
                className="mx-auto text-tingle-purple/70"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <h2 className="font-serif text-lg text-white">How was your sleep?</h2>
            </div>

            <p className="text-xs text-surface-muted text-center leading-relaxed">
              Did you fall asleep during{" "}
              <span className="text-white">
                &ldquo;{pendingSleepPrompt.contentTitle}&rdquo;
              </span>{" "}
              by{" "}
              <span className="text-tingle-aqua">{pendingSleepPrompt.creatorName}</span>?
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSleepAnswer(true)}
                className="rounded-lg border border-tingle-purple/50 bg-tingle-purple/10 px-4 py-2 text-xs text-tingle-purple hover:bg-tingle-purple/20 transition-colors"
              >
                Yes, I fell asleep
              </button>
              <button
                onClick={() => handleSleepAnswer(false)}
                className="rounded-lg border border-surface-border px-4 py-2 text-xs text-surface-muted hover:text-white hover:border-surface-muted/50 transition-colors"
              >
                No, I stayed awake
              </button>
              <button
                onClick={handleDismissSleepPrompt}
                className="text-[10px] text-surface-muted/50 hover:text-surface-muted transition-colors py-1"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth modal — shared by nav sign-in, heatmap CTA, and session-end prompt */}
      <AuthModal
        open={heatmapAuthOpen}
        onClose={() => setHeatmapAuthOpen(false)}
        defaultTab="signup"
      />
    </main>
  );
}
