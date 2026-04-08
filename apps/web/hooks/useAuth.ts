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
// Email sign-up detects an anonymous session and uses updateUser() to upgrade
// the account in-place (same user_id) rather than signUp() which would create
// a separate account and orphan the anonymous tingles.
// =============================================================================

export interface AuthError {
  message: string;
}

export interface UseAuthReturn {
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

// ---- Internal helper --------------------------------------------------------

type AnonUser = User & { is_anonymous?: boolean };

function isAnonymousUser(u: User | null): u is AnonUser {
  return !!u && !!(u as AnonUser).is_anonymous;
}

// =============================================================================
// Hook
// =============================================================================

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;

        setUser((prevUser) => {
          const wasAnonymous = isAnonymousUser(prevUser);
          const isNowReal = nextUser && !isAnonymousUser(nextUser);

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

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // onAuthStateChange handles the anonymous → real merge automatically
      return error ? { message: error.message } : null;
    },
    [supabase]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null; needsConfirmation: boolean }> => {
      // If the current session is anonymous, upgrade it in-place so the
      // anonymous user_id — and all tingle_events under it — are preserved.
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user ?? null;

      if (isAnonymousUser(currentUser)) {
        // Upgrade anonymous account: user_id stays the same, no merge needed
        const { error } = await supabase.auth.updateUser({ email, password });
        if (error) return { error: { message: error.message }, needsConfirmation: false };
        // updateUser sends a confirmation email if the instance requires it;
        // the anonymous session remains active in the meantime.
        return { error: null, needsConfirmation: false };
      }

      // Normal sign-up (no prior anonymous session)
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: { message: error.message }, needsConfirmation: false };

      // data.session is null when email confirmation is required
      const needsConfirmation = !!data.user && !data.session;
      return { error: null, needsConfirmation };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    clearStoredAnonUserId();
    await supabase.auth.signOut();
  }, [supabase]);

  const isAnonymous = isAnonymousUser(user);

  return {
    user,
    isAnonymous,
    isLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
