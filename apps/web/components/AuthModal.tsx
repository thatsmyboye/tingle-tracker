"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@tingle/ui";
import { useAuth } from "@/hooks/useAuth";

// =============================================================================
// AuthModal — email/password sign-in and sign-up
//
// Two tabs: "Sign in" and "Create account".
//
// Sign-up behaviour:
//   • If the visitor has an anonymous session, useAuth.signUpWithEmail() calls
//     updateUser() to upgrade that session in-place — same user_id, all tingles
//     preserved, no merge needed.
//   • Otherwise it calls signUp() and shows a "check your email" message when
//     the Supabase instance requires email confirmation.
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

  // Trap focus & handle Escape
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
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
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
                    : "text-surface-muted hover:text-tingle-aqua/60"
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

// =============================================================================
// Sign-in form
// =============================================================================

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchTab: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ message: string } | null>;
  signInWithGoogle: () => Promise<void>;
}

function SignInForm({ onSuccess, onSwitchTab, signInWithEmail, signInWithGoogle }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const err = await signInWithEmail(email.trim(), password);
      if (err) { setError(err.message); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <EmailField value={email} onChange={setEmail} disabled={loading} />
      <PasswordField value={password} onChange={setPassword} disabled={loading} label="Password" />

      {error && <ErrorMessage message={error} />}

      <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />

      <Divider />

      <GoogleButton onClick={signInWithGoogle} label="Sign in with Google" />

      <p className="text-center font-mono text-xs text-surface-muted">
        No account?{" "}
        <button
          type="button"
          onClick={onSwitchTab}
          className="text-tingle-aqua underline-offset-2 hover:underline"
        >
          Create one
        </button>
      </p>
    </form>
  );
}

// =============================================================================
// Sign-up form
// =============================================================================

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitchTab: () => void;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: { message: string } | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
}

function SignUpForm({ onSuccess, onSwitchTab, signUpWithEmail, signInWithGoogle }: SignUpFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <span className="text-2xl">✉️</span>
        <p className="font-mono text-sm text-tingle-aqua">Check your email</p>
        <p className="font-mono text-xs text-surface-muted">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
          Click it to activate your account.
        </p>
        <button
          onClick={onSuccess}
          className="mt-2 font-mono text-xs text-surface-muted underline-offset-2 hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error: err, needsConfirmation } = await signUpWithEmail(email.trim(), password);
      if (err) { setError(err.message); return; }
      if (needsConfirmation) { setConfirming(true); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <EmailField value={email} onChange={setEmail} disabled={loading} />
      <PasswordField
        value={password}
        onChange={setPassword}
        disabled={loading}
        label="Password"
        hint="At least 8 characters"
      />

      {error && <ErrorMessage message={error} />}

      <SubmitButton loading={loading} label="Create account" loadingLabel="Creating account…" />

      <Divider />

      <GoogleButton onClick={signInWithGoogle} label="Sign up with Google" />

      <p className="text-center font-mono text-xs text-surface-muted">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchTab}
          className="text-tingle-aqua underline-offset-2 hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

// =============================================================================
// Shared sub-components
// =============================================================================

function EmailField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="auth-email" className="font-mono text-xs uppercase tracking-widest text-surface-muted">
        Email
      </label>
      <input
        id="auth-email"
        type="email"
        autoComplete="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "rounded-lg border border-surface-border bg-surface px-3 py-2.5",
          "font-mono text-sm text-foreground placeholder:text-surface-muted",
          "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
          "disabled:opacity-50"
        )}
        placeholder="you@example.com"
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  disabled,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor="auth-password" className="font-mono text-xs uppercase tracking-widest text-surface-muted">
          {label}
        </label>
        {hint && <span className="font-mono text-[10px] text-surface-muted">{hint}</span>}
      </div>
      <input
        id="auth-password"
        type="password"
        autoComplete="current-password"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "rounded-lg border border-surface-border bg-surface px-3 py-2.5",
          "font-mono text-sm text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
          "disabled:opacity-50"
        )}
        placeholder="••••••••"
      />
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400">
      {message}
    </p>
  );
}

function SubmitButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={cn(
        "w-full rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 py-2.5",
        "font-mono text-sm text-tingle-aqua transition-colors",
        "hover:bg-tingle-aqua/20 focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
        "disabled:cursor-not-allowed disabled:opacity-40"
      )}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <hr className="flex-1 border-surface-border" />
      <span className="font-mono text-xs text-surface-muted">or</span>
      <hr className="flex-1 border-surface-border" />
    </div>
  );
}

function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg",
        "border border-surface-border bg-surface py-2.5",
        "font-mono text-sm text-foreground transition-colors",
        "hover:border-tingle-aqua/40 hover:bg-surface-elevated focus:outline-none focus:ring-1 focus:ring-tingle-aqua"
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {label}
    </button>
  );
}
