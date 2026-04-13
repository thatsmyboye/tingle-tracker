"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import { ContentIngestForm } from "@/components/ContentIngestForm";
import type { CreatorTopTriggerRow } from "@tingle/types";

// =============================================================================
// /dashboard — Creator overview: content list + top triggers
// =============================================================================

interface Creator {
  id: string;
  display_name: string;
  youtube_channel_id: string | null;
}

interface ContentRow {
  id: string;
  creator_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
}

const STATUS_STYLES: Record<ContentRow["status"], string> = {
  pending: "border-surface-muted/40 bg-surface-muted/10 text-surface-muted",
  processing: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
  ready: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
};

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

export default function DashboardPage() {
  const { user, isAnonymous, isLoading: authLoading } = useAuth();

  const [creator, setCreator] = useState<Creator | null | undefined>(undefined); // undefined = not fetched
  const [content, setContent] = useState<ContentRow[]>([]);
  const [topTriggers, setTopTriggers] = useState<CreatorTopTriggerRow[]>([]);
  const [heatmapTotals, setHeatmapTotals] = useState<Record<string, number>>({});
  const [accessToken, setAccessToken] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddVideo, setShowAddVideo] = useState(false);

  async function loadData() {
    if (!user) return;
    setLoadingData(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();

    // Get session for access token (needed by ContentIngestForm)
    const { data: { session } } = await supabase.auth.getSession();
    setAccessToken(session?.access_token ?? "");

    // Fetch creator profile and admin flag in parallel
    const [{ data: creatorData, error: creatorErr }, { data: profileData }] = await Promise.all([
      supabase
        .from("creators")
        .select("id, display_name, youtube_channel_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // profileData typed as any because is_admin is added via migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setIsAdmin(!!(profileData as any)?.is_admin);

    if (creatorErr) {
      setError(creatorErr.message);
      setLoadingData(false);
      return;
    }

    setCreator(creatorData ?? null);


    if (!creatorData) {
      setLoadingData(false);
      return;
    }

    // Fetch content + top triggers in parallel
    const [contentRes, triggersRes] = await Promise.all([
      supabase
        .from("content")
        .select("id, creator_id, youtube_video_id, title, thumbnail_url, status, created_at")
        .eq("creator_id", creatorData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("creator_top_triggers")
        .select("*")
        .eq("creator_id", creatorData.id)
        .order("total_tingles", { ascending: false })
        .limit(5),
    ]);

    if (contentRes.error) { setError(contentRes.error.message); setLoadingData(false); return; }
    if (triggersRes.error) { setError(triggersRes.error.message); setLoadingData(false); return; }

    const contentList = (contentRes.data ?? []) as ContentRow[];
    setContent(contentList);
    setTopTriggers((triggersRes.data ?? []) as CreatorTopTriggerRow[]);

    // Aggregate heatmap tingle totals per content item
    if (contentList.length > 0) {
      const ids = contentList.map((c) => c.id);
      const { data: heatmapData } = await supabase
        .from("content_tingle_heatmap")
        .select("content_id, tingle_count")
        .in("content_id", ids);

      const totals: Record<string, number> = {};
      for (const row of heatmapData ?? []) {
        if (row.content_id && row.tingle_count != null) {
          totals[row.content_id] = (totals[row.content_id] ?? 0) + row.tingle_count;
        }
      }
      setHeatmapTotals(totals);
    }

    setLoadingData(false);
  }

  useEffect(() => {
    if (!authLoading && user && !isAnonymous) {
      loadData();
    } else if (!authLoading) {
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAnonymous, authLoading]);

  // ---- Auth guard -----------------------------------------------------------

  if (authLoading || loadingData) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
        <div className="space-y-3 mt-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded border border-surface-border bg-surface-elevated animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  if (!user || isAnonymous) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 flex flex-col items-center justify-center">
        <p className="text-sm text-surface-muted mb-4">Sign in to access your creator dashboard.</p>
        <Link
          href="/"
          className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20"
        >
          Go home
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">{error}</p>
      </main>
    );
  }

  // ---- No creator profile ---------------------------------------------------

  if (!creator) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-2xl mx-auto pt-20">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-white mb-2">Creator Dashboard</h1>
            <p className="text-xs text-surface-muted uppercase tracking-widest">
              No creator profile yet
            </p>
          </div>
          <div className="flex gap-3 text-xs text-surface-muted">
            <Link href="/profile" className="hover:text-tingle-aqua">Profile</Link>
            <span>·</span>
            <Link href="/" className="hover:text-tingle-aqua">← Home</Link>
          </div>
        </div>
        <div className="rounded-lg border border-surface-border bg-surface-elevated p-8 text-center">
          <p className="text-xs text-surface-muted mb-2">
            Your account isn&apos;t set up as a creator yet.
          </p>
          <p className="text-xs text-surface-muted mb-6">
            Contact us at{" "}
            <a
              href="mailto:hello@tingle-tracker.com"
              className="text-tingle-aqua underline-offset-2 hover:underline"
            >
              hello@tingle-tracker.com
            </a>{" "}
            to get creator access.
          </p>
          <Link
            href="/demo"
            className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20"
          >
            Explore the demo
          </Link>
        </div>
      </main>
    );
  }

  // ---- Main dashboard ------------------------------------------------------

  return (
    <main className="min-h-screen bg-surface font-mono p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-white">{creator.display_name}</h1>
          <p className="text-xs uppercase tracking-widest text-surface-muted mt-1">Creator Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-xs text-surface-muted hover:text-tingle-aqua"
            >
              Admin →
            </Link>
          )}
          <Link
            href="/profile"
            className="text-xs text-surface-muted hover:text-tingle-aqua"
          >
            Profile
          </Link>
          <Link
            href="/"
            className="text-xs text-surface-muted hover:text-tingle-aqua"
          >
            ← Home
          </Link>
        </div>
      </div>

      {/* Top Triggers panel */}
      {topTriggers.length > 0 && (
        <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Top Triggers</h2>
          <div className="space-y-2">
            {topTriggers.map((t) => (
              <div key={t.trigger_tag_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-white">{t.trigger_label}</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
                    CATEGORY_STYLES[t.trigger_category as keyof typeof CATEGORY_STYLES]
                  )}
                >
                  {t.trigger_category.replace("_", " ")}
                </span>
                <span className="text-xs text-tingle-aqua tabular-nums">{t.total_tingles} tingles</span>
                <span className="text-xs text-surface-muted tabular-nums">avg {t.avg_intensity.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content list header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted">Your Videos</h2>
        <button
          onClick={() => setShowAddVideo((v) => !v)}
          className="rounded border border-tingle-aqua/40 bg-tingle-aqua/10 px-3 py-1.5 text-xs text-tingle-aqua hover:bg-tingle-aqua/20"
        >
          {showAddVideo ? "Cancel" : "+ Add Video"}
        </button>
      </div>

      {/* Add video form */}
      {showAddVideo && creator && (
        <div className="mb-4 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <ContentIngestForm
            creatorId={creator.id}
            accessToken={accessToken}
            onSuccess={() => {
              setShowAddVideo(false);
              loadData();
            }}
          />
        </div>
      )}

      {/* Content list */}
      {content.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-surface-elevated p-8 text-center">
          <p className="font-mono text-xs text-surface-muted mb-4">No videos yet.</p>
          {!showAddVideo && (
            <button
              onClick={() => setShowAddVideo(true)}
              className="rounded border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20"
            >
              Add your first video
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {content.map((c) => (
            <ContentCard
              key={c.id}
              content={c}
              totalTingles={heatmapTotals[c.id] ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// =============================================================================
// ContentCard
// =============================================================================

function ContentCard({
  content,
  totalTingles,
}: {
  content: ContentRow;
  totalTingles: number;
}) {
  return (
    <Link
      href={`/dashboard/content/${content.id}`}
      className={cn(
        "flex items-center gap-4 rounded-lg border border-surface-border bg-surface-elevated p-3",
        "hover:border-tingle-aqua/20 transition-colors"
      )}
    >
      {/* Thumbnail */}
      {content.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, external domain not configured
        <img
          src={content.thumbnail_url}
          alt=""
          className="w-24 h-14 rounded object-cover flex-shrink-0 border border-surface-border"
        />
      ) : (
        <div className="w-24 h-14 rounded bg-surface-muted/30 flex-shrink-0 border border-surface-border" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{content.title}</p>
        <p className="text-xs text-surface-muted mt-0.5">
          {new Date(content.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Tingle count */}
      <div className="text-right flex-shrink-0">
        {content.status === "ready" ? (
          <p className="text-sm text-tingle-aqua tabular-nums">{totalTingles.toLocaleString()}</p>
        ) : (
          <p className="text-sm text-surface-muted">—</p>
        )}
        <p className="text-[10px] text-surface-muted uppercase tracking-wider">tingles</p>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          "flex-shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-wider border",
          STATUS_STYLES[content.status]
        )}
      >
        {content.status === "processing" && (
          <span className="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1" />
        )}
        {content.status}
      </span>
    </Link>
  );
}
