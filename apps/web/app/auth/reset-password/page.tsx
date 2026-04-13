"use client";

// =============================================================================
// /auth/reset-password — Set a new password after clicking the reset link
//
// Supabase sends reset emails with links in the form:
//   https://yoursite.com/auth/reset-password?token_hash=xxx&type=recovery
//
// This page exchanges the token_hash for a session (verifyOtp), then lets the
// user set a new password (updateUser). Wrapped in Suspense because
// useSearchParams() requires it in Next.js 14 App Router.
// =============================================================================

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { PasswordField, ErrorMessage } from "@/components/AuthForms";

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="h-5 w-5 animate-spin rounded-full border border-tingle-aqua border-t-transparent" />
      <p className="font-mono text-sm text-surface-muted">Verifying link…</p>
    </div>
  );
}

function ResetPasswordHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const [status, setStatus] = useState<"verifying" | "ready" | "expired" | "success">(
    "verifying",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Exchange the token for a recovery session on mount
  useEffect(() => {
    if (type === "recovery" && tokenHash) {
      const supabase = getSupabaseBrowserClient();
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error: verifyError }) => {
          setStatus(verifyError ? "expired" : "ready");
        });
    } else {
      setStatus("expired");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setStatus("success");
      setTimeout(() => router.replace("/dashboard"), 1500);
    } finally {
      setLoading(false);
    }
  }

  if (status === "verifying") return <Spinner />;

  if (status === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="text-3xl text-red-400">⚠</span>
        <p className="font-mono text-sm text-white">Link expired or invalid</p>
        <p className="font-mono text-xs text-surface-muted">
          Password reset links expire after 1 hour.
        </p>
        <Link
          href="/auth/forgot-password"
          className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-4 py-2 font-mono text-xs text-tingle-aqua hover:bg-tingle-aqua/20"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="text-3xl text-tingle-aqua">✓</span>
        <p className="font-mono text-sm text-tingle-aqua">Password updated</p>
        <p className="font-mono text-xs text-surface-muted">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <PasswordField
        id="new-password"
        value={password}
        onChange={setPassword}
        disabled={loading}
        label="New password"
        hint="At least 8 characters"
        autoComplete="new-password"
      />
      <PasswordField
        id="confirm-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        disabled={loading}
        label="Confirm password"
        autoComplete="new-password"
      />

      {error && <ErrorMessage message={error} />}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 py-2.5",
          "font-mono text-sm text-tingle-aqua transition-colors",
          "hover:bg-tingle-aqua/20 focus:outline-none focus:ring-1 focus:ring-tingle-aqua",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-mono text-xs uppercase tracking-widest text-tingle-aqua">
            Tingle Tracker
          </Link>
          <h1 className="mt-3 font-serif text-2xl text-white">Set a new password</h1>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
          <Suspense fallback={<Spinner />}>
            <ResetPasswordHandler />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
