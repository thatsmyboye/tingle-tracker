"use client";

import { useId, useState } from "react";
import { cn } from "@tingle/ui";
import type { ContentTingleHeatmapRow, PredictedHeatmapBucket } from "@tingle/types";

// tingle-aqua: #7FFFD4 = rgb(127, 255, 212)
const AQUA_RGB = "127, 255, 212";
// tingle-gold: #FFD580 = rgb(255, 213, 128)
const GOLD_RGB = "255, 213, 128";

/** Threshold below which predicted data is shown alongside real data */
const PREDICTED_HIDE_THRESHOLD = 10;
const BUCKET_MS = 30_000;
const VIEW_W = 1000;
const VIEW_H = 100;

// =============================================================================
// Helpers
// =============================================================================

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Cardinal spline → SVG cubic bezier filled area path. */
function smoothAreaPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const t = 0.3;
  let d = `M 0 ${VIEW_H} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = clamp(p1.y + (p2.y - p0.y) * t, 0, VIEW_H);
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = clamp(p2.y - (p3.y - p1.y) * t, 0, VIEW_H);
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  d += `L ${pts[pts.length - 1].x.toFixed(1)} ${VIEW_H} Z`;
  return d;
}

function realHeightsArray(buckets: ContentTingleHeatmapRow[], n: number): number[] {
  const arr = new Array<number>(n).fill(0);
  for (const b of buckets) {
    const i = Math.floor(b.bucket_start_ms / BUCKET_MS);
    if (i >= 0 && i < n) arr[i] = b.tingle_count;
  }
  return arr;
}

function predHeightsArray(buckets: PredictedHeatmapBucket[], n: number): number[] {
  const arr = new Array<number>(n).fill(0);
  for (const b of buckets) {
    const i = Math.floor(b.bucket_start_ms / BUCKET_MS);
    if (i >= 0 && i < n) arr[i] = b.predicted_intensity;
  }
  return arr;
}

/** Smooth pseudo-noise waveform for the locked section visual. */
function buildNoiseHeights(startBucket: number, count: number): number[] {
  return Array.from({ length: count }, (_, j) => {
    const f = startBucket + j;
    const v = (Math.sin(f * 1.31) * 0.5 + 0.5) * (Math.sin(f * 0.47 + 1.9) * 0.5 + 0.5);
    return 0.15 + v * 0.85;
  });
}

function heightsToPoints(
  heights: number[],
  maxVal: number,
  totalBuckets: number
): { x: number; y: number }[] {
  return heights.map((h, i) => ({
    x: ((i + 0.5) / totalBuckets) * VIEW_W,
    y: VIEW_H - clamp(h / maxVal, 0, 1) * VIEW_H * 0.88,
  }));
}

// =============================================================================
// Component
// =============================================================================

interface HeatmapChartProps {
  buckets: ContentTingleHeatmapRow[];
  durationSeconds?: number | null;
  /** Sparse predicted peaks from audio.analyze — only buckets with intensity >= 3 */
  predictedBuckets?: PredictedHeatmapBucket[];
  /** Total real tingle count across all buckets */
  realTingleTotal?: number;
  /** Buckets beyond the free-tier cutoff — rendered blurred to tease the upgrade */
  lockedPredictedBuckets?: PredictedHeatmapBucket[];
}

export function HeatmapChart({
  buckets,
  durationSeconds,
  predictedBuckets = [],
  realTingleTotal = 0,
  lockedPredictedBuckets = [],
}: HeatmapChartProps) {
  const uid = useId().replace(/:/g, "");
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const showPredicted = realTingleTotal < PREDICTED_HIDE_THRESHOLD && predictedBuckets.length > 0;
  const hasRealData = buckets.length > 0;
  const hasLockedSection = lockedPredictedBuckets.length > 0 && showPredicted;

  if (!hasRealData && !showPredicted) {
    return (
      <div
        className="flex items-center justify-center border border-surface-border rounded"
        style={{ height: "120px" }}
      >
        <span className="font-mono text-xs text-surface-muted">No tingle data yet</span>
      </div>
    );
  }

  // Compute effective total duration
  const totalDurationMs = durationSeconds ? durationSeconds * 1000 : null;
  const lastBucketEdgeMs = hasRealData
    ? Math.max(...buckets.map((b) => b.bucket_start_ms + BUCKET_MS))
    : predictedBuckets.length > 0
    ? Math.max(...[...predictedBuckets, ...lockedPredictedBuckets].map((b) => b.bucket_start_ms + BUCKET_MS))
    : 0;
  const effectiveDurationMs = totalDurationMs ?? lastBucketEdgeMs;
  if (effectiveDurationMs === 0) return null;

  const totalBuckets = Math.ceil(effectiveDurationMs / BUCKET_MS);

  // Locked section boundary (first locked bucket index)
  const lockedStartBucket = hasLockedSection
    ? Math.floor(Math.min(...lockedPredictedBuckets.map((b) => b.bucket_start_ms)) / BUCKET_MS)
    : totalBuckets;
  const lockedPct = (lockedStartBucket / totalBuckets) * 100;

  // Build SVG area path
  let areaPath = "";
  const fillColor = hasRealData ? AQUA_RGB : GOLD_RGB;
  const gradId = `hm-grad-${uid}`;

  if (hasRealData) {
    const heights = realHeightsArray(buckets, totalBuckets);
    const maxVal = Math.max(...heights, 1);
    areaPath = smoothAreaPath(heightsToPoints(heights, maxVal, totalBuckets));
  } else {
    // Predicted-only: visible portion + locked noise fill so the full timeline renders
    const visHeights = predHeightsArray(predictedBuckets, lockedStartBucket);
    const lockedCount = totalBuckets - lockedStartBucket;
    if (hasLockedSection && lockedCount > 0) {
      const lockedRealHeights = predHeightsArray(lockedPredictedBuckets, totalBuckets).slice(lockedStartBucket);
      const noise = buildNoiseHeights(lockedStartBucket, lockedCount);
      // Blend noise with real locked peaks so actual spikes punch through the noise
      const mergedLocked = noise.map((n, i) => Math.max(n, lockedRealHeights[i] ?? 0));
      const allHeights = [...visHeights, ...mergedLocked];
      const maxVal = Math.max(...allHeights, 1);
      areaPath = smoothAreaPath(heightsToPoints(allHeights, maxVal, totalBuckets));
    } else {
      const maxVal = Math.max(...visHeights, 1);
      areaPath = smoothAreaPath(heightsToPoints(visHeights, maxVal, totalBuckets));
    }
  }

  // Hover state — derive bucket from cursor position
  const hovBucketIdx = hoverPct !== null ? clamp(Math.floor((hoverPct / 100) * totalBuckets), 0, totalBuckets - 1) : null;
  const hovBucketMs = hovBucketIdx !== null ? hovBucketIdx * BUCKET_MS : null;
  const isHoverLocked = hovBucketIdx !== null && hovBucketIdx >= lockedStartBucket;
  const hovRealBucket =
    hasRealData && hovBucketIdx !== null
      ? (buckets.find((b) => Math.floor(b.bucket_start_ms / BUCKET_MS) === hovBucketIdx) ?? null)
      : null;
  const hovPredBucket =
    !hasRealData && showPredicted && hovBucketIdx !== null
      ? (predictedBuckets.find((b) => Math.floor(b.bucket_start_ms / BUCKET_MS) === hovBucketIdx) ?? null)
      : null;

  // X-axis minute labels
  const labelIntervalMs = effectiveDurationMs > 30 * 60_000 ? 10 * 60_000 : 5 * 60_000;
  const minuteLabels: number[] = [];
  for (let t = labelIntervalMs; t < effectiveDurationMs; t += labelIntervalMs) {
    minuteLabels.push(t);
  }

  return (
    <div className="w-full select-none">
      {/* Predicted badge */}
      {showPredicted && (
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded border border-tingle-gold/40 bg-tingle-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tingle-gold">
            Predicted
          </span>
          <span className="font-mono text-[10px] text-surface-muted">
            {hasRealData
              ? `${PREDICTED_HIDE_THRESHOLD - realTingleTotal} more listener logs until real data takes over`
              : "Updates as listeners log tingles"}
          </span>
        </div>
      )}

      {/* Chart area */}
      <div
        className="relative"
        style={{ height: "100px" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoverPct(((e.clientX - rect.left) / rect.width) * 100);
        }}
        onMouseLeave={() => setHoverPct(null)}
      >
        {/* SVG smooth area chart */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(${fillColor})`} stopOpacity="0.65" />
              <stop offset="100%" stopColor={`rgb(${fillColor})`} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
          {/* Hover crosshair */}
          {hoverPct !== null && !isHoverLocked && (
            <line
              x1={((hoverPct / 100) * VIEW_W).toFixed(1)}
              y1="0"
              x2={((hoverPct / 100) * VIEW_W).toFixed(1)}
              y2={VIEW_H}
              stroke={`rgba(${fillColor}, 0.35)`}
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Locked section — backdrop blur + gradient fade to obscure values */}
        {hasLockedSection && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none overflow-hidden"
            style={{ left: `${lockedPct}%`, right: 0 }}
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: "blur(7px)",
                WebkitBackdropFilter: "blur(7px)",
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(to right, transparent 0%, #0D0D18cc 50%)",
              }}
            />
          </div>
        )}

        {/* Hover tooltip */}
        {hoverPct !== null && hovBucketMs !== null && !isHoverLocked && (
          <div
            className={cn(
              "absolute bottom-full mb-1 z-10 pointer-events-none",
              "border bg-surface-elevated rounded px-2 py-1 whitespace-nowrap",
              hasRealData ? "border-surface-border" : "border-tingle-gold/30"
            )}
            style={{
              left: `${clamp(hoverPct, 5, 93)}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className={cn("font-mono text-xs", hasRealData ? "text-tingle-aqua" : "text-tingle-gold")}>
              {formatMs(hovBucketMs)}
            </p>
            {hovRealBucket ? (
              <>
                <p className="font-mono text-xs text-white">{hovRealBucket.tingle_count} tingles</p>
                <p className="font-mono text-xs text-surface-muted">
                  avg {hovRealBucket.avg_intensity.toFixed(2)}
                </p>
              </>
            ) : hovPredBucket ? (
              <>
                <p className="font-mono text-xs text-white">
                  intensity {hovPredBucket.predicted_intensity.toFixed(1)}
                </p>
                {hovPredBucket.dominant_trigger_slugs.length > 0 && (
                  <p className="font-mono text-xs text-surface-muted">
                    {hovPredBucket.dominant_trigger_slugs.join(", ")}
                  </p>
                )}
                <p className="font-mono text-[10px] text-surface-muted">
                  {Math.round(hovPredBucket.confidence * 100)}% confidence · predicted
                </p>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div className="relative mt-1 h-4">
        {minuteLabels.map((t) => (
          <span
            key={t}
            className="absolute font-mono text-[10px] text-surface-muted"
            style={{
              left: `${(t / effectiveDurationMs) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatMs(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
