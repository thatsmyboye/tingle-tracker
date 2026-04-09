"use client";

// =============================================================================
// /auth/callback — OAuth PKCE code exchange
//
// Supabase redirects here after Google OAuth with ?code=<pkce-code>.
// This page runs client-side and calls exchangeCodeForSession() using the
// browser Supabase client, which stores the resulting session in localStorage.
//
// An optional ?next=<path> param controls where to redirect after sign-in.
// Implicit-flow sign-ins (tokens in URL hash) are handled automatically by
// the Supabase client; we just redirect to the destination once the session
// is confirmed.
// =============================================================================

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@tingle/database";

export default function AuthCallbackPage() {
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
      // Just verify a session exists and redirect accordingly.
      supabase.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? next : "/");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3">
        <span className="w-5 h-5 rounded-full border border-tingle-aqua border-t-transparent animate-spin" />
        <p className="font-mono text-sm text-surface-muted">Completing sign-in…</p>
      </div>
    </main>
  );
}
