"use client";

import { useRef, useState } from "react";
import type { PlayerAdapterRef, TingleIntensity } from "@tingle/types";
import { cn } from "@tingle/ui";
import { useTingleLogger } from "@/hooks/useTingleLogger";
import { useAuth } from "@/hooks/useAuth";
import { GuestBanner } from "./GuestBanner";
import { AuthModal } from "./AuthModal";

// =============================================================================
// TingleLogger — web
//
// Renders a tap button alongside a video player.
// When userId is null (unauthenticated):
//   • First tap creates an anonymous Supabase session (tingle saved immediately).
//   • GuestBanner appears once with Google, Sign in, and Create account options.
//   • AuthModal handles email/password sign-in and sign-up.
//   • On sign-in, anonymous tingles are merged into the real account.
// =============================================================================

type AuthModalTab = "signin" | "signup";

interface TingleLoggerProps {
  contentId: string;
  /** null for unauthenticated visitors */
  userId: string | null;
  playerRef: React.RefObject<PlayerAdapterRef | null>;
  className?: string;
}

const INTENSITIES: TingleIntensity[] = ["1", "2", "3", "4", "5"];

const INTENSITY_LABELS: Record<TingleIntensity, string> = {
  "1": "Mild",
  "2": "Light",
  "3": "Medium",
  "4": "Strong",
  "5": "Intense",
};

export function TingleLogger({
  contentId,
  userId,
  playerRef,
  className,
}: TingleLoggerProps) {
  const [intensity, setIntensity] = useState<TingleIntensity>("3");
  const [showPulse, setShowPulse] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>("signin");
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { log, pendingCount, isDebouncing, showAuthBanner, dismissAuthBanner } =
    useTingleLogger({ contentId, userId, playerRef });

  const { signInWithGoogle } = useAuth();

  function openModal(tab: AuthModalTab) {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }

  async function handleTap() {
    if (isDebouncing) return;
    await log(intensity);

    setShowPulse(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setShowPulse(false), 400);
  }

  return (
    <>
      <div className={cn("flex flex-col items-center gap-3", className)}>
        {/* Guest banner — shown once after first anonymous tingle */}
        {showAuthBanner && (
          <GuestBanner
            onSignInWithGoogle={signInWithGoogle}
            onSignInWithEmail={() => openModal("signin")}
            onCreateAccount={() => openModal("signup")}
            onDismiss={dismissAuthBanner}
            className="w-full max-w-sm"
          />
        )}

        {/* Tap button */}
        <button
          onClick={handleTap}
          disabled={isDebouncing}
          aria-label="Log tingle"
          className={cn(
            "relative flex h-20 w-20 items-center justify-center rounded-full",
            "border-2 border-tingle-aqua/40 bg-tingle-aqua/10",
            "font-mono text-3xl text-tingle-aqua transition-all duration-150",
            "hover:bg-tingle-aqua/20 focus:outline-none focus:ring-2 focus:ring-tingle-aqua focus:ring-offset-2 focus:ring-offset-surface",
            "active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
            showPulse && "scale-110 bg-tingle-aqua/30"
          )}
        >
          ✦
          {showPulse && (
            <span className="absolute inset-0 animate-ping rounded-full border border-tingle-aqua/40" />
          )}
        </button>

        {/* Intensity strip */}
        <div className="flex gap-1" role="radiogroup" aria-label="Intensity">
          {INTENSITIES.map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={intensity === i}
              aria-label={`Intensity ${INTENSITY_LABELS[i]}`}
              onClick={() => setIntensity(i)}
              className={cn(
                "h-7 w-7 rounded-md border font-mono text-xs transition-all",
                intensity === i
                  ? "border-tingle-aqua bg-tingle-aqua/20 text-tingle-aqua"
                  : "border-surface-border bg-surface-elevated text-surface-muted hover:border-tingle-aqua/40 hover:text-tingle-aqua/60"
              )}
            >
              {i}
            </button>
          ))}
        </div>

        {/* Status line */}
        <div className="font-mono text-xs text-surface-muted">
          {isDebouncing ? (
            <span className="text-tingle-gold/70">wait…</span>
          ) : pendingCount > 0 ? (
            <span className="text-tingle-gold/70">{pendingCount} pending (offline)</span>
          ) : userId === null ? (
            <span className="text-surface-muted/60">guest mode · tap to log</span>
          ) : (
            <span>tap to log · intensity {intensity}</span>
          )}
        </div>
      </div>

      {/* Auth modal — rendered outside the flex column so it overlays the whole page */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </>
  );
}
