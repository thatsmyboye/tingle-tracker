"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@tingle/database";
import {
  clearBannerFlag,
  clearStoredAnonUserId,
  getStoredAnonUserId,
} from "@/lib/anonAuth";

// =============================================================================
// useAuth — web
//
// Subscribes to Supabase auth state changes and automatically triggers the
// anonymous → real account merge when a previously anonymous user signs in.
//
// Usage:
//   const { user, isAnonymous, signInWithGoogle, signOut } = useAuth();
// =============================================================================

export interface UseAuthReturn {
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  // ---- Merge anonymous session into real account ---------------------------

  const mergeAnonymousSession = useCallback(
    async (realUser: User) => {
      const anonUserId = getStoredAnonUserId();
      if (!anonUserId || anonUserId === realUser.id) return;

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;

        await fetch("/api/auth/merge-anonymous", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ anonUserId }),
        });
      } catch {
        // Best-effort — don't block sign-in if merge fails
      } finally {
        clearBannerFlag(anonUserId);
        clearStoredAnonUserId();
      }
    },
    [supabase]
  );

  // ---- Auth state subscription ---------------------------------------------

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;

        setUser((prevUser) => {
          // Detect transition from anonymous to authenticated real account
          const wasAnonymous = (prevUser as (User & { is_anonymous?: boolean }) | null)?.is_anonymous === true;
          const isNowReal = nextUser && !(nextUser as User & { is_anonymous?: boolean }).is_anonymous;

          if (wasAnonymous && isNowReal) {
            mergeAnonymousSession(nextUser);
          }

          return nextUser;
        });

        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase, mergeAnonymousSession]);

  // ---- Actions -------------------------------------------------------------

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.href : undefined,
      },
    });
  }, [supabase]);

  const signOut = useCallback(async () => {
    clearStoredAnonUserId();
    await supabase.auth.signOut();
  }, [supabase]);

  const isAnonymous =
    !!user && !!(user as User & { is_anonymous?: boolean }).is_anonymous;

  return { user, isAnonymous, isLoading, signInWithGoogle, signOut };
}
