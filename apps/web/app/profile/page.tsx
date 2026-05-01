"use client";

// =============================================================================
// /profile — Listener profile page
//
// ASMR fingerprint, tingle stats, sleep insights, trigger trend, discovery.
// Auth-guarded by middleware.
// =============================================================================

import { useEffect, useState, useMemo, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile, UserTriggerAffinityRow } from "@tingle/types";

interface RecommendedTile {
  content_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  creator_display_name: string | null;
  /** Trigger labels that overlap with the user's affinity, capped at 3 */
  matched_trigger_labels: string[];
}

type SuggestionFeedback = "thumbs_up" | "thumbs_down" | "hidden";

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

const CATEGORY_FILL = {
  visual: "bg-tingle-aqua",
  aural: "bg-tingle-purple",
  tactile_adjacent: "bg-tingle-gold",
} as const;

const CATEGORY_LABEL = {
  visual: "Visual",
  aural: "Aural",
  tactile_adjacent: "Tactile",
} as const;

interface MonthBucket {
  label: string; // "Jan '26"
  count: number;
}

interface SleepCreatorStat {
  creator_display_name: string;
  sleep_count: number;
}

export default function ProfilePage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [affinity, setAffinity] = useState<UserTriggerAffinityRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state for display name
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Saving discovery toggle
  const [savingDiscovery, setSavingDiscovery] = useState(false);

  const [suggestions, setSuggestions] = useState<RecommendedTile[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  // Tracks the optimistic feedback state for the current session
  const [feedbackMap, setFeedbackMap] = useState<Map<string, SuggestionFeedback>>(new Map());

  const [totalTingles, setTotalTingles] = useState(0);
  const [listeningMinutes, setListeningMinutes] = useState(0);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthBucket[]>([]);
  const [sleepSessionCount, setSleepSessionCount] = useState(0);
  const [sleepCreators, setSleepCreators] = useState<SleepCreatorStat[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;

    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    // Six months ago for trend window
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    Promise.all([
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_trigger_affinity")
        .select("*")
        .eq("user_id", user.id)
        .order("tingle_count", { ascending: false })
        .limit(10),
      supabase
        .from("tingle_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      // Max timestamp per content — proxy for cumulative listening time with tingles
      supabase
        .from("tingle_events")
        .select("content_id, timestamp_ms")
        .eq("user_id", user.id),
      // Monthly trend — past 6 months
      supabase
        .from("tingle_events")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", sixMonthsAgo.toISOString()),
      // Sleep sessions
      supabase
        .from("sleep_sessions")
        .select("id, fell_asleep, content_id, content(creator_id, creators(display_name))")
        .eq("user_id", user.id)
        .eq("fell_asleep", true),
    ])
      .then(([profileRes, affinityRes, tingleCountRes, tingleEventsRes, trendRes, sleepRes]) => {
        if (profileRes.error) { setError(profileRes.error.message); return; }
        if (affinityRes.error) { setError(affinityRes.error.message); return; }
        if (tingleCountRes.error) { setError(tingleCountRes.error.message); return; }

        setProfile(profileRes.data as UserProfile | null);
        setAffinity((affinityRes.data ?? []) as UserTriggerAffinityRow[]);
        setTotalTingles(tingleCountRes.count ?? 0);

        // Cumulative listening: sum max timestamp_ms per content_id
        if (tingleEventsRes.data && tingleEventsRes.data.length > 0) {
          const maxByContent = new Map<string, number>();
          for (const ev of tingleEventsRes.data) {
            const prev = maxByContent.get(ev.content_id) ?? 0;
            if (ev.timestamp_ms > prev) maxByContent.set(ev.content_id, ev.timestamp_ms);
          }
          const totalMs = Array.from(maxByContent.values()).reduce((a, b) => a + b, 0);
          setListeningMinutes(Math.round(totalMs / 60000));
        }

        // Monthly trend buckets
        if (trendRes.data) {
          const buckets = new Map<string, number>();
          for (const ev of trendRes.data) {
            const d = new Date(ev.created_at);
            const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            buckets.set(key, (buckets.get(key) ?? 0) + 1);
          }
          // Fill in the last 6 months in order
          const ordered: MonthBucket[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            ordered.push({ label, count: buckets.get(label) ?? 0 });
          }
          setMonthlyTrend(ordered);
        }

        // Sleep sessions
        if (!sleepRes.error && sleepRes.data) {
          setSleepSessionCount(sleepRes.data.length);

          // Count by creator
          const creatorCounts = new Map<string, number>();
          for (const row of sleepRes.data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined shape
            const creator = (row as any).content?.creators;
            const name: string | null = creator?.display_name ?? null;
            if (name) {
              creatorCounts.set(name, (creatorCounts.get(name) ?? 0) + 1);
            }
          }
          const sorted = Array.from(creatorCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([creator_display_name, sleep_count]) => ({ creator_display_name, sleep_count }));
          setSleepCreators(sorted);
        }
      })
      .finally(() => setLoadingData(false));
  }, [user, authLoading]);

  // Fingerprint: category totals from affinity
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = { visual: 0, aural: 0, tactile_adjacent: 0 };
    for (const row of affinity) {
      const cat = row.trigger_category;
      if (cat in totals) totals[cat] += row.tingle_count;
    }
    return totals;
  }, [affinity]);

  const fingerprintTotal = useMemo(
    () => Object.values(categoryTotals).reduce((a, b) => a + b, 0),
    [categoryTotals],
  );

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!user || !nameInput.trim()) return;
    setSavingName(true);
    const supabase = getSupabaseBrowserClient();
    const { data: upserted, error: upsertError } = await supabase
      .from("user_profiles")
      .upsert(
        { user_id: user.id, display_name: nameInput.trim() },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    setSavingName(false);
    if (upsertError) { setError(upsertError.message); return; }
    setProfile(upserted as UserProfile);
    setEditingName(false);
  }

  async function toggleDiscovery() {
    if (!user || !profile || savingDiscovery) return;
    setSavingDiscovery(true);
    const next = !profile.discovery_enabled;
    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ discovery_enabled: next })
      .eq("user_id", user.id);
    setSavingDiscovery(false);
    if (updateError) { setError(updateError.message); return; }
    setProfile((prev) => (prev ? { ...prev, discovery_enabled: next } : prev));
  }

  // Fetch 3 recommended tiles once affinity is populated
  useEffect(() => {
    if (!user || affinity.length === 0) return;

    const affinityTagIds = new Set(affinity.map((r) => r.trigger_tag_id));

    setLoadingSuggestions(true);

    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoadingSuggestions(false); return; }

      try {
        const res = await fetch("/api/discovery/recommended?limit=3", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;

        const { results } = (await res.json()) as {
          results: Array<{
            content_id: string;
            youtube_video_id: string;
            title: string;
            thumbnail_url: string | null;
            creator_display_name: string | null;
          }>;
        };

        if (!results || results.length === 0) return;

        const contentIds = results.map((r) => r.content_id);

        // Fetch trigger labels for these content items and intersect with user affinity
        const { data: triggerRows } = await supabase
          .from("content_triggers")
          .select("content_id, trigger_tag_id, trigger_tags(label)")
          .in("content_id", contentIds);

        // Build a map: content_id → matched trigger labels (intersection with user affinity)
        const matchMap = new Map<string, string[]>();
        for (const row of triggerRows ?? []) {
          if (!affinityTagIds.has(row.trigger_tag_id)) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- joined shape
          const label: string | null = (row as any).trigger_tags?.label ?? null;
          if (!label) continue;
          const existing = matchMap.get(row.content_id) ?? [];
          existing.push(label);
          matchMap.set(row.content_id, existing);
        }

        setSuggestions(
          results.map((r) => ({
            ...r,
            matched_trigger_labels: (matchMap.get(r.content_id) ?? []).slice(0, 3),
          })),
        );
      } finally {
        setLoadingSuggestions(false);
      }
    });
  }, [user, affinity]);

  const submitFeedback = useCallback(
    async (contentId: string, feedback: SuggestionFeedback) => {
      if (!user) return;
      // Optimistically update local state
      setFeedbackMap((prev) => new Map(prev).set(contentId, feedback));

      const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
      if (!session) return;

      await fetch("/api/discovery/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content_id: contentId, feedback }),
      });
    },
    [user],
  );

  // ---- Loading skeleton -------------------------------------------------------

  if (authLoading || loadingData) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-2xl mx-auto">
        <div className="space-y-3 mt-8">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-20 rounded border border-surface-border bg-surface-elevated animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-2xl mx-auto">
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          {error}
        </p>
      </main>
    );
  }

  const displayName =
    profile?.display_name ?? user?.email?.split("@")[0] ?? "Listener";

  const trendMax = Math.max(...monthlyTrend.map((b) => b.count), 1);

  const listeningDisplay =
    listeningMinutes >= 60
      ? `${(listeningMinutes / 60).toFixed(1)}h`
      : `${listeningMinutes}m`;

  return (
    <main className="min-h-screen bg-surface font-mono p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-white">Your Profile</h1>
          <p className="text-xs uppercase tracking-widest text-surface-muted mt-1">
            Listener
          </p>
        </div>
        <div className="flex gap-3 text-xs text-surface-muted">
          <Link href="/dashboard" className="hover:text-tingle-aqua">
            Creator Dashboard
          </Link>
          <span>·</span>
          <Link href="/" className="hover:text-tingle-aqua">
            Home
          </Link>
          <span>·</span>
          <button onClick={signOut} className="hover:text-tingle-aqua">
            Sign out
          </button>
        </div>
      </div>

      {/* Display name */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Display name</h2>
        {editingName ? (
          <form onSubmit={saveName} className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={40}
              disabled={savingName}
              className={cn(
                "flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2",
                "font-mono text-sm text-foreground",
                "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
                "disabled:opacity-50",
              )}
            />
            <button
              type="submit"
              disabled={savingName || !nameInput.trim()}
              className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-3 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 disabled:opacity-40"
            >
              {savingName ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="rounded-lg border border-surface-border px-3 py-2 text-xs text-surface-muted hover:text-tingle-aqua"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">{displayName}</span>
            <button
              onClick={() => {
                setNameInput(profile?.display_name ?? "");
                setEditingName(true);
              }}
              className="text-xs text-surface-muted hover:text-tingle-aqua"
            >
              Edit
            </button>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Your numbers</h2>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-2xl text-tingle-aqua tabular-nums">{totalTingles.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-muted">Total tingles</p>
          </div>
          <div>
            <p className="text-2xl text-tingle-aqua tabular-nums">{affinity.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-muted">Triggers found</p>
          </div>
          {listeningMinutes > 0 && (
            <div>
              <p className="text-2xl text-tingle-aqua tabular-nums">{listeningDisplay}</p>
              <p className="text-[10px] uppercase tracking-wider text-surface-muted">Tingle time logged</p>
            </div>
          )}
          {sleepSessionCount > 0 && (
            <div>
              <p className="text-2xl text-tingle-purple tabular-nums">{sleepSessionCount}</p>
              <p className="text-[10px] uppercase tracking-wider text-surface-muted">Times fell asleep</p>
            </div>
          )}
        </div>
      </section>

      {/* ASMR Fingerprint */}
      {fingerprintTotal > 0 && (
        <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-4">
            Your ASMR fingerprint
          </h2>
          <div className="space-y-3">
            {(["visual", "aural", "tactile_adjacent"] as const).map((cat) => {
              const count = categoryTotals[cat];
              const pct = fingerprintTotal > 0 ? (count / fingerprintTotal) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white/80">{CATEGORY_LABEL[cat]}</span>
                    <span className="text-xs text-surface-muted tabular-nums">
                      {count > 0 ? `${Math.round(pct)}%` : "—"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-muted/20 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", CATEGORY_FILL[cat])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* Dominant type badge */}
          {(() => {
            const dominant = (["visual", "aural", "tactile_adjacent"] as const).reduce(
              (best, cat) => (categoryTotals[cat] > categoryTotals[best] ? cat : best),
              "visual" as "visual" | "aural" | "tactile_adjacent",
            );
            const dominantPct = Math.round((categoryTotals[dominant] / fingerprintTotal) * 100);
            if (dominantPct < 50) return null;
            return (
              <p className="mt-3 text-[10px] text-surface-muted">
                Primarily{" "}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 border text-[10px] uppercase tracking-wider",
                    CATEGORY_STYLES[dominant],
                  )}
                >
                  {CATEGORY_LABEL[dominant]}
                </span>{" "}
                — {dominantPct}% of your tingles come from {CATEGORY_LABEL[dominant].toLowerCase()} triggers.
              </p>
            );
          })()}
        </section>
      )}

      {/* Monthly tingle trend */}
      {monthlyTrend.some((b) => b.count > 0) && (
        <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-4">
            Tingle trend — last 6 months
          </h2>
          <div className="flex items-end gap-2 h-16">
            {monthlyTrend.map((bucket) => (
              <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: "44px" }}>
                  <div
                    className="w-full rounded-t bg-tingle-aqua/60 hover:bg-tingle-aqua transition-colors"
                    style={{
                      height: bucket.count > 0 ? `${Math.max(4, (bucket.count / trendMax) * 44)}px` : "2px",
                      opacity: bucket.count === 0 ? 0.2 : 1,
                    }}
                    title={`${bucket.count} tingles`}
                  />
                </div>
                <span className="text-[9px] text-surface-muted text-center leading-tight">
                  {bucket.label}
                </span>
              </div>
            ))}
          </div>
          {(() => {
            const recent = monthlyTrend.slice(-2);
            if (recent.length < 2 || recent[0].count === 0) return null;
            const change = recent[1].count - recent[0].count;
            if (change === 0) return null;
            return (
              <p className="mt-2 text-[10px] text-surface-muted">
                {change > 0 ? "↑" : "↓"}{" "}
                {Math.abs(change)} tingles {change > 0 ? "more" : "fewer"} than last month.
              </p>
            );
          })()}
        </section>
      )}

      {/* Sleep insights */}
      {sleepSessionCount > 0 && (
        <section className="mb-6 rounded-lg border border-tingle-purple/20 bg-tingle-purple/5 p-4">
          <h2 className="text-xs uppercase tracking-widest text-tingle-purple/80 mb-3">
            Sleep insights
          </h2>
          <p className="text-sm text-white mb-3">
            You&apos;ve fallen asleep to ASMR{" "}
            <span className="text-tingle-purple tabular-nums">{sleepSessionCount}</span>{" "}
            {sleepSessionCount === 1 ? "time" : "times"}.
          </p>
          {sleepCreators.length > 0 && (
            <div className="space-y-2">
              {sleepCreators.map((c) => (
                <div key={c.creator_display_name} className="flex items-center justify-between">
                  <span className="text-xs text-white/80">{c.creator_display_name}</span>
                  <span className="text-xs text-tingle-purple tabular-nums">
                    {c.sleep_count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Log tingles CTA */}
      {totalTingles === 0 && (
        <section className="mb-6 rounded-lg border border-tingle-aqua/30 bg-tingle-aqua/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-tingle-aqua mb-1">Ready to log?</p>
            <p className="text-sm text-white">Tap the button each time you feel a tingle while a video plays.</p>
            <p className="text-xs text-surface-muted mt-0.5">Your trigger affinity updates automatically.</p>
          </div>
          <Link
            href="/listen"
            className="flex-shrink-0 rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors whitespace-nowrap"
          >
            Log tingles →
          </Link>
        </section>
      )}

      {/* Trigger affinity */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-surface-muted">
            Trigger affinity
          </h2>
          {totalTingles > 0 && (
            <Link
              href="/listen"
              className="text-xs text-tingle-aqua hover:underline underline-offset-2"
            >
              Log more →
            </Link>
          )}
        </div>
        {affinity.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-xs text-surface-muted mb-2">
              Your profile builds as you log tingles.
            </p>
            <Link
              href="/listen"
              className="text-xs text-tingle-aqua underline-offset-2 hover:underline"
            >
              Log tingles →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {affinity.map((row, idx) => {
              const maxCount = affinity[0].tingle_count;
              const pct = maxCount > 0 ? (row.tingle_count / maxCount) * 100 : 0;
              return (
                <div key={row.trigger_tag_id}>
                  <div className="flex items-center gap-3">
                    <span className="w-4 text-[10px] text-surface-muted tabular-nums text-right flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-white">{row.trigger_label}</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] uppercase tracking-wider border",
                        CATEGORY_STYLES[row.trigger_category as keyof typeof CATEGORY_STYLES],
                      )}
                    >
                      {row.trigger_category.replace("_", " ")}
                    </span>
                    <span className="text-xs text-tingle-aqua tabular-nums">
                      {row.tingle_count}
                    </span>
                    <span className="text-xs text-surface-muted tabular-nums">
                      avg {Number(row.avg_intensity).toFixed(1)}
                    </span>
                  </div>
                  <div className="ml-7 mt-1 h-0.5 rounded-full bg-surface-muted/20 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        CATEGORY_FILL[row.trigger_category as keyof typeof CATEGORY_FILL] ?? "bg-tingle-aqua",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Suggested for you — only shown once affinity is established */}
        {affinity.length > 0 && (
          <div className="mt-6 pt-5 border-t border-surface-border">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
              Suggested for you
            </p>

            {loadingSuggestions ? (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="rounded border border-surface-border bg-surface animate-pulse aspect-video"
                  />
                ))}
              </div>
            ) : suggestions.filter((s) => feedbackMap.get(s.content_id) !== "hidden").length === 0 ? (
              <p className="text-xs text-surface-muted py-2">
                No suggestions yet — keep logging tingles to improve your recommendations.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {suggestions
                  .filter((s) => feedbackMap.get(s.content_id) !== "hidden")
                  .map((tile) => {
                    const fb = feedbackMap.get(tile.content_id);
                    return (
                      <div
                        key={tile.content_id}
                        className="group flex flex-col rounded border border-surface-border bg-surface overflow-hidden"
                      >
                        {/* Thumbnail */}
                        <Link
                          href={`/listen/${tile.content_id}`}
                          className="block relative aspect-video bg-surface-border flex-shrink-0"
                        >
                          {tile.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={tile.thumbnail_url}
                              alt={tile.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg
                                className="w-6 h-6 text-surface-muted"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          )}
                        </Link>

                        {/* Info */}
                        <div className="flex flex-col gap-1 p-2 flex-1">
                          <Link
                            href={`/listen/${tile.content_id}`}
                            className="text-[11px] leading-snug text-white line-clamp-2 hover:text-tingle-aqua"
                          >
                            {tile.title}
                          </Link>
                          {tile.creator_display_name && (
                            <p className="text-[10px] text-surface-muted truncate">
                              {tile.creator_display_name}
                            </p>
                          )}

                          {/* Matched trigger pills */}
                          {tile.matched_trigger_labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {tile.matched_trigger_labels.map((label) => (
                                <span
                                  key={label}
                                  className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider border border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Feedback actions */}
                        <div className="flex items-center justify-end gap-1 px-2 pb-2">
                          <button
                            onClick={() => submitFeedback(tile.content_id, "thumbs_up")}
                            title="Good match"
                            aria-pressed={fb === "thumbs_up"}
                            className={cn(
                              "rounded p-1 text-[11px] transition-colors",
                              fb === "thumbs_up"
                                ? "text-tingle-aqua"
                                : "text-surface-muted hover:text-tingle-aqua",
                            )}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => submitFeedback(tile.content_id, "thumbs_down")}
                            title="Not for me"
                            aria-pressed={fb === "thumbs_down"}
                            className={cn(
                              "rounded p-1 text-[11px] transition-colors",
                              fb === "thumbs_down"
                                ? "text-white"
                                : "text-surface-muted hover:text-white",
                            )}
                          >
                            👎
                          </button>
                          <button
                            onClick={() => submitFeedback(tile.content_id, "hidden")}
                            title="Hide this suggestion"
                            className="rounded p-1 text-[11px] text-surface-muted hover:text-white transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Discovery toggle */}
      {profile && (
        <section className="rounded-lg border border-surface-border bg-surface-elevated p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-surface-muted">
                Discovery
              </h2>
              <p className="text-xs text-surface-muted mt-1">
                Allow creators to see your trigger preferences (anonymized)
              </p>
            </div>
            <button
              onClick={toggleDiscovery}
              disabled={savingDiscovery}
              aria-pressed={profile.discovery_enabled}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-tingle-aqua focus:ring-offset-2 focus:ring-offset-surface",
                "disabled:opacity-40",
                profile.discovery_enabled ? "bg-tingle-aqua" : "bg-surface-border",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  profile.discovery_enabled ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
