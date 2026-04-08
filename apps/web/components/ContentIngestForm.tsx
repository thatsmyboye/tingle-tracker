"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@tingle/ui";

// =============================================================================
// ContentIngestForm
// Lets a creator submit a YouTube URL to ingest a video into Tingle Tracker.
// Calls POST /api/content/ingest with the creator's Supabase JWT.
// =============================================================================

interface ContentIngestFormProps {
  creatorId: string;
  /** Supabase access token for the authenticated user */
  accessToken: string;
  onSuccess?: (contentId: string, title: string) => void;
  className?: string;
}

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; contentId: string; title: string }
  | { status: "error"; message: string };

export function ContentIngestForm({
  creatorId,
  accessToken,
  onSuccess,
  className,
}: ContentIngestFormProps) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/content/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ youtubeUrl: url.trim(), creatorId }),
      });

      const json = (await res.json()) as {
        content?: { id: string; title: string };
        contentId?: string;
        error?: string;
      };

      if (res.status === 409) {
        setState({
          status: "error",
          message: "This video has already been added to your library.",
        });
        return;
      }

      if (!res.ok || !json.content) {
        setState({
          status: "error",
          message: json.error ?? "Something went wrong. Please try again.",
        });
        return;
      }

      setState({
        status: "success",
        contentId: json.content.id,
        title: json.content.title,
      });
      setUrl("");
      onSuccess?.(json.content.id, json.content.title);
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  const isLoading = state.status === "loading";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label
          htmlFor="youtube-url"
          className="text-xs uppercase tracking-widest text-surface-muted"
        >
          YouTube URL or video ID
        </label>

        <div className="flex gap-2">
          <input
            id="youtube-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            disabled={isLoading}
            className={cn(
              "flex-1 rounded-lg border border-surface-border bg-surface-elevated px-4 py-3",
              "font-mono text-sm text-foreground placeholder:text-surface-muted",
              "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
              "disabled:opacity-50"
            )}
          />

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className={cn(
              "rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-5 py-3",
              "font-mono text-sm text-tingle-aqua transition-colors",
              "hover:bg-tingle-aqua/20 focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            {isLoading ? "Adding…" : "Add video"}
          </button>
        </div>
      </form>

      {/* Status feedback */}
      {state.status === "error" && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-400">
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <p className="rounded-lg border border-tingle-aqua/30 bg-tingle-aqua/10 px-4 py-3 font-mono text-xs text-tingle-aqua">
          ✦ Added: <span className="font-medium">{state.title}</span>
        </p>
      )}
    </div>
  );
}
