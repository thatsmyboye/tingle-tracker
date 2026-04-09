"use client";

// =============================================================================
// /auth/callback — OAuth PKCE code exchange
//
// useSearchParams() must be inside a Suspense boundary in Next.js 14 App
// Router, otherwise the page fails static prerendering. The actual logic lives
// in CallbackHandler; AuthCallbackPage is the thin shell that provides the
// boundary and the loading UI.
// =============================================================================

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@tingle/database";

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="w-5 h-5 rounded-full border border-tingle-aqua border-t-transparent animate-spin" />
      <p className="font-mono text-sm text-surface-muted">Completing sign-in…</p>
    </div>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const supabase = getSupabaseBrowserClient();

    if (code) {
      // PKCE flow: exchange the authorization code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        router.replace(error ? "/" : next);
      });
    } else {
      // Implicit flow: Supabase automatically detects tokens in the URL hash.
      supabase.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? next : "/");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner />;
}

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <Suspense fallback={<Spinner />}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
