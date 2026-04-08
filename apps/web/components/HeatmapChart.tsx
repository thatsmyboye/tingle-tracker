"use client";

import { useState } from "react";
import { cn } from "@tingle/ui";
import type { ContentTingleHeatmapRow } from "@tingle/types";

// tingle-aqua: #7FFFD4 = rgb(127, 255, 212)
const AQUA_RGB = "127, 255, 212";

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface HeatmapChartProps {
  buckets: ContentTingleHeatmapRow[];
  durationSeconds?: number | null;
}

export function HeatmapChart({ buckets, durationSeconds }: HeatmapChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-surface-border rounded"
        style={{ height: "120px" }}
      >
        <span className="font-mono text-xs text-surface-muted">No tingle data yet</span>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.tingle_count), 1);
  const totalDurationMs = durationSeconds ? durationSeconds * 1000 : null;

  // avg_intensity is on a 1–5 scale (tingle_intensity enum cast to int)
  // normalize to [0.2, 1.0] for opacity
  function intensityOpacity(avgIntensity: number): number {
    return Math.max(0.2, Math.min(1.0, (avgIntensity - 1) / 4));
  }

  const minuteLabels =
    totalDurationMs != null
      ? buckets.filter((b) => b.bucket_start_ms % 60000 === 0)
      : [];

  const hoveredBucket = hoveredIndex != null ? buckets[hoveredIndex] : null;

  return (
    <div className="w-full select-none">
      {/* Bar area */}
      <div className="relative" style={{ height: "120px" }}>
        <div className="flex items-end gap-px h-full">
          {buckets.map((bucket, i) => {
            const heightPct = (bucket.tingle_count / maxCount) * 100;
            const opacity = intensityOpacity(bucket.avg_intensity);
            return (
              <div
                key={bucket.bucket_start_ms}
                className="flex-1 min-w-[1px] cursor-default transition-opacity duration-75"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: `rgba(${AQUA_RGB}, ${opacity})`,
                  opacity: hoveredIndex !== null && hoveredIndex !== i ? 0.5 : 1,
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </div>

        {/* Tooltip */}
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
