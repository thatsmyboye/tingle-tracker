"use client";

// =============================================================================
// /auth/forgot-password — Request a password reset email
// =============================================================================

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { getSupabaseBrowserClient } from "@tingle/database";
import { EmailField, ErrorMessage } from "@/components/AuthForms";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // Supabase will send an email with a link pointing to this URL +
        // ?token_hash=...&type=recovery. The reset-password page handles
        // the token exchange directly.
        redirectTo: `${siteUrl}/auth/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="font-mono text-xs uppercase tracking-widest text-tingle-aqua">
            Tingle Tracker
          </Link>
          <h1 className="mt-3 font-serif text-2xl text-white">Reset your password</h1>
          <p className="mt-1 font-mono text-xs text-surface-muted">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <span className="text-3xl">✉️</span>
              <p className="font-mono text-sm text-tingle-aqua">Check your email</p>
              <p className="font-mono text-xs text-surface-muted">
                We sent a password reset link to{" "}
                <strong className="text-foreground">{email}</strong>.
              </p>
              <Link
                href="/login"
                className="mt-2 font-mono text-xs text-surface-muted underline-offset-2 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <EmailField value={email} onChange={setEmail} disabled={loading} />

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
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <p className="text-center font-mono text-xs text-surface-muted">
                <Link
                  href="/login"
                  className="text-tingle-aqua underline-offset-2 hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
