"use client";

// =============================================================================
// /login — Dedicated sign-in page
//
// Redirects authenticated users to /dashboard (or ?next= param).
// Uses the same SignInForm shared with AuthModal.
// =============================================================================

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { SignInForm } from "@/components/AuthForms";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { user, isAnonymous, isLoading, signInWithEmail, signInWithGoogle } = useAuth();

  // Redirect already-authenticated users (middleware handles this too, but
  // this avoids a flash of the login form on the client)
  useEffect(() => {
    if (!isLoading && user && !isAnonymous) {
      router.replace(next);
    }
  }, [user, isAnonymous, isLoading, router, next]);

  function handleSuccess() {
    router.replace(next);
  }

  if (isLoading || (user && !isAnonymous)) {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border border-tingle-aqua border-t-transparent" />
        <p className="font-mono text-sm text-surface-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-tingle-aqua">
          Tingle Tracker
        </Link>
        <h1 className="mt-3 font-serif text-2xl text-white">Welcome back</h1>
        <p className="mt-1 font-mono text-xs text-surface-muted">Sign in to your account</p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
        <SignInForm
          onSuccess={handleSuccess}
          signInWithEmail={signInWithEmail}
          signInWithGoogle={signInWithGoogle}
          showForgotPassword
        />

        <p className="mt-5 text-center font-mono text-xs text-surface-muted">
          No account?{" "}
          <Link
            href="/signup"
            className="text-tingle-aqua underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border border-tingle-aqua border-t-transparent" />
            <p className="font-mono text-sm text-surface-muted">Loading…</p>
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </main>
  );
}
