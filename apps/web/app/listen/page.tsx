"use client";

// =============================================================================
// /listen — Listener entry point
//
// Public page (no auth required). Two sections:
//   1. YouTube URL input — resolves any video URL to a content row and
//      navigates to /listen/[contentId] so the listener can start logging.
//   2. Trigger search — lookahead multiselect over trigger_tags, results
//      ranked by number of selected triggers matched (relevance).
//   3. Trending grid — videos ranked by tingle activity in the past 7 days.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@tingle/database";
// These mirror the exported types in the API routes — kept in sync manually
interface TriggerSuggestion {
  id: string;
  label: string;
  slug: string;
  category: string;
}

interface MatchedTrigger {
  trigger_tag_id: string;
  trigger_label: string;
  trigger_slug: string;
  confidence: number;
  timestamp_ms: number | null;
  lead_in_start_ms: number | null;
}

interface ContentMatch {
  content_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  creator_id: string | null;
  creator_display_name: string | null;
  match_count: number;
  matched_triggers: MatchedTrigger[];
}

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

function formatMs(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// =============================================================================
// Page
// =============================================================================

export default function ListenPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // URL input
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  // Trending
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  // Trigger search — lookahead + multiselect
  const [lookaheadInput, setLookaheadInput] = useState("");
  const [suggestions, setSuggestions] = useState<TriggerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTriggers, setSelectedTriggers] = useState<TriggerSuggestion[]>([]);
  const [searchResults, setSearchResults] = useState<ContentMatch[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedInput = useDebounce(lookaheadInput, 200);

  // Fetch trending on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase
      .rpc("get_trending_content", { p_limit: 6 })
      .then(({ data }) => {
        if (data) setTrending(data as TrendingItem[]);
        setTrendingLoading(false);
      });
  }, []);

  // Lookahead fetch
  useEffect(() => {
    const q = debouncedInput.trim();
    if (!q) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/discovery/triggers/suggest?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { suggestions?: TriggerSuggestion[] }) => {
        if (cancelled) return;
        const filtered = (d.suggestions ?? []).filter(
          (s) => !selectedTriggers.some((sel) => sel.id === s.id)
        );
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => { cancelled = true; };
  }, [debouncedInput, selectedTriggers]);

  // Close suggestions on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        triggerInputRef.current?.contains(e.target as Node) ||
        suggestionsRef.current?.contains(e.target as Node)
      ) return;
      setShowSuggestions(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const addTrigger = useCallback((tag: TriggerSuggestion) => {
    setSelectedTriggers((prev) =>
      prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
    );
    setLookaheadInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    triggerInputRef.current?.focus();
  }, []);

  const removeTrigger = useCallback((id: string) => {
    setSelectedTriggers((prev) => prev.filter((t) => t.id !== id));
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

  async function handleTriggerSearch(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTriggers.length === 0) return;

    setSearchLoading(true);
    setSearchError(null);
    setHasSearched(false);

    try {
      const tagIds = selectedTriggers.map((t) => t.id).join(",");
      const res = await fetch(
        `/api/discovery/triggers?tagIds=${encodeURIComponent(tagIds)}&limit=20`
      );
      const data = (await res.json()) as { results?: ContentMatch[]; error?: string };
      if (!res.ok) {
        setSearchError("Something went wrong — please try again.");
        setSearchResults([]);
        return;
      }
      setSearchResults(data.results ?? []);
      setHasSearched(true);
    } catch {
      setSearchError("Network error — please try again.");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
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

      {/* Trigger search */}
      <section className="max-w-4xl mx-auto px-6 pb-10">
        <div className="rounded-lg border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
            Find by trigger
          </p>

          <form onSubmit={handleTriggerSearch}>
            {/* Input + suggestions */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  ref={triggerInputRef}
                  type="text"
                  value={lookaheadInput}
                  onChange={(e) => {
                    setLookaheadInput(e.target.value);
                    setSearchError(null);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder={
                    selectedTriggers.length === 0
                      ? "Type a trigger: whispering, tapping, brushing…"
                      : "Add another trigger…"
                  }
                  className="flex-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-white placeholder:text-surface-muted/50 focus:border-tingle-aqua/50 focus:outline-none focus:ring-1 focus:ring-tingle-aqua/30"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="submit"
                  disabled={searchLoading || selectedTriggers.length === 0}
                  className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-4 py-2 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {searchLoading ? "Searching…" : "Search"}
                </button>
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <ul
                  ref={suggestionsRef}
                  className="absolute z-20 mt-1 w-full rounded-lg border border-surface-border bg-surface-elevated shadow-lg overflow-hidden"
                >
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          addTrigger(s);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-tingle-aqua/10 transition-colors text-left"
                      >
                        <span>{s.label}</span>
                        <span className="text-[10px] text-surface-muted capitalize ml-2 shrink-0">
                          {s.category.replace("_", " ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected trigger chips */}
            {selectedTriggers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedTriggers.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-full border border-tingle-aqua/30 bg-tingle-aqua/10 px-2.5 py-0.5 text-xs text-tingle-aqua"
                  >
                    {t.label}
                    <button
                      type="button"
                      onClick={() => removeTrigger(t.id)}
                      className="hover:text-white transition-colors leading-none"
                      aria-label={`Remove ${t.label}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>

          {searchError && (
            <p className="mt-2 text-xs text-red-400">{searchError}</p>
          )}

          {hasSearched && searchResults.length === 0 && !searchError && (
            <p className="mt-3 text-xs text-surface-muted">
              No content found matching{" "}
              {selectedTriggers.map((t) => t.label).join(", ")} — try fewer
              triggers or different ones.
            </p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((result) => (
                <ContentMatchCard
                  key={result.content_id}
                  result={result}
                  totalSelected={selectedTriggers.length}
                />
              ))}
            </div>
          )}
        </div>
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
// ContentMatchCard
// =============================================================================

function ContentMatchCard({
  result,
  totalSelected,
}: {
  result: ContentMatch;
  totalSelected: number;
}) {
  // Pick the trigger moment with the earliest timestamp for "start at" CTA
  const bestMoment = result.matched_triggers
    .filter((t): t is MatchedTrigger & { lead_in_start_ms: number } =>
      t.lead_in_start_ms != null
    )
    .sort((a, b) => a.lead_in_start_ms - b.lead_in_start_ms)[0];

  const href = bestMoment
    ? `/listen/${result.content_id}?startMs=${bestMoment.lead_in_start_ms}`
    : `/listen/${result.content_id}`;

  const allMatch = result.match_count === totalSelected;

  return (
    <a
      href={href}
      className="flex items-start gap-3 rounded border border-surface-border bg-surface px-3 py-2.5 hover:border-tingle-aqua/30 transition-colors"
    >
      {/* Relevance badge */}
      <div className="shrink-0 flex flex-col items-center pt-0.5">
        <span
          className={`text-[10px] tabular-nums font-bold leading-none ${
            allMatch ? "text-tingle-aqua" : "text-surface-muted"
          }`}
        >
          {result.match_count}/{totalSelected}
        </span>
        <span className="text-[9px] text-surface-muted leading-none mt-0.5">match</span>
      </div>

      {/* Content info */}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white truncate">{result.title}</p>
        <p className="text-[10px] text-surface-muted truncate mb-1.5">
          {result.creator_display_name ?? "Unknown creator"}
        </p>

        {/* Matched trigger pills */}
        <div className="flex flex-wrap gap-1">
          {result.matched_triggers.map((t) => (
            <span
              key={t.trigger_tag_id}
              className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-surface-border px-2 py-0.5 text-[10px] text-surface-muted"
            >
              {t.trigger_label}
              {t.lead_in_start_ms != null && (
                <span className="text-tingle-aqua/70">
                  @ {formatMs(t.lead_in_start_ms)}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Start CTA */}
      {bestMoment && (
        <span className="text-[10px] text-tingle-aqua tabular-nums whitespace-nowrap shrink-0 pt-0.5">
          Start {formatMs(bestMoment.lead_in_start_ms)}
        </span>
      )}
    </a>
  );
}

// =============================================================================
// TrendingCard
// =============================================================================

function TrendingCard({ item }: { item: TrendingItem }) {
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
