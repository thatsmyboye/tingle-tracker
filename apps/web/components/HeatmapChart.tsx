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
// Real heatmap view uses 10-second buckets; predicted uses 30-second buckets.
const REAL_BUCKET_MS = 10_000;
const PRED_BUCKET_MS = 30_000;
const VIEW_W = 1000;
const VIEW_H = 100;

// Spline tension — higher = gentler curves between control points
const SPLINE_T = 0.45;

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
  const t = SPLINE_T;
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

/**
 * Gaussian-weighted moving average to smooth a height array.
 * radius controls how many neighbours contribute; sigma controls the falloff.
 */
function gaussianSmooth(heights: number[], radius = 3, sigma = 1.6): number[] {
  const n = heights.length;
  if (n === 0) return heights;

  // Precompute kernel weights
  const kernel: number[] = [];
  let kernelSum = 0;
  for (let k = -radius; k <= radius; k++) {
    const w = Math.exp(-(k * k) / (2 * sigma * sigma));
    kernel.push(w);
    kernelSum += w;
  }
  const normKernel = kernel.map((w) => w / kernelSum);

  return heights.map((_, i) => {
    let val = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = clamp(i + k, 0, n - 1);
      val += heights[j] * normKernel[k + radius];
    }
    return val;
  });
}

/**
 * For sparse predicted buckets (only peaks ≥ 3 are stored), fill the gaps
 * between peaks with a linear blend from zero so the smoothing has something
 * to work with, rather than abrupt zero walls on either side of a peak.
 */
function fillPredictedGaps(heights: number[]): number[] {
  const filled = [...heights];
  const n = filled.length;

  // Find non-zero indices
  const peakIdxs: number[] = [];
  for (let i = 0; i < n; i++) {
    if (filled[i] > 0) peakIdxs.push(i);
  }
  if (peakIdxs.length === 0) return filled;

  // Between consecutive peaks, linearly interpolate a low baseline so the
  // drop between peaks stays smooth rather than zero-floored.
  for (let p = 0; p < peakIdxs.length - 1; p++) {
    const left = peakIdxs[p];
    const right = peakIdxs[p + 1];
    const gap = right - left;
    if (gap <= 1) continue;
    const leftVal = filled[left];
    const rightVal = filled[right];
    // Blend down to a minimum baseline of 10% of the weaker peak
    const baseline = Math.min(leftVal, rightVal) * 0.1;
    for (let i = left + 1; i < right; i++) {
      const frac = (i - left) / gap;
      // Cosine ease: starts and ends near the peaks, dips to baseline in the middle
      const cosWeight = (1 - Math.cos(Math.PI * frac)) / 2;
      const blended = leftVal * (1 - frac) * (1 - cosWeight) +
        rightVal * frac * cosWeight +
        baseline * cosWeight * (1 - cosWeight) * 4;
      filled[i] = Math.max(filled[i], blended);
    }
  }

  return filled;
}

function realHeightsArray(buckets: ContentTingleHeatmapRow[], n: number): number[] {
  const arr = new Array<number>(n).fill(0);
  for (const b of buckets) {
    const i = Math.floor(b.bucket_start_ms / REAL_BUCKET_MS);
    if (i >= 0 && i < n) arr[i] = b.tingle_count;
  }
  return arr;
}

function predHeightsArray(buckets: PredictedHeatmapBucket[], n: number): number[] {
  const arr = new Array<number>(n).fill(0);
  for (const b of buckets) {
    const i = Math.floor(b.bucket_start_ms / PRED_BUCKET_MS);
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

  // Compute effective total duration.
  // Real buckets are 10s; predicted buckets are 30s.
  const totalDurationMs = durationSeconds ? durationSeconds * 1000 : null;
  const lastRealEdgeMs = hasRealData
    ? Math.max(...buckets.map((b) => b.bucket_start_ms + REAL_BUCKET_MS))
    : 0;
  const lastPredEdgeMs = predictedBuckets.length > 0
    ? Math.max(...[...predictedBuckets, ...lockedPredictedBuckets].map((b) => b.bucket_start_ms + PRED_BUCKET_MS))
    : 0;
  const lastBucketEdgeMs = Math.max(lastRealEdgeMs, lastPredEdgeMs);
  const effectiveDurationMs = totalDurationMs ?? lastBucketEdgeMs;
  if (effectiveDurationMs === 0) return null;

  // Use a consistent bucket size for the chart grid.
  // When real data is present we use 10s buckets; for predicted-only we use 30s.
  const chartBucketMs = hasRealData ? REAL_BUCKET_MS : PRED_BUCKET_MS;
  const totalBuckets = Math.ceil(effectiveDurationMs / chartBucketMs);

  // Locked section boundary (first locked bucket index in chart grid units)
  const lockedStartBucket = hasLockedSection
    ? Math.floor(Math.min(...lockedPredictedBuckets.map((b) => b.bucket_start_ms)) / chartBucketMs)
    : totalBuckets;
  const lockedPct = (lockedStartBucket / totalBuckets) * 100;

  // Build SVG area path
  let areaPath = "";
  const fillColor = hasRealData ? AQUA_RGB : GOLD_RGB;
  const gradId = `hm-grad-${uid}`;

  if (hasRealData) {
    const rawHeights = realHeightsArray(buckets, totalBuckets);
    // Gaussian smoothing makes the real-event curve flow more naturally
    const heights = gaussianSmooth(rawHeights, 4, 2.0);
    const maxVal = Math.max(...heights, 1);
    areaPath = smoothAreaPath(heightsToPoints(heights, maxVal, totalBuckets));
  } else {
    // Predicted-only: sparse peaks → fill gaps → smooth
    const lockedCount = totalBuckets - lockedStartBucket;
    const rawVisHeights = predHeightsArray(predictedBuckets, lockedStartBucket);
    const visHeights = gaussianSmooth(fillPredictedGaps(rawVisHeights), 3, 1.8);

    if (hasLockedSection && lockedCount > 0) {
      const lockedRawHeights = predHeightsArray(lockedPredictedBuckets, totalBuckets).slice(lockedStartBucket);
      const noise = buildNoiseHeights(lockedStartBucket, lockedCount);
      const mergedLocked = noise.map((n, i) => Math.max(n, lockedRawHeights[i] ?? 0));
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
  const hovBucketMs = hovBucketIdx !== null ? hovBucketIdx * chartBucketMs : null;
  const isHoverLocked = hovBucketIdx !== null && hovBucketIdx >= lockedStartBucket;
  const hovRealBucket =
    hasRealData && hovBucketIdx !== null
      ? (buckets.find((b) => Math.floor(b.bucket_start_ms / REAL_BUCKET_MS) === hovBucketIdx) ?? null)
      : null;
  const hovPredBucket =
    !hasRealData && showPredicted && hovBucketMs !== null
      ? (predictedBuckets.find(
          (b) => hovBucketMs >= b.bucket_start_ms && hovBucketMs < b.bucket_end_ms
        ) ?? null)
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
