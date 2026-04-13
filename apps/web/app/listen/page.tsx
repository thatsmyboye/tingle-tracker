"use client";

// =============================================================================
// /listen — Production content browser for listeners
//
// Lists all ready content with creator names. Auth-guarded by middleware.
// Authenticated listeners pick a video to watch and log tingles against.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@tingle/database";
import { useAuth } from "@/hooks/useAuth";

interface ContentWithCreator {
  id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  creators: { display_name: string } | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ListenPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [content, setContent] = useState<ContentWithCreator[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const supabase = getSupabaseBrowserClient();
    setLoadingData(true);

    supabase
      .from("content")
      .select(
        "id, youtube_video_id, title, description, duration_seconds, thumbnail_url, creators(display_name)"
      )
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          setContent((data ?? []) as ContentWithCreator[]);
        }
        setLoadingData(false);
      });
  }, [authLoading, user]);

  const isLoading = authLoading || loadingData;

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

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 pt-10 pb-6">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
          Listener Mode
        </p>
        <h1 className="font-serif text-4xl text-white mb-2">
          Browse ASMR Content
        </h1>
        <p className="text-sm text-surface-muted leading-relaxed">
          Pick a video and tap ✦ whenever you feel a tingle. Your responses feed
          the creator&apos;s analytics dashboard in real time.
        </p>
      </section>

      {/* Content area */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-24 rounded-lg border border-surface-border bg-surface-elevated animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        ) : content.length === 0 ? (
          <div className="rounded-lg border border-surface-border bg-surface-elevated p-12 text-center">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">
              No content yet
            </p>
            <p className="text-sm text-surface-muted leading-relaxed mb-6">
              Creators haven&apos;t added any videos yet. Check back soon, or
              try the interactive demo to see what logging feels like.
            </p>
            <Link
              href="/demo"
              className="inline-block rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
            >
              Try the demo →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// =============================================================================
// ContentCard
// =============================================================================

function ContentCard({ item }: { item: ContentWithCreator }) {
  const creatorName = item.creators?.display_name ?? "Unknown creator";
  const duration = formatDuration(item.duration_seconds);

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
            <span className="text-surface-muted/40 text-4xl select-none">▶</span>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1">
        <p className="text-sm text-white leading-snug line-clamp-2 mb-1">
          {item.title}
        </p>
        <p className="text-xs text-surface-muted">{creatorName}</p>
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
