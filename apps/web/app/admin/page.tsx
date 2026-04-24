"use client";

// =============================================================================
// /admin — Read-only view of all creator analysis outputs
//
// Access requires user_profiles.is_admin = true.
// Shows creators → their content → LLM insight reports from insights_cache.
// No tingle event data or user personal data is exposed.
//
// To grant admin: UPDATE user_profiles SET is_admin = true WHERE user_id = '<uuid>';
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import type { InsightReport } from "@tingle/types";
import type { BatchLinkPreview, BatchRunResult } from "@/app/api/admin/batch-analysis/shared";

// ---- Local types ------------------------------------------------------------

interface AdminCreator {
  id: string;
  display_name: string;
  youtube_channel_id: string | null;
}

interface AdminContent {
  id: string;
  creator_id: string;
  title: string;
  youtube_video_id: string;
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
}

interface AdminInsight {
  content_id: string;
  status: "pending" | "generating" | "ready" | "error";
  report: InsightReport | null;
  error_message: string | null;
  generated_at: string | null;
}

interface BatchPreviewResponse {
  items: BatchLinkPreview[];
}

interface BatchRunResponse {
  results: BatchRunResult[];
  queued: number;
}

// ---- Style maps -------------------------------------------------------------

const CONTENT_STATUS_STYLES: Record<AdminContent["status"], string> = {
  pending: "border-surface-muted/40 bg-surface-muted/10 text-surface-muted",
  processing: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  ready: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
};

const INSIGHT_STATUS_STYLES: Record<AdminInsight["status"], string> = {
  pending: "border-surface-muted/40 bg-surface-muted/10 text-surface-muted",
  generating: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  ready: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
};

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

// ---- Main component ---------------------------------------------------------

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = not checked yet
  const [creators, setCreators] = useState<AdminCreator[]>([]);
  const [content, setContent] = useState<AdminContent[]>([]);
  const [insights, setInsights] = useState<Record<string, AdminInsight>>({}); // keyed by content_id
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track which insight panels are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [batchLinksText, setBatchLinksText] = useState("");
  const [latestVideoCount, setLatestVideoCount] = useState(20);
  const [batchPreview, setBatchPreview] = useState<BatchLinkPreview[]>([]);
  const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
  const [batchRunLoading, setBatchRunLoading] = useState(false);
  const [batchRunResult, setBatchRunResult] = useState<BatchRunResponse | null>(null);

  async function loadAdminData() {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    // First check admin flag
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminFlag = !!(profileData as any)?.is_admin;
    setIsAdmin(adminFlag);

    if (!adminFlag) {
      setLoadingData(false);
      return;
    }

    // Load all data in parallel
    const [creatorsRes, contentRes, insightsRes] = await Promise.all([
      supabase
        .from("creators")
        .select("id, display_name, youtube_channel_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("content")
        .select("id, creator_id, title, youtube_video_id, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("insights_cache")
        .select("content_id, status, report, error_message, generated_at"),
    ]);

    if (creatorsRes.error) { setError(creatorsRes.error.message); setLoadingData(false); return; }
    if (contentRes.error) { setError(contentRes.error.message); setLoadingData(false); return; }
    if (insightsRes.error) { setError(insightsRes.error.message); setLoadingData(false); return; }

    setCreators((creatorsRes.data ?? []) as AdminCreator[]);
    setContent((contentRes.data ?? []) as AdminContent[]);

    const insightMap: Record<string, AdminInsight> = {};
    for (const row of insightsRes.data ?? []) {
      if (row.content_id) {
        insightMap[row.content_id] = row as AdminInsight;
      }
    }
    setInsights(insightMap);
    setLoadingData(false);
  }

  useEffect(() => {
    if (authLoading || !user) return;

    loadAdminData().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoadingData(false);
    });
  }, [user, authLoading]);

  // ---- Loading ---------------------------------------------------------------

  if (authLoading || loadingData || isAdmin === null) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
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

  // ---- Not admin ------------------------------------------------------------

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-xs uppercase tracking-widest text-red-400">403 — Forbidden</p>
        <p className="text-sm text-surface-muted">You don&apos;t have admin access.</p>
        <Link
          href="/dashboard"
          className="text-xs text-tingle-aqua underline-offset-2 hover:underline"
        >
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  // ---- Error ----------------------------------------------------------------

  if (error) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
        </p>
      </main>
    );
  }

  // ---- Counts ---------------------------------------------------------------

  const insightList = Object.values(insights);
  const readyCount = insightList.filter((i) => i.status === "ready").length;
  const pendingCount = insightList.filter(
    (i) => i.status === "pending" || i.status === "generating",
  ).length;
  const errorCount = insightList.filter((i) => i.status === "error").length;
  const parsedLinks = batchLinksText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  async function loadBatchPreview() {
    if (parsedLinks.length === 0) {
      setBatchPreview([]);
      return;
    }
    setBatchPreviewLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token.");
      const res = await fetch("/api/admin/batch-analysis/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ links: parsedLinks, latestVideoCount }),
      });
      const json = (await res.json()) as BatchPreviewResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to preview links.");
      setBatchPreview(json.items);
      setBatchRunResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview links");
    } finally {
      setBatchPreviewLoading(false);
    }
  }

  async function runBatchAnalysis() {
    if (parsedLinks.length === 0) return;
    setBatchRunLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Missing access token.");
      const res = await fetch("/api/admin/batch-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ links: parsedLinks, latestVideoCount }),
      });
      const json = (await res.json()) as BatchRunResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to run batch analysis.");
      setBatchRunResult(json);
      await loadAdminData();
      setBatchLinksText("");
      setBatchPreview([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run batch analysis");
    } finally {
      setBatchRunLoading(false);
    }
  }

  // ---- Main view ------------------------------------------------------------

  return (
    <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-white">Admin</h1>
          <p className="text-xs uppercase tracking-widest text-surface-muted mt-1">
            Analysis Outputs
          </p>
        </div>
        <Link href="/dashboard" className="text-xs text-surface-muted hover:text-tingle-aqua">
          ← Dashboard
        </Link>
      </div>

      {/* Summary counts */}
      <div className="mb-6 flex gap-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <Stat label="Creators" value={creators.length} />
        <Stat label="Content" value={content.length} />
        <Stat label="Insights ready" value={readyCount} color="tingle-aqua" />
        <Stat label="Processing" value={pendingCount} color="tingle-gold" />
        <Stat label="Errors" value={errorCount} color="red" />
      </div>

      {/* Batch analysis tool */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Batch Analysis</h2>
        <p className="text-xs text-surface-muted mb-3">
          Paste one link per line (YouTube video or ASMR-only channel URLs). Channel links expand to latest N videos.
        </p>
        <textarea
          value={batchLinksText}
          onChange={(e) => setBatchLinksText(e.target.value)}
          placeholder={"https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/@asmrcreator"}
          className="w-full min-h-28 rounded border border-surface-border bg-surface px-3 py-2 text-xs text-white placeholder:text-surface-muted/60"
        />
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-surface-muted">
            Latest N videos:
            <input
              type="number"
              min={1}
              max={50}
              value={latestVideoCount}
              onChange={(e) => setLatestVideoCount(Number(e.target.value || 20))}
              className="ml-2 w-16 rounded border border-surface-border bg-surface px-2 py-1 text-xs text-white"
            />
          </label>
          <button
            onClick={loadBatchPreview}
            disabled={batchPreviewLoading || parsedLinks.length === 0}
            className="rounded border border-surface-border px-3 py-1.5 text-xs text-surface-muted hover:text-tingle-aqua disabled:opacity-40"
          >
            {batchPreviewLoading ? "Previewing..." : "Preview"}
          </button>
          <button
            onClick={runBatchAnalysis}
            disabled={batchRunLoading || parsedLinks.length === 0}
            className="rounded border border-tingle-aqua/40 bg-tingle-aqua/10 px-3 py-1.5 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 disabled:opacity-40"
          >
            {batchRunLoading ? "Running..." : "Run batch analysis"}
          </button>
        </div>

        {batchPreview.length > 0 && (
          <div className="mt-4 rounded border border-surface-border bg-surface p-3">
            <p className="text-[10px] uppercase tracking-wider text-surface-muted mb-2">Preview</p>
            <div className="space-y-1.5">
              {batchPreview.map((item) => (
                <div key={`${item.input_link}-${item.resolved_video_id ?? item.reason ?? "x"}`} className="text-xs text-surface-muted">
                  <span className="text-white">{item.input_link}</span>{" "}
                  <span>→ {item.status}</span>
                  {item.resolved_video_id && <span> ({item.resolved_video_id})</span>}
                  {item.reason && <span> — {item.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {batchRunResult && (
          <div className="mt-4 rounded border border-tingle-aqua/30 bg-tingle-aqua/5 p-3">
            <p className="text-xs text-tingle-aqua mb-2">
              Queued {batchRunResult.queued} item{batchRunResult.queued !== 1 ? "s" : ""}.
            </p>
            <div className="space-y-1">
              {batchRunResult.results.map((item) => (
                <div key={`${item.input_link}-${item.resolved_video_id ?? item.reason ?? "x"}`} className="text-xs text-surface-muted">
                  <span className="text-white">{item.input_link}</span>{" "}
                  <span>→ {item.status}</span>
                  {item.content_id && (
                    <Link
                      href={`/dashboard/content/${item.content_id}`}
                      className="ml-2 text-tingle-aqua hover:underline"
                    >
                      Open content
                    </Link>
                  )}
                  {item.reason && <span> — {item.reason}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Creator list */}
      {creators.length === 0 ? (
        <p className="text-xs text-surface-muted">No creators yet.</p>
      ) : (
        <div className="space-y-4">
          {creators.map((creator) => {
            const creatorContent = content.filter((c) => c.creator_id === creator.id);
            return (
              <section
                key={creator.id}
                className="rounded-lg border border-surface-border bg-surface-elevated overflow-hidden"
              >
                {/* Creator header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
                  <span className="text-sm font-semibold text-white">{creator.display_name}</span>
                  {creator.youtube_channel_id && (
                    <span className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua">
                      YT: {creator.youtube_channel_id}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-surface-muted">
                    {creatorContent.length} video{creatorContent.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Content rows */}
                {creatorContent.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-surface-muted">No content yet.</p>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {creatorContent.map((c) => {
                      const insight = insights[c.id];
                      const isExpanded = expanded.has(c.id);

                      return (
                        <div key={c.id}>
                          {/* Content row */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{c.title}</p>
                              <p className="text-[10px] text-surface-muted mt-0.5">
                                {new Date(c.created_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>

                            <span
                              className={cn(
                                "flex-shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
                                CONTENT_STATUS_STYLES[c.status],
                              )}
                            >
                              {c.status}
                            </span>

                            {insight && (
                              <span
                                className={cn(
                                  "flex-shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
                                  INSIGHT_STATUS_STYLES[insight.status],
                                )}
                              >
                                insight: {insight.status}
                              </span>
                            )}

                            {insight?.status === "ready" && (
                              <button
                                onClick={() =>
                                  setExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id);
                                    else next.add(c.id);
                                    return next;
                                  })
                                }
                                className="flex-shrink-0 text-xs text-surface-muted hover:text-tingle-aqua"
                              >
                                {isExpanded ? "▲ Hide" : "▼ Show"}
                              </button>
                            )}
                          </div>

                          {/* Insight panel */}
                          {isExpanded && insight?.report && (
                            <InsightPanel report={insight.report} />
                          )}

                          {insight?.status === "error" && (
                            <div className="px-4 pb-3">
                              <p className="text-xs text-red-400">
                                Error: {insight.error_message ?? "Unknown error"}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ---- Sub-components ---------------------------------------------------------

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "tingle-aqua" | "tingle-gold" | "red";
}) {
  const valueClass = {
    "tingle-aqua": "text-tingle-aqua",
    "tingle-gold": "text-tingle-gold",
    red: "text-red-400",
    undefined: "text-white",
  }[color ?? "undefined"];

  return (
    <div>
      <p className={cn("text-xl tabular-nums", valueClass)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-surface-muted">{label}</p>
    </div>
  );
}

function InsightPanel({ report }: { report: InsightReport }) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-surface-border bg-surface p-4 space-y-4">
      {/* Summary */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-surface-muted mb-1">Summary</p>
        <p className="text-xs text-white leading-relaxed">{report.summary}</p>
      </div>

      {/* Top triggers */}
      {report.top_triggers.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-surface-muted mb-2">
            Top Triggers
          </p>
          <div className="space-y-1.5">
            {report.top_triggers.map((t) => (
              <div key={t.trigger_tag_id} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-white">{t.label}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border",
                    CATEGORY_STYLES[t.category as keyof typeof CATEGORY_STYLES],
                  )}
                >
                  {t.category.replace("_", " ")}
                </span>
                <span className="text-xs text-tingle-aqua tabular-nums">
                  {Math.round(t.confidence * 100)}%
                </span>
                <span className="text-[10px] text-surface-muted">
                  {t.timestamp_examples_ms.length} timestamps
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap highlights */}
      {report.heatmap_highlights.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-surface-muted mb-2">
            Heatmap Highlights
          </p>
          <div className="space-y-1.5">
            {report.heatmap_highlights.map((h, i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-shrink-0 text-[10px] text-tingle-aqua tabular-nums">
                  {formatMs(h.bucket_start_ms)}–{formatMs(h.bucket_end_ms)}
                </span>
                <span className="text-xs text-surface-muted">{h.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
