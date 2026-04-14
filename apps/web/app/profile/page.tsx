"use client";

// =============================================================================
// /profile — Listener profile page
//
// Shows the logged-in user's tingle statistics, trigger affinity, and
// discovery preferences. Auth-guarded by middleware.
// =============================================================================

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile, UserTriggerAffinityRow } from "@tingle/types";

const CATEGORY_STYLES = {
  visual: "border-tingle-aqua/30 bg-tingle-aqua/10 text-tingle-aqua",
  aural: "border-tingle-purple/30 bg-tingle-purple/10 text-tingle-purple",
  tactile_adjacent: "border-tingle-gold/30 bg-tingle-gold/10 text-tingle-gold",
} as const;

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

  const [totalTingles, setTotalTingles] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;

    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

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
    ])
      .then(([profileRes, affinityRes, tingleCountRes]) => {
        if (profileRes.error) { setError(profileRes.error.message); return; }
        if (affinityRes.error) { setError(affinityRes.error.message); return; }
        if (tingleCountRes.error) { setError(tingleCountRes.error.message); return; }
        setProfile(profileRes.data as UserProfile | null);
        setAffinity((affinityRes.data ?? []) as UserTriggerAffinityRow[]);
        setTotalTingles(tingleCountRes.count ?? 0);
      })
      .finally(() => setLoadingData(false));
  }, [user, authLoading]);

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

  // ---- Loading skeleton -------------------------------------------------------

  if (authLoading || loadingData) {
    return (
      <main className="min-h-screen bg-surface font-mono p-6 max-w-2xl mx-auto">
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
          <button
            onClick={signOut}
            className="hover:text-tingle-aqua"
          >
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
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">Stats</h2>
        <div className="flex gap-6">
          <div>
            <p className="text-2xl text-tingle-aqua tabular-nums">{totalTingles.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-muted">Total tingles</p>
          </div>
          <div>
            <p className="text-2xl text-tingle-aqua tabular-nums">{affinity.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-muted">Triggers found</p>
          </div>
        </div>
      </section>

      {/* Log tingles CTA */}
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

      {/* Trigger affinity */}
      <section className="mb-6 rounded-lg border border-surface-border bg-surface-elevated p-4">
        <h2 className="text-xs uppercase tracking-widest text-surface-muted mb-3">
          Trigger affinity
        </h2>
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
            {affinity.map((row) => (
              <div key={row.trigger_tag_id} className="flex items-center gap-3">
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
                  {row.tingle_count} tingles
                </span>
                <span className="text-xs text-surface-muted tabular-nums">
                  avg {Number(row.avg_intensity).toFixed(1)}
                </span>
              </div>
            ))}
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
                Allow creators to see your trigger preferences (anonymised)
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
