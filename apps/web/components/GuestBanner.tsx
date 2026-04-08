"use client";

import { cn } from "@tingle/ui";

// =============================================================================
// GuestBanner
//
// Non-blocking banner shown after an unauthenticated user logs their first
// tingle. Appears once per anonymous session. Does not interrupt playback.
// =============================================================================

interface GuestBannerProps {
  onSignInWithGoogle: () => void;
  /** Opens the AuthModal pre-set to the sign-in tab */
  onSignInWithEmail: () => void;
  /** Opens the AuthModal pre-set to the sign-up tab */
  onCreateAccount: () => void;
  onDismiss: () => void;
  className?: string;
}

export function GuestBanner({
  onSignInWithGoogle,
  onSignInWithEmail,
  onCreateAccount,
  onDismiss,
  className,
}: GuestBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg",
        "border border-tingle-aqua/20 bg-tingle-aqua/5 px-4 py-3",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p className="font-mono text-xs text-tingle-aqua">
            ✦ Tingle logged — you&apos;re in guest mode
          </p>
          <p className="mt-0.5 font-mono text-xs text-surface-muted">
            Sign in to save your history and build your trigger profile.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Google */}
          <button
            onClick={onSignInWithGoogle}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-tingle-aqua/30",
              "bg-tingle-aqua/10 px-3 py-1.5 font-mono text-xs text-tingle-aqua",
              "transition-colors hover:bg-tingle-aqua/20 focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
            )}
          >
            <GoogleIcon />
            Google
          </button>

          {/* Email sign-in */}
          <button
            onClick={onSignInWithEmail}
            className={cn(
              "rounded-md border border-surface-border px-3 py-1.5",
              "font-mono text-xs text-surface-muted transition-colors",
              "hover:border-tingle-aqua/30 hover:text-tingle-aqua/70 focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
            )}
          >
            Sign in
          </button>

          {/* Email sign-up */}
          <button
            onClick={onCreateAccount}
            className={cn(
              "rounded-md border border-surface-border px-3 py-1.5",
              "font-mono text-xs text-surface-muted transition-colors",
              "hover:border-tingle-aqua/30 hover:text-tingle-aqua/70 focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
            )}
          >
            Create account
          </button>
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss guest banner"
        className={cn(
          "shrink-0 rounded p-1 font-mono text-xs text-surface-muted",
          "transition-colors hover:text-tingle-aqua focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
        )}
      >
        ×
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
