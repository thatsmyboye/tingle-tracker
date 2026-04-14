"use client";

import { useState } from "react";
import { cn } from "@tingle/ui";
import type { ContentTingleHeatmapRow } from "@tingle/types";
import { HeatmapChart } from "@/components/HeatmapChart";

// =============================================================================
// CreatorView — demo of the creator analytics pipeline
//
// Three phases: input → pipeline animation → results
// Fully self-contained: no auth, no DB, no env vars required.
// =============================================================================

type PipelineStepStatus = "idle" | "running" | "done";

interface PipelineStep {
  id: number;
  label: string;
  status: PipelineStepStatus;
}

type ViewPhase = "input" | "pipeline" | "results";

const MOCK_URL = "https://www.youtube.com/watch?v=example-asmr-video";

const PIPELINE_STEPS_INITIAL: PipelineStep[] = [
  { id: 0, label: "Fetching video metadata", status: "idle" },
  { id: 1, label: "Extracting transcript", status: "idle" },
  { id: 2, label: "Claude analyzing triggers", status: "idle" },
  { id: 3, label: "Building heatmap", status: "idle" },
];

const STEP_DELAYS_MS = [500, 500, 1500, 500];

// 21 buckets, 30s each, over a ~10:30 video. Peaks at 1:30, 4:00, 6:30, 8:30.
// avg_intensity is on the 1–5 scale (HeatmapChart uses (x-1)/4 for opacity).
const MOCK_BUCKETS: ContentTingleHeatmapRow[] = [
  { content_id: "demo", bucket_start_ms:      0, tingle_count:  1, avg_intensity: 2.0 },
  { content_id: "demo", bucket_start_ms:  30000, tingle_count:  2, avg_intensity: 2.5 },
  { content_id: "demo", bucket_start_ms:  60000, tingle_count:  3, avg_intensity: 3.0 },
  { content_id: "demo", bucket_start_ms:  90000, tingle_count: 12, avg_intensity: 4.2 }, // peak 1 — 1:30
  { content_id: "demo", bucket_start_ms: 120000, tingle_count:  7, avg_intensity: 3.8 },
  { content_id: "demo", bucket_start_ms: 150000, tingle_count:  4, avg_intensity: 3.2 },
  { content_id: "demo", bucket_start_ms: 180000, tingle_count:  2, avg_intensity: 2.5 },
  { content_id: "demo", bucket_start_ms: 210000, tingle_count:  3, avg_intensity: 3.0 },
  { content_id: "demo", bucket_start_ms: 240000, tingle_count: 14, avg_intensity: 4.5 }, // peak 2 — 4:00
  { content_id: "demo", bucket_start_ms: 270000, tingle_count:  9, avg_intensity: 4.0 },
  { content_id: "demo", bucket_start_ms: 300000, tingle_count:  5, avg_intensity: 3.5 },
  { content_id: "demo", bucket_start_ms: 330000, tingle_count:  3, avg_intensity: 3.0 },
  { content_id: "demo", bucket_start_ms: 360000, tingle_count:  2, avg_intensity: 2.5 },
  { content_id: "demo", bucket_start_ms: 390000, tingle_count: 11, avg_intensity: 4.3 }, // peak 3 — 6:30
  { content_id: "demo", bucket_start_ms: 420000, tingle_count:  8, avg_intensity: 4.0 },
  { content_id: "demo", bucket_start_ms: 450000, tingle_count:  4, avg_intensity: 3.2 },
  { content_id: "demo", bucket_start_ms: 480000, tingle_count:  2, avg_intensity: 2.8 },
  { content_id: "demo", bucket_start_ms: 510000, tingle_count: 13, avg_intensity: 4.6 }, // peak 4 — 8:30
  { content_id: "demo", bucket_start_ms: 540000, tingle_count:  8, avg_intensity: 4.1 },
  { content_id: "demo", bucket_start_ms: 570000, tingle_count:  3, avg_intensity: 3.0 },
  { content_id: "demo", bucket_start_ms: 600000, tingle_count:  1, avg_intensity: 2.0 },
];

const MOCK_DURATION_SECONDS = 630; // 10:30

const MOCK_TOTAL_TINGLES = MOCK_BUCKETS.reduce((s, b) => s + b.tingle_count, 0);
const MOCK_AVG_INTENSITY = (
  MOCK_BUCKETS.reduce((s, b) => s + b.avg_intensity, 0) / MOCK_BUCKETS.length
).toFixed(2);

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

type TriggerCategory = keyof typeof CATEGORY_STYLES;

const MOCK_TRIGGERS = [
  {
    id: "demo-1",
    label: "Whisper tapping",
    category: "aural" as TriggerCategory,
    confidence: 0.95,
    reasoning:
      "Detected at high density in the 1:30–2:00 and 4:00–4:30 windows. Consistent finger-on-surface sounds with soft vocal overlay drove the strongest tingle spikes.",
    timestamp_examples_ms: [90000, 240000, 390000] as readonly number[],
  },
  {
    id: "demo-2",
    label: "Page / paper turning",
    category: "tactile_adjacent" as TriggerCategory,
    confidence: 0.88,
    reasoning:
      "Crisp paper shuffle sounds occur at regular intervals throughout, correlating with tingle spikes across multiple listener sessions.",
    timestamp_examples_ms: [30000, 150000, 480000] as readonly number[],
  },
  {
    id: "demo-3",
    label: "Soft-spoken words",
    category: "aural" as TriggerCategory,
    confidence: 0.79,
    reasoning:
      "Close-mic breathy speech at low volume throughout; strongest in the opening minute and the 6:30 segment.",
    timestamp_examples_ms: [10000, 390000] as readonly number[],
  },
  {
    id: "demo-4",
    label: "Slow hand movements",
    category: "visual" as TriggerCategory,
    confidence: 0.65,
    reasoning:
      "Deliberate, slow panning hand gestures accompany the tapping sequences, contributing to the visual-tactile overlap response.",
    timestamp_examples_ms: [90000, 510000] as readonly number[],
  },
];

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CreatorView() {
  const [phase, setPhase] = useState<ViewPhase>("input");
  const [url, setUrl] = useState(MOCK_URL);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS_INITIAL);

  async function handleAnalyze() {
    setPhase("pipeline");
    setSteps(PIPELINE_STEPS_INITIAL);

    for (let i = 0; i < PIPELINE_STEPS_INITIAL.length; i++) {
      setSteps((prev) =>
        prev.map((s) => (s.id === i ? { ...s, status: "running" } : s))
      );
      await new Promise<void>((resolve) =>
        setTimeout(resolve, STEP_DELAYS_MS[i])
      );
      setSteps((prev) =>
        prev.map((s) => (s.id === i ? { ...s, status: "done" } : s))
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    setPhase("results");
  }

  function handleReset() {
    setPhase("input");
    setUrl(MOCK_URL);
    setSteps(PIPELINE_STEPS_INITIAL);
  }

  if (phase === "input") {
    return (
      <div className="space-y-6">
        <section className="rounded-lg border border-surface-border bg-surface-elevated p-6 space-y-4">
          <p className="text-xs uppercase tracking-widest text-surface-muted">
            Step 1 — Add a YouTube Video
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 rounded-lg border border-surface-border bg-surface px-4 py-3 font-mono text-sm text-white placeholder:text-surface-muted focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
            />
            <button
              onClick={handleAnalyze}
              className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-5 py-3 font-mono text-sm text-tingle-aqua hover:bg-tingle-aqua/20 focus:outline-none focus:ring-1 focus:ring-tingle-aqua transition-colors whitespace-nowrap"
            >
              Analyze Video
            </button>
          </div>
          <p className="font-mono text-[10px] text-surface-muted">
            ✦ Demo mode — no auth required. The URL is not fetched; a
            pre-built result will be shown.
          </p>
          <p className="font-mono text-[10px] text-surface-muted">
            ✦ Listener plays use a standard YouTube embed — views, watch time,
            and ad revenue count on your channel exactly as they would on
            YouTube.com.
          </p>
        </section>

        {/* What happens next */}
        <section className="rounded-lg border border-surface-border bg-surface-elevated p-6">
          <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">
            What happens next
          </p>
          <ol className="space-y-3">
            {PIPELINE_STEPS_INITIAL.map((step, i) => (
              <li key={step.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full border border-surface-muted/40 flex items-center justify-center font-mono text-[10px] text-surface-muted flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-surface-muted">{step.label}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  if (phase === "pipeline") {
    return (
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-6">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-6">
          Step 2 — Analyzing…
        </p>
        <div className="space-y-5">
          {steps.map((step) => (
            <PipelineStepRow key={step.id} step={step} />
          ))}
        </div>
      </section>
    );
  }

  // phase === "results"
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="text-xs uppercase tracking-widest text-surface-muted">
          Step 3 — Results
        </p>
        <button
          onClick={handleReset}
          className="text-xs text-tingle-aqua/60 hover:text-tingle-aqua transition-colors"
        >
          ← Reset demo
        </button>
      </div>

      {/* Summary insight */}
      <p className="font-mono text-sm text-surface-muted leading-relaxed border-l-2 border-tingle-aqua/30 pl-4">
        Listeners are clearly responding to the whisper + tapping sequences —
        the strongest spikes cluster at 1:30, 4:00, 6:30, and 8:30.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Tingles" value={String(MOCK_TOTAL_TINGLES)} />
        <StatCard label="Avg Intensity" value={MOCK_AVG_INTENSITY} />
        <StatCard label="Duration" value="10:30" />
      </div>

      {/* Heatmap */}
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">
          Tingle Heatmap
        </p>
        <HeatmapChart
          buckets={MOCK_BUCKETS}
          durationSeconds={MOCK_DURATION_SECONDS}
        />
        <p className="font-mono text-[10px] text-surface-muted mt-2">
          Crowd-sourced from all listeners. Brighter bars = higher avg
          intensity.
        </p>
      </section>

      {/* Trigger analysis */}
      <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-1">
          Trigger Analysis
        </p>
        <p className="font-mono text-xs text-surface-muted mb-5">
          Identified {MOCK_TRIGGERS.length} ASMR triggers via Claude
          classification.
        </p>
        <div className="space-y-5">
          {MOCK_TRIGGERS.map((t) => (
            <TriggerCard key={t.id} trigger={t} />
          ))}
        </div>
        <p className="font-mono text-[10px] text-surface-muted mt-5 pt-3 border-t border-surface-border">
          Generated by claude-sonnet-4-20250514 · confidence scores reflect
          transcript + metadata analysis
        </p>
        <p className="font-mono text-[10px] text-surface-muted mt-2">
          ✦ Listener plays are standard YouTube embeds — views, watch time, and
          ad revenue count on your channel normally. A &quot;Watch on YouTube&quot; link
          below the player also drives likes, comments, and subscriptions.
        </p>
      </section>
    </div>
  );
}

// =============================================================================
// Local helpers
// =============================================================================

function PipelineStepRow({ step }: { step: PipelineStep }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {step.status === "done" && (
          <span className="text-tingle-aqua text-sm">✓</span>
        )}
        {step.status === "running" && (
          <span className="w-3.5 h-3.5 border border-tingle-gold border-t-transparent rounded-full animate-spin block" />
        )}
        {step.status === "idle" && (
          <span className="w-3 h-3 rounded-full border border-surface-muted block" />
        )}
      </span>
      <span
        className={cn(
          "font-mono text-sm transition-colors",
          step.status === "done" && "text-white",
          step.status === "running" && "text-tingle-gold",
          step.status === "idle" && "text-surface-muted"
        )}
      >
        {step.label}
        {step.status === "running" && "…"}
        {step.status === "done" && " — done"}
      </span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-4">
      <p className="text-xs uppercase tracking-widest text-surface-muted mb-1">
        {label}
      </p>
      <p className="text-2xl text-tingle-aqua tabular-nums">{value}</p>
    </div>
  );
}

function TriggerCard({
  trigger,
}: {
  trigger: {
    id: string;
    label: string;
    category: TriggerCategory;
    confidence: number;
    reasoning: string;
    timestamp_examples_ms: readonly number[];
  };
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-white flex-1">{trigger.label}</span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
            CATEGORY_STYLES[trigger.category]
          )}
        >
          {trigger.category.replace("_", " ")}
        </span>
        <span className="text-xs text-surface-muted tabular-nums">
          {Math.round(trigger.confidence * 100)}%
        </span>
      </div>
      {/* Confidence bar */}
      <div className="h-1 rounded-full bg-surface-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-tingle-aqua/50"
          style={{ width: `${Math.round(trigger.confidence * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-surface-muted leading-relaxed pt-0.5">
        {trigger.reasoning}
      </p>
      <p className="text-[10px] text-surface-muted">
        Examples:{" "}
        {trigger.timestamp_examples_ms.map((ms) => formatMs(ms)).join(", ")}
      </p>
    </div>
  );
}
