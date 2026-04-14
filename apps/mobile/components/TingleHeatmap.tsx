import { useEffect, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";

// =============================================================================
// TingleHeatmap — renders the current user's tingle activity for one video
// as a horizontally-scrollable bar chart bucketed by time.
//
// Queries tingle_events directly (user-scoped via RLS) so no view dependency.
// Bar opacity encodes average intensity (1–5); height encodes event count.
// =============================================================================

const BAR_WIDTH = 6;
const BAR_GAP = 1;
const BAR_MAX_HEIGHT = 40;

/** Choose bucket size so we never produce more than ~180 bars. */
function getBucketSizeMs(durationMs: number): number {
  if (durationMs <= 30 * 60 * 1000) return 10_000; // 10s — up to 30 min
  if (durationMs <= 2 * 60 * 60 * 1000) return 30_000; // 30s — up to 2 hr
  return 60_000; // 60s — longer
}

interface Bucket {
  startMs: number;
  count: number;
  avgIntensity: number;
}

function computeBuckets(
  events: { timestamp_ms: number; intensity: string }[],
  durationMs: number
): Bucket[] {
  const bucketSizeMs = getBucketSizeMs(durationMs);
  const bucketCount = Math.max(1, Math.ceil(durationMs / bucketSizeMs));

  const counts = new Array<number>(bucketCount).fill(0);
  const intensityTotals = new Array<number>(bucketCount).fill(0);

  for (const ev of events) {
    const idx = Math.min(
      Math.floor(ev.timestamp_ms / bucketSizeMs),
      bucketCount - 1
    );
    counts[idx] += 1;
    intensityTotals[idx] += parseInt(ev.intensity, 10);
  }

  return Array.from({ length: bucketCount }, (_, i) => ({
    startMs: i * bucketSizeMs,
    count: counts[i],
    avgIntensity: counts[i] > 0 ? intensityTotals[i] / counts[i] : 0,
  }));
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface TingleHeatmapProps {
  contentId: string;
  userId: string;
  durationSeconds: number | null;
}

export function TingleHeatmap({
  contentId,
  userId,
  durationSeconds,
}: TingleHeatmapProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data } = await supabase
        .from("tingle_events")
        .select("timestamp_ms, intensity")
        .eq("content_id", contentId)
        .eq("user_id", userId)
        .order("timestamp_ms", { ascending: true });

      if (cancelled) return;

      const events = (data ?? []) as {
        timestamp_ms: number;
        intensity: string;
      }[];
      setTotalCount(events.length);

      if (events.length === 0) {
        setBuckets([]);
        setLoading(false);
        return;
      }

      // Use provided duration, or fall back to last event timestamp + one bucket
      const lastEventMs = events[events.length - 1].timestamp_ms;
      const effectiveDurationMs =
        durationSeconds != null && durationSeconds > 0
          ? durationSeconds * 1000
          : lastEventMs + getBucketSizeMs(lastEventMs);

      setBuckets(computeBuckets(events, effectiveDurationMs));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [contentId, userId, durationSeconds]);

  if (loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  if (totalCount === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No tingles logged yet.{"\n"}Tap the button above to start.
        </Text>
      </View>
    );
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const chartWidth = buckets.length * (BAR_WIDTH + BAR_GAP);
  const screenWidth = Dimensions.get("window").width - 40; // subtract horizontal padding

  return (
    <View style={styles.wrapper}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statValue}>
          {totalCount} {totalCount === 1 ? "tingle" : "tingles"}
        </Text>
        <Text style={styles.statLabel}>
          {getBucketSizeMs((durationSeconds ?? 0) * 1000) / 1000}s buckets
        </Text>
      </View>

      {/* Bar chart */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ width: Math.min(chartWidth, screenWidth) }}
      >
        <View style={styles.chart}>
          {buckets.map((bucket, i) => {
            const heightRatio = bucket.count / maxCount;
            const barH = Math.max(
              bucket.count > 0 ? 3 : 0,
              Math.round(heightRatio * BAR_MAX_HEIGHT)
            );
            // Opacity: 0.25 at intensity 1, 1.0 at intensity 5
            const opacity =
              bucket.count > 0
                ? 0.25 + 0.75 * ((bucket.avgIntensity - 1) / 4)
                : 0;
            return (
              <View
                key={i}
                style={[styles.barWrapper, { width: BAR_WIDTH }]}
              >
                <View
                  style={[
                    styles.bar,
                    {
                      height: barH,
                      opacity: bucket.count > 0 ? opacity : 1,
                      backgroundColor:
                        bucket.count > 0 ? "#7FFFD4" : "#1A1A2E",
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Time labels */}
      <View
        style={[
          styles.timeRow,
          { width: Math.min(chartWidth, screenWidth) },
        ]}
      >
        <Text style={styles.timeLabel}>0:00</Text>
        {durationSeconds != null && durationSeconds > 0 && (
          <Text style={styles.timeLabel}>
            {formatMs(durationSeconds * 1000)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  empty: {
    paddingVertical: 8,
  },
  emptyText: {
    color: "#3A3A56",
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  statValue: {
    color: "#7FFFD4",
    fontSize: 13,
    fontFamily: "monospace",
  },
  statLabel: {
    color: "#3A3A56",
    fontSize: 10,
    fontFamily: "monospace",
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: BAR_MAX_HEIGHT,
    gap: BAR_GAP,
  },
  barWrapper: {
    justifyContent: "flex-end",
    height: BAR_MAX_HEIGHT,
  },
  bar: {
    borderRadius: 1,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeLabel: {
    color: "#3A3A56",
    fontSize: 9,
    fontFamily: "monospace",
  },
});
