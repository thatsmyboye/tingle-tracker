"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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

interface SimilarCreatorResult {
  similar_creator_id: string;
  similar_creator_name: string;
  shared_trigger_count: number;
  overlap_score: number;
}

interface ContentRow {
  id: string;
  creator_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
  /** From insights_cache — set when audio.analyze ran */
  audio_worker_status?: string | null;
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [similarCreators, setSimilarCreators] = useState<SimilarCreatorResult[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // Aggregate audience insights
  const [audienceTotalListeners, setAudienceTotalListeners] = useState<number | null>(null);
  const [audienceSleepRate, setAudienceSleepRate] = useState<number | null>(null);
  const [audienceSleepCount, setAudienceSleepCount] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentRef = useRef<ContentRow[]>([]);
  contentRef.current = content;

  const [showCreatorForm, setShowCreatorForm] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorUrl, setCreatorUrl] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [creatorFormError, setCreatorFormError] = useState<string | null>(null);

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
        .eq("is_batch_import", false)
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
    setTopTriggers((triggersRes.data ?? []) as CreatorTopTriggerRow[]);

    // Aggregate heatmap tingle totals + audio worker status per content item
    if (contentList.length > 0) {
      const ids = contentList.map((c) => c.id);
      const [{ data: heatmapData }, { data: insightStatusRows }] = await Promise.all([
        supabase
          .from("content_tingle_heatmap")
          .select("content_id, tingle_count")
          .in("content_id", ids),
        supabase.from("insights_cache").select("content_id, audio_worker_status").in("content_id", ids),
      ]);

      const totals: Record<string, number> = {};
      for (const row of heatmapData ?? []) {
        if (row.content_id && row.tingle_count != null) {
          totals[row.content_id] = (totals[row.content_id] ?? 0) + row.tingle_count;
        }
      }
      setHeatmapTotals(totals);

      const audioStatusByContentId: Record<string, string | null> = {};
      for (const row of insightStatusRows ?? []) {
        if (row.content_id) {
          audioStatusByContentId[row.content_id] = row.audio_worker_status ?? null;
        }
      }
      setContent(
        contentList.map((c) => ({
          ...c,
          audio_worker_status: audioStatusByContentId[c.id] ?? null,
        }))
      );
    } else {
      setContent(contentList);
    }

    setLoadingData(false);

    // Aggregate audience insights — unique listeners + sleep rate for this creator's content
    if (contentList.length > 0) {
      const contentIds = contentList.map((c) => c.id);
      const [listenersRes, sleepRes] = await Promise.all([
        supabase
          .from("tingle_events")
          .select("user_id", { count: "exact" })
          .in("content_id", contentIds),
        supabase
          .from("sleep_sessions")
          .select("fell_asleep", { count: "exact" })
          .in("content_id", contentIds)
          .not("fell_asleep", "is", null),
      ]);
      if (listenersRes.data) {
        const uniqueListeners = new Set(listenersRes.data.map((r) => r.user_id)).size;
        setAudienceTotalListeners(uniqueListeners);
      }
      if (!sleepRes.error && sleepRes.data) {
        const total = sleepRes.data.length;
        const fellAsleep = sleepRes.data.filter((r) => r.fell_asleep === true).length;
        setAudienceSleepCount(fellAsleep);
        setAudienceSleepRate(total > 0 ? fellAsleep / total : null);
      }
    }

    // Fetch similar creators in the background after main data loads
    setLoadingSimilar(true);
    fetch(`/api/discovery/similar-creators/${creatorData.id}?limit=5`)
      .then((r) => r.json())
      .then((json) => {
        if (Array.isArray(json.results)) {
          setSimilarCreators(json.results as SimilarCreatorResult[]);
        }
      })
      .catch(() => { /* best-effort, silent */ })
      .finally(() => setLoadingSimilar(false));
  }

  async function handleCreateCreator(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = creatorName.trim();
    if (name.length < 2 || name.length > 80) {
      setCreatorFormError("Display name must be between 2 and 80 characters.");
      return;
    }
    setCreatingProfile(true);
    setCreatorFormError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: insertError } = await supabase.from("creators").insert({
      user_id: user.id,
      display_name: name,
      youtube_channel_url: creatorUrl.trim() || null,
    });
    if (insertError) {
      setCreatorFormError(insertError.message);
      setCreatingProfile(false);
      return;
    }
    await supabase
      .from("user_profiles")
      .upsert({ user_id: user.id, is_creator: true }, { onConflict: "user_id" });
    setCreatingProfile(false);
    loadData();
  }

  useEffect(() => {
    if (!authLoading && user && !isAnonymous) {
      loadData();
    } else if (!authLoading) {
      setLoadingData(false);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAnonymous, authLoading]);

  // Poll every 5 s while any video is still pending/processing.
  const hasInFlight = !loadingData && content.some(
    (c) => c.status === "pending" || c.status === "processing"
  );
  useEffect(() => {
    if (!hasInFlight) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return; // already polling

    const supabase = getSupabaseBrowserClient();
    pollRef.current = setInterval(async () => {
      const inFlightIds = contentRef.current
        .filter((c) => c.status === "pending" || c.status === "processing")
        .map((c) => c.id);
      if (inFlightIds.length === 0) return;

      const { data } = await supabase
        .from("content")
        .select("id, status")
        .in("id", inFlightIds);

      if (!data) return;

      const statusMap = new Map(data.map((d) => [d.id, d.status as ContentRow["status"]]));
      setContent(contentRef.current.map((c) => {
        const newStatus = statusMap.get(c.id);
        return newStatus ? { ...c, status: newStatus } : c;
      }));
    }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasInFlight]);

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
            <h1 className="font-serif text-3xl text-white mb-2">You&apos;re logged in</h1>
            <p className="text-xs text-surface-muted uppercase tracking-widest">
              Listener account
            </p>
          </div>
          <div className="flex gap-3 text-xs text-surface-muted">
            <Link href="/" className="hover:text-tingle-aqua">← Home</Link>
          </div>
        </div>

        <div className="rounded-lg border border-tingle-aqua/30 bg-tingle-aqua/5 p-8 text-center mb-4">
          <p className="text-xs uppercase tracking-widest text-tingle-aqua mb-2">Your listener hub</p>
          <p className="text-sm text-white mb-1">
            Your profile is where your tingle history and trigger affinity live.
          </p>
          <p className="text-xs text-surface-muted mb-6">
            Log tingles while watching ASMR content to start building your profile.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/profile"
              className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
            >
              Go to your profile →
            </Link>
            <Link
              href="/listen"
              className="rounded-lg border border-surface-border bg-surface-elevated px-6 py-3 text-sm text-white hover:border-tingle-aqua/30 transition-colors"
            >
              Log tingles
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-surface-border bg-surface-elevated p-6 mb-4">
          {!showCreatorForm ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white mb-0.5">Are you an ASMR creator?</p>
                <p className="text-xs text-surface-muted">Set up a creator profile to link videos and track tingle heatmaps.</p>
              </div>
              <button
                onClick={() => setShowCreatorForm(true)}
                className="flex-shrink-0 rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
              >
                Become a Creator
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateCreator} className="space-y-4">
              <h2 className="text-xs uppercase tracking-widest text-surface-muted">Creator profile</h2>
              <div>
                <label className="block text-xs text-surface-muted mb-1" htmlFor="creator-name">
                  Display name <span className="text-red-400">*</span>
                </label>
                <input
                  id="creator-name"
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Your creator name"
                  minLength={2}
                  maxLength={80}
                  required
                  disabled={creatingProfile}
                  className={cn(
                    "w-full rounded-lg border border-surface-border bg-surface px-3 py-2",
                    "font-mono text-sm text-foreground placeholder:text-surface-muted",
                    "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
                    "disabled:opacity-50",
                  )}
                />
              </div>
              <div>
                <label className="block text-xs text-surface-muted mb-1" htmlFor="creator-url">
                  YouTube channel URL <span className="text-surface-muted/60">(optional)</span>
                </label>
                <input
                  id="creator-url"
                  type="url"
                  value={creatorUrl}
                  onChange={(e) => setCreatorUrl(e.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                  disabled={creatingProfile}
                  className={cn(
                    "w-full rounded-lg border border-surface-border bg-surface px-3 py-2",
                    "font-mono text-sm text-foreground placeholder:text-surface-muted",
                    "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
                    "disabled:opacity-50",
                  )}
                />
              </div>
              {creatorFormError && (
                <p className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {creatorFormError}
                </p>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={creatingProfile || creatorName.trim().length < 2}
                  className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 disabled:opacity-40 transition-colors"
                >
                  {creatingProfile ? "Creating…" : "Create creator profile"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreatorForm(false); setCreatorFormError(null); }}
                  disabled={creatingProfile}
                  className="text-xs text-surface-muted hover:text-tingle-aqua"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-surface-muted">
          Need help?{" "}
          <a
            href="mailto:paul@banton-digital.com"
            className="text-tingle-aqua underline-offset-2 hover:underline"
          >
            Email us
          </a>
        </p>
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

      {/* Aggregate audience insights */}
      {(audienceTotalListeners !== null || audienceSleepRate !== null) && (
        <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-4">
            Audience insights
          </h2>
          <div className="flex flex-wrap gap-6">
            {audienceTotalListeners !== null && (
              <div>
                <p className="text-2xl text-tingle-aqua tabular-nums">
                  {audienceTotalListeners.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-surface-muted">Unique listeners</p>
              </div>
            )}
            {audienceSleepCount > 0 && (
              <div>
                <p className="text-2xl text-tingle-purple tabular-nums">{audienceSleepCount}</p>
                <p className="text-[10px] uppercase tracking-wider text-surface-muted">Sleep sessions</p>
              </div>
            )}
            {audienceSleepRate !== null && audienceSleepRate > 0 && (
              <div>
                <p className="text-2xl text-tingle-purple tabular-nums">
                  {Math.round(audienceSleepRate * 100)}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-surface-muted">Sleep rate</p>
              </div>
            )}
            {Object.keys(heatmapTotals).length > 0 && (
              <div>
                <p className="text-2xl text-tingle-aqua tabular-nums">
                  {Object.values(heatmapTotals).reduce((a, b) => a + b, 0).toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-surface-muted">Total tingles</p>
              </div>
            )}
          </div>
          {audienceSleepRate !== null && audienceSleepRate >= 0.5 && (
            <p className="mt-3 text-[10px] text-surface-muted">
              Over half your listeners fell asleep during your content — a strong signal for deep ASMR efficacy.
            </p>
          )}
        </section>
      )}

      {/* Similar creators panel */}
      {(loadingSimilar || similarCreators.length > 0) && (
        <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">
            Creators like you
          </h2>
          {loadingSimilar ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-8 rounded bg-surface-muted/20 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {similarCreators.map((c) => (
                <div key={c.similar_creator_id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-white truncate">{c.similar_creator_name}</span>
                  <span className="text-xs text-surface-muted tabular-nums">
                    {c.shared_trigger_count} shared trigger{c.shared_trigger_count !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-tingle-aqua tabular-nums">
                    {Math.round(c.overlap_score * 100)}% overlap
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] text-surface-muted">
            Ranked by trigger taxonomy overlap — potential style peers or collaboration partners.
          </p>
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
              isRemoving={removingId === c.id}
              onRemove={async () => {
                if (!confirm(`Remove "${c.title}" from your videos? Tingle data will be preserved.`)) return;
                setRemovingId(c.id);
                try {
                  const res = await fetch(`/api/content/${c.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${accessToken}` },
                  });
                  if (!res.ok) {
                    const json = await res.json().catch(() => ({}));
                    alert(json.error ?? "Failed to remove video.");
                  } else {
                    loadData();
                  }
                } finally {
                  setRemovingId(null);
                }
              }}
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
  isRemoving,
  onRemove,
}: {
  content: ContentRow;
  totalTingles: number;
  isRemoving: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-surface-border bg-surface-elevated p-3",
        "transition-colors",
        isRemoving && "opacity-50"
      )}
    >
      {/* Thumbnail (links to detail) */}
      <Link href={`/dashboard/content/${content.id}`} className="flex-shrink-0">
        {content.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, external domain not configured
          <img
            src={content.thumbnail_url}
            alt=""
            className="w-24 h-14 rounded object-cover border border-surface-border hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-24 h-14 rounded bg-surface-muted/30 border border-surface-border" />
        )}
      </Link>

      {/* Info (links to detail) */}
      <Link
        href={`/dashboard/content/${content.id}`}
        className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <p className="text-sm text-white truncate">{content.title}</p>
        <p className="text-xs text-surface-muted mt-0.5">
          {new Date(content.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </Link>

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
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "rounded px-2 py-1 text-[10px] uppercase tracking-wider border",
            STATUS_STYLES[content.status]
          )}
        >
          {content.status === "processing" && (
            <span className="inline-block w-2 h-2 border border-current border-t-transparent rounded-full animate-spin mr-1" />
          )}
          {content.status}
        </span>
        {content.status === "ready" && content.audio_worker_status === "failed" && (
          <span
            className="max-w-[9rem] text-right font-mono text-[9px] uppercase tracking-wider text-amber-200/90"
            title="Acoustic extraction failed; AI used captions/metadata only."
          >
            Audio unavailable
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={isRemoving}
        title="Remove from your videos"
        className="flex-shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-wider border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 disabled:opacity-40 transition-colors"
      >
        {isRemoving ? "…" : "Remove"}
      </button>
    </div>
  );
}
