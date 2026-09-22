"use client";

// =============================================================================
// /signup — Dedicated sign-up page
//
// Redirects authenticated users to /profile.
// Uses the same SignUpForm shared with AuthModal.
// =============================================================================

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { SignUpForm } from "@/components/AuthForms";
import { DormantNotice } from "@/components/DormantNotice";
import { IS_DORMANT } from "@/lib/dormancy";

function SignUpContent() {
  const router = useRouter();
  const { user, isAnonymous, isLoading, signUpWithEmail, signInWithGoogle } = useAuth();

  // Redirect already-authenticated real users
  useEffect(() => {
    if (!isLoading && user && !isAnonymous) {
      router.replace("/profile");
    }
  }, [user, isAnonymous, isLoading, router]);

  function handleSuccess() {
    router.replace("/profile");
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
        <h1 className="mt-3 font-serif text-2xl text-white">Create your account</h1>
        <p className="mt-1 font-mono text-xs text-surface-muted">
          Track your tingles, discover your triggers
        </p>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-elevated p-6">
        <SignUpForm
          onSuccess={handleSuccess}
          signUpWithEmail={signUpWithEmail}
          signInWithGoogle={signInWithGoogle}
        />

        <p className="mt-5 text-center font-mono text-xs text-surface-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-tingle-aqua underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  // Signups are frozen while the app is dormant. Existing accounts can still
  // sign in at /login — only the creation of new ones is switched off, so the
  // user table and the Supabase free-tier quota stay put while nobody is
  // watching the app.
  if (IS_DORMANT) {
    return (
      <DormantNotice
        title="Sign-ups are paused"
        detail="Tingle Tracker is dormant, so new accounts aren't being created right now. Existing accounts can still sign in."
      />
    );
  }

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
        <SignUpContent />
      </Suspense>
    </main>
  );
}
