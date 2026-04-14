"use client";

// =============================================================================
// /listen — Listener entry point
//
// Public page (no auth required). Two sections:
//   1. YouTube URL input — resolves any video URL to a content row and
//      navigates to /listen/[contentId] so the listener can start logging.
//   2. Trending grid — videos ranked by tingle activity in the past 7 days,
//      fetched via the get_trending_content() RPC.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@tingle/database";

// ---- Types ------------------------------------------------------------------

interface TrendingItem {
  id: string;
  youtube_video_id: string;
  youtube_channel_id: string | null;
  channel_title: string | null;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  creator_display_name: string | null;
  tingle_count: number;
}

// ---- Helpers ----------------------------------------------------------------

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTingleCount(n: number): string {
  if (n === 0) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// =============================================================================
// Page
// =============================================================================

export default function ListenPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Fetch trending on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .rpc("get_trending_content", { p_limit: 12 })
      .then(({ data }) => {
        if (data) setTrending(data as TrendingItem[]);
        setTrendingLoading(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setInputError("Paste a YouTube URL to get started.");
      inputRef.current?.focus();
      return;
    }

    setInputError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/content/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: trimmed }),
      });
      const data = (await res.json()) as { contentId?: string; error?: string };

      if (!res.ok || !data.contentId) {
        setInputError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push(`/listen/${data.contentId}`);
    } catch {
      setInputError("Network error — please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between border-b border-surface-border/50">
        <Link
          href="/"
          className="flex items-center gap-2 text-tingle-aqua hover:opacity-80 transition-opacity"
        >
          <span className="text-lg">✦</span>
          <span className="text-sm">Tingle Tracker</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-surface-muted">
          <Link href="/profile" className="hover:text-tingle-aqua transition-colors">
            Profile
          </Link>
          <Link href="/demo" className="hover:text-tingle-aqua transition-colors">
            Demo
          </Link>
        </div>
      </nav>

      {/* Hero + URL input */}
      <section className="max-w-4xl mx-auto px-6 pt-12 pb-10">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
          Listener Mode
        </p>
        <h1 className="font-serif text-4xl text-white mb-3">
          Paste any ASMR video
        </h1>
        <p className="text-sm text-surface-muted leading-relaxed mb-8">
          Play any YouTube video and tap ✦ whenever you feel a tingle. Your
          responses are collected for the creator&apos;s analytics automatically
          — even before they&apos;ve signed up.
        </p>

        {/* URL input */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setInputError(null);
            }}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 rounded-lg border border-surface-border bg-surface-elevated px-4 py-3 text-sm text-white placeholder:text-surface-muted/50 focus:border-tingle-aqua/50 focus:outline-none focus:ring-1 focus:ring-tingle-aqua/30 transition-colors"
            disabled={isSubmitting}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={isSubmitting || !url.trim()}
            className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border border-tingle-aqua/60 border-t-transparent rounded-full animate-spin" />
                Loading…
              </span>
            ) : (
              "Start listening →"
            )}
          </button>
        </form>

        {inputError && (
          <p className="mt-2 text-xs text-red-400">{inputError}</p>
        )}

        <p className="mt-3 text-[10px] text-surface-muted/50">
          Supports youtube.com/watch, youtu.be, Shorts, and embed URLs
        </p>
      </section>

      {/* Trending */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-5">
          Trending this week
        </p>

        {trendingLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-52 rounded-lg border border-surface-border bg-surface-elevated animate-pulse"
              />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-10 text-center">
            <p className="text-xs text-surface-muted leading-relaxed">
              No activity yet — paste a video above to be the first to log
              tingles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((item) => (
              <TrendingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// =============================================================================
// TrendingCard
// =============================================================================

function TrendingCard({ item }: { item: TrendingItem }) {
  // Prefer claimed creator display name; fall back to raw channel title
  const displayName =
    item.creator_display_name ?? item.channel_title ?? "Unknown";
  const duration = formatDuration(item.duration_seconds);
  const tingleLabel = formatTingleCount(item.tingle_count);

  return (
    <Link
      href={`/listen/${item.id}`}
      className="group flex flex-col rounded-lg border border-surface-border bg-surface-elevated overflow-hidden hover:border-tingle-aqua/30 transition-colors"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-muted/20 relative overflow-hidden">
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, external domain not configured in next.config
          <img
            src={item.thumbnail_url}
            alt=""
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-surface-muted/40 text-4xl select-none">
              ▶
            </span>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {duration}
          </span>
        )}
        {tingleLabel && (
          <span className="absolute top-1.5 right-1.5 rounded bg-tingle-aqua/20 border border-tingle-aqua/30 px-1.5 py-0.5 font-mono text-[10px] text-tingle-aqua">
            ✦ {tingleLabel}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1">
        <p className="text-sm text-white leading-snug line-clamp-2 mb-1">
          {item.title}
        </p>
        <p className="text-xs text-surface-muted">{displayName}</p>
      </div>

      {/* CTA */}
      <div className="px-3 pb-3">
        <span className="text-[10px] uppercase tracking-widest text-tingle-aqua/70 group-hover:text-tingle-aqua transition-colors">
          Log tingles →
        </span>
      </div>
    </Link>
  );
}
