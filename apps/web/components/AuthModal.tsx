"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@tingle/ui";
import { useAuth } from "@/hooks/useAuth";
import { SignInForm, SignUpForm } from "@/components/AuthForms";

// =============================================================================
// AuthModal — email/password sign-in and sign-up overlay
//
// Two tabs: "Sign in" and "Create account".
// Form logic lives in AuthForms.tsx, shared with the dedicated /login and
// /signup pages.
//
// Props:
//   open          — controls visibility
//   onClose       — called when the modal should close
//   defaultTab    — which tab to open first (default "signin")
// =============================================================================

type Tab = "signin" | "signup";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}

export function AuthModal({ open, onClose, defaultTab = "signin" }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();

  // Reset to defaultTab whenever the modal opens
  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  // Handle Escape key
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={tab === "signin" ? "Sign in" : "Create account"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-xl border border-surface-border bg-surface-elevated shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <div className="flex gap-1">
            {(["signin", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
                  tab === t
                    ? "bg-tingle-aqua/10 text-tingle-aqua"
                    : "text-surface-muted hover:text-tingle-aqua/60",
                )}
              >
                {t === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 font-mono text-surface-muted transition-colors hover:text-tingle-aqua"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {tab === "signin" ? (
            <SignInForm
              onSuccess={onClose}
              onSwitchTab={() => setTab("signup")}
              signInWithEmail={signInWithEmail}
              signInWithGoogle={signInWithGoogle}
            />
          ) : (
            <SignUpForm
              onSuccess={onClose}
              onSwitchTab={() => setTab("signin")}
              signUpWithEmail={signUpWithEmail}
              signInWithGoogle={signInWithGoogle}
            />
          )}
        </div>
      </div>
    </div>
  );
}
