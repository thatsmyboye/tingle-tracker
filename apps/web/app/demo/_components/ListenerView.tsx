"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@tingle/ui";
import type { ContentTingleHeatmapRow, TingleIntensity } from "@tingle/types";
import { HeatmapChart } from "@/components/HeatmapChart";

// =============================================================================
// ListenerView — demo tingle logging with simulated playback
//
// Fully self-contained: no auth, no DB, no env vars required.
// Playback timer advances 250ms every 250ms (real-time).
// Taps are wall-clock debounced (500ms) and grouped into 30s heatmap buckets.
// =============================================================================

interface DemoTingleEvent {
  id: number;
  timestamp_ms: number;
  intensity: TingleIntensity;
}

const DEMO_CONTENT_ID = "demo-listener";
const DEMO_DURATION_SECONDS = 600; // 10-minute session
const BUCKET_SIZE_MS = 30_000;
const DEBOUNCE_MS = 500;
const INTENSITIES: TingleIntensity[] = ["1", "2", "3", "4", "5"];
const INTENSITY_LABELS: Record<TingleIntensity, string> = {
  "1": "Mild",
  "2": "Light",
  "3": "Medium",
  "4": "Strong",
  "5": "Intense",
};

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ListenerView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [intensity, setIntensity] = useState<TingleIntensity>("3");
  const [events, setEvents] = useState<DemoTingleEvent[]>([]);
  const [showPulse, setShowPulse] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const lastEventWallClockRef = useRef<number>(0);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);

  // Playback timer — advances real-time, avoids stale closure via callback form
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackMs((prev) => {
        const next = prev + 250;
        if (next >= DEMO_DURATION_SECONDS * 1000) {
          setIsPlaying(false);
          return DEMO_DURATION_SECONDS * 1000;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Heatmap buckets derived from events — recomputes only when events change
  const heatmapBuckets = useMemo((): ContentTingleHeatmapRow[] => {
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
        content_id: DEMO_CONTENT_ID,
        bucket_start_ms,
        tingle_count: count,
        avg_intensity: intensitySum / count,
      }));
  }, [events]);

  function handleTap() {
    const now = Date.now();
    if (now - lastEventWallClockRef.current < DEBOUNCE_MS) {
      setIsDebouncing(true);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(
        () => setIsDebouncing(false),
        DEBOUNCE_MS
      );
      return;
    }
    lastEventWallClockRef.current = now;

    setEvents((prev) => [
      ...prev,
      { id: nextIdRef.current++, timestamp_ms: playbackMs, intensity },
    ]);

    setShowPulse(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setShowPulse(false), 400);
  }

  function handleReset() {
    setIsPlaying(false);
    setPlaybackMs(0);
    setEvents([]);
    setIsDebouncing(false);
  }

  const progressPct = (playbackMs / (DEMO_DURATION_SECONDS * 1000)) * 100;

  return (
    <div className="space-y-6">
      {/* Now Playing */}
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
          Now Playing
        </p>
        <div className="flex gap-4 items-start">
          {/* Mock thumbnail */}
          <div className="w-32 h-20 rounded bg-surface-muted/20 border border-surface-border flex items-center justify-center flex-shrink-0">
            <span className="text-surface-muted text-2xl select-none">▶</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white leading-snug mb-0.5">
              Midnight ASMR — Soft Whispers &amp; Page Turning
            </p>
            <p className="font-mono text-xs text-surface-muted">
              Demo Channel · 10:00
            </p>
            {/* Progress bar */}
            <div className="mt-3 h-1 rounded-full bg-surface-muted/30 overflow-hidden">
              <div
                className="h-full bg-tingle-aqua/50 rounded-full transition-all duration-[250ms]"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[10px] text-surface-muted tabular-nums">
                {formatMs(playbackMs)}
              </span>
              <span className="font-mono text-[10px] text-surface-muted">
                10:00
              </span>
            </div>
          </div>
        </div>
        {/* Controls */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={handleReset}
            className="rounded border border-surface-border px-4 py-2 text-xs text-surface-muted hover:text-white hover:border-surface-muted/60 transition-colors"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Logger + Session Log */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Tingle Logger */}
        <section className="rounded-lg border border-surface-border bg-surface-elevated p-4 flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-widest text-surface-muted self-start">
            Log a Tingle
          </p>

          {/* ✦ tap button */}
          <button
            onClick={handleTap}
            disabled={isDebouncing}
            aria-label="Log tingle"
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-full",
              "border-2 border-tingle-aqua/40 bg-tingle-aqua/10",
              "font-mono text-3xl text-tingle-aqua transition-all duration-150",
              "hover:bg-tingle-aqua/20 focus:outline-none focus:ring-2 focus:ring-tingle-aqua focus:ring-offset-2 focus:ring-offset-surface",
              "active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
              showPulse && "scale-110 bg-tingle-aqua/30"
            )}
          >
            ✦
            {showPulse && (
              <span className="absolute inset-0 animate-ping rounded-full border border-tingle-aqua/40" />
            )}
          </button>

          {/* Intensity strip */}
          <div className="flex gap-1" role="radiogroup" aria-label="Intensity">
            {INTENSITIES.map((i) => (
              <button
                key={i}
                role="radio"
                aria-checked={intensity === i}
                aria-label={`Intensity ${INTENSITY_LABELS[i]}`}
                onClick={() => setIntensity(i)}
                className={cn(
                  "h-7 w-7 rounded-md border font-mono text-xs transition-all",
                  intensity === i
                    ? "border-tingle-aqua bg-tingle-aqua/20 text-tingle-aqua"
                    : "border-surface-border bg-surface-elevated text-surface-muted hover:border-tingle-aqua/40 hover:text-tingle-aqua/60"
                )}
              >
                {i}
              </button>
            ))}
          </div>

          <div className="font-mono text-xs text-surface-muted">
            {isDebouncing ? (
              <span className="text-tingle-gold/70">wait…</span>
            ) : (
              <span>tap to log · intensity {intensity}</span>
            )}
          </div>

          <p className="font-mono text-[10px] text-surface-muted/60 text-center leading-relaxed">
            Press Play above, then tap ✦ whenever you feel a tingle. Hold to
            note — intensity reflects how strong it felt.
          </p>
        </section>

        {/* Session Log */}
        <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
            Session Log
          </p>
          {events.length === 0 ? (
            <p className="font-mono text-xs text-surface-muted">
              No tingles logged yet. Press Play and tap ✦!
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-44 overflow-y-auto">
              {[...events]
                .reverse()
                .slice(0, 12)
                .map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-3 font-mono text-xs"
                  >
                    <span className="text-tingle-aqua tabular-nums w-10">
                      {formatMs(ev.timestamp_ms)}
                    </span>
                    <span className="text-surface-muted">
                      intensity {ev.intensity}
                    </span>
                    <span className="text-surface-muted/40 ml-auto">
                      {INTENSITY_LABELS[ev.intensity].toLowerCase()}
                    </span>
                  </li>
                ))}
            </ul>
          )}
          {events.length > 0 && (
            <p className="font-mono text-[10px] text-surface-muted mt-3 pt-2 border-t border-surface-border">
              {events.length} tingle{events.length !== 1 ? "s" : ""} logged
              this session
            </p>
          )}
        </section>
      </div>

      {/* Live Heatmap */}
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">
          Live Heatmap
        </p>
        <HeatmapChart
          buckets={heatmapBuckets}
          durationSeconds={DEMO_DURATION_SECONDS}
        />
        {heatmapBuckets.length === 0 && (
          <p className="font-mono text-[10px] text-surface-muted/60 mt-2">
            Heatmap builds as you log. Taller bars = more tingles in that
            window. Brighter = higher intensity.
          </p>
        )}
      </section>
    </div>
  );
}
