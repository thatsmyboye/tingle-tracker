"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

// =============================================================================
// HomeNav — auth-aware nav links for the homepage
//
// Unauthenticated / anonymous:  "Log in"  +  "Sign up"
// Loading:                      invisible placeholder to prevent layout shift
// Authenticated:                "Log Tingles" (→ /listen)  +  "Profile" (→ /profile)
// =============================================================================

export function HomeNav() {
  const { user, isAnonymous, isLoading, signOut } = useAuth();
  const isAuthenticated = !!user && !isAnonymous;

  if (isLoading) {
    // Invisible placeholder with the same approximate width as the real links
    // so the rest of the nav doesn't shift when auth resolves.
    return (
      <div className="flex items-center gap-5" aria-hidden="true">
        <span className="text-xs text-transparent select-none pointer-events-none">
          Log in
        </span>
        <span className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-transparent select-none pointer-events-none">
          Sign up
        </span>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-5">
        <Link
          href="/listen"
          className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
        >
          Log Tingles
        </Link>
        <Link
          href="/profile"
          className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-3 py-1.5 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
        >
          Profile
        </Link>
        <button
          onClick={() => {
            void signOut();
          }}
          className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <Link
        href="/login"
        className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
      >
        Log in
      </Link>
      <Link
        href="/signup"
        className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-3 py-1.5 text-xs text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
      >
        Sign up
      </Link>
    </div>
  );
}
