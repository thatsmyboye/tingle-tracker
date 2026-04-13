"use client";

// =============================================================================
// Global error boundary — catches unhandled errors in the app shell
// Must be a Client Component (required by Next.js for error boundaries)
// =============================================================================

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service (e.g. Sentry) when added
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface font-mono px-4">
      <span className="text-4xl text-red-400">⚠</span>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">Error</p>
        <h1 className="font-serif text-3xl text-white mb-3">Something went wrong</h1>
        <p className="text-sm text-surface-muted max-w-sm">
          An unexpected error occurred. Please try refreshing the page.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-5 py-2.5 text-sm text-tingle-aqua hover:bg-tingle-aqua/20"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-surface-border bg-surface-elevated px-5 py-2.5 text-sm text-white hover:border-tingle-aqua/30"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
