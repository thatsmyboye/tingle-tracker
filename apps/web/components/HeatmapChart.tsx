"use client";

import { useState } from "react";
import { cn } from "@tingle/ui";
import type { ContentTingleHeatmapRow, PredictedHeatmapBucket } from "@tingle/types";

// tingle-aqua: #7FFFD4 = rgb(127, 255, 212)
const AQUA_RGB = "127, 255, 212";
// tingle-gold for predicted data: rgb(255, 215, 0)
const GOLD_RGB = "255, 215, 0";

/** Threshold below which predicted data is shown alongside real data */
const PREDICTED_HIDE_THRESHOLD = 10;

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface HeatmapChartProps {
  buckets: ContentTingleHeatmapRow[];
  durationSeconds?: number | null;
  /** Sparse predicted peaks from audio.analyze — only buckets with intensity >= 3 */
  predictedBuckets?: PredictedHeatmapBucket[];
  /** Total real tingle count across all buckets */
  realTingleTotal?: number;
}

export function HeatmapChart({
  buckets,
  durationSeconds,
  predictedBuckets = [],
  realTingleTotal = 0,
}: HeatmapChartProps) {
  // All hooks must be declared before any early return
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPredIndex, setHoveredPredIndex] = useState<number | null>(null);

  const showPredicted = realTingleTotal < PREDICTED_HIDE_THRESHOLD && predictedBuckets.length > 0;
  const hasRealData = buckets.length > 0;

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

  const maxRealCount = hasRealData
    ? Math.max(...buckets.map((b) => b.tingle_count), 1)
    : 1;
  const maxPredictedIntensity = showPredicted
    ? Math.max(...predictedBuckets.map((b) => b.predicted_intensity), 1)
    : 1;
  const totalDurationMs = durationSeconds ? durationSeconds * 1000 : null;
  const predictedByStart = new Map(predictedBuckets.map((b) => [b.bucket_start_ms, b]));

  function intensityOpacity(avgIntensity: number): number {
    return Math.max(0.2, Math.min(1.0, (avgIntensity - 1) / 4));
  }

  const minuteLabels =
    totalDurationMs != null && hasRealData
      ? buckets.filter((b) => b.bucket_start_ms % 60000 === 0)
      : [];

  const hoveredBucket = hoveredIndex != null ? buckets[hoveredIndex] ?? null : null;
  const hoveredPred = hoveredPredIndex != null ? predictedBuckets[hoveredPredIndex] ?? null : null;

  return (
    <div className="w-full select-none">
      {/* AI Prediction badge */}
      {showPredicted && (
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded border border-tingle-gold/40 bg-tingle-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-tingle-gold">
            AI Prediction
          </span>
          <span className="font-mono text-[10px] text-surface-muted">
            {hasRealData
              ? `${PREDICTED_HIDE_THRESHOLD - realTingleTotal} more listener logs until real data takes over`
              : "Updates as listeners log tingles"}
          </span>
        </div>
      )}

      {/* Bar area */}
      <div className="relative" style={{ height: "120px" }}>
        {/* Predicted background layer */}
        {showPredicted && (
          <div className="absolute inset-0 flex items-end gap-px">
            {predictedBuckets.map((bucket, i) => {
              const heightPct = (bucket.predicted_intensity / maxPredictedIntensity) * 100;
              const opacity = hasRealData ? 0.15 : bucket.confidence * 0.8;
              return (
                <div
                  key={`pred-${bucket.bucket_start_ms}`}
                  className="flex-1 min-w-[2px] cursor-default"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: `rgba(${GOLD_RGB}, ${opacity})`,
                  }}
                  onMouseEnter={() => !hasRealData && setHoveredPredIndex(i)}
                  onMouseLeave={() => !hasRealData && setHoveredPredIndex(null)}
                />
              );
            })}
          </div>
        )}

        {/* Real data foreground layer */}
        {hasRealData && (
          <div className="absolute inset-0 flex items-end gap-px">
            {buckets.map((bucket, i) => {
              const heightPct = (bucket.tingle_count / maxRealCount) * 100;
              const opacity = intensityOpacity(bucket.avg_intensity);
              const hasPredictedPeak = showPredicted && predictedByStart.has(bucket.bucket_start_ms);
              return (
                <div
                  key={bucket.bucket_start_ms}
                  className="relative flex-1 min-w-[1px] cursor-default transition-opacity duration-75"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: `rgba(${AQUA_RGB}, ${opacity})`,
                    opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 1,
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Predicted alignment dot when both layers are active */}
                  {hasPredictedPeak && (
                    <div
                      className="absolute top-0 left-1/2 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1"
                      style={{ backgroundColor: `rgba(${GOLD_RGB}, 0.6)` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip — real data */}
        {hoveredBucket != null && hoveredIndex != null && (
          <div
            className={cn(
              "absolute bottom-full mb-1 z-10 pointer-events-none",
              "border border-surface-border bg-surface-elevated rounded px-2 py-1",
              "whitespace-nowrap"
            )}
            style={{
              left: `${(hoveredIndex / Math.max(buckets.length - 1, 1)) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-mono text-xs text-tingle-aqua">{formatMs(hoveredBucket.bucket_start_ms)}</p>
            <p className="font-mono text-xs text-white">{hoveredBucket.tingle_count} tingles</p>
            <p className="font-mono text-xs text-surface-muted">avg {hoveredBucket.avg_intensity.toFixed(2)}</p>
          </div>
        )}

        {/* Tooltip — predicted only (when no real data) */}
        {!hasRealData && hoveredPred != null && hoveredPredIndex != null && (
          <div
            className={cn(
              "absolute bottom-full mb-1 z-10 pointer-events-none",
              "border border-tingle-gold/30 bg-surface-elevated rounded px-2 py-1",
              "whitespace-nowrap"
            )}
            style={{
              left: `${(hoveredPredIndex / Math.max(predictedBuckets.length - 1, 1)) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-mono text-xs text-tingle-gold">{formatMs(hoveredPred.bucket_start_ms)}</p>
            <p className="font-mono text-xs text-white">intensity {hoveredPred.predicted_intensity.toFixed(1)}</p>
            <p className="font-mono text-xs text-surface-muted">
              {hoveredPred.dominant_trigger_slugs.join(", ")}
            </p>
            <p className="font-mono text-[10px] text-surface-muted">
              {Math.round(hoveredPred.confidence * 100)}% confidence · predicted
            </p>
          </div>
        )}
      </div>

      {/* X-axis labels */}
      {minuteLabels.length > 0 && totalDurationMs != null ? (
        <div className="relative mt-1 h-4">
          {minuteLabels.map((b) => (
            <span
              key={b.bucket_start_ms}
              className="absolute font-mono text-[10px] text-surface-muted"
              style={{
                left: `${(b.bucket_start_ms / totalDurationMs) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              {formatMs(b.bucket_start_ms)}
            </span>
          ))}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
