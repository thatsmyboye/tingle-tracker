"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerAdapterRef, TingleIntensity } from "@tingle/types";
import { getSupabaseBrowserClient } from "@tingle/database";
import {
  hasBannerBeenShown,
  markBannerShown,
  saveAnonUserId,
} from "@/lib/anonAuth";

// =============================================================================
// useTingleLogger — web
//
// When userId is null (unauthenticated):
//   1. On first log() call, signInAnonymously() is called to obtain a real UUID.
//   2. The anonymous user_id is saved to localStorage for later merge.
//   3. showAuthBanner becomes true (once per anonymous session).
//
// When userId is a real authenticated user_id:
//   • Anonymous session creation is skipped.
//   • showAuthBanner is always false.
// =============================================================================

const DEBOUNCE_MS = 500;
const OFFLINE_QUEUE_KEY = "tingle_offline_queue";

interface QueuedEvent {
  content_id: string;
  user_id: string;
  timestamp_ms: number;
  intensity: TingleIntensity;
  notes?: string;
}

function readQueue(): QueuedEvent[] {
  try {
    const raw = sessionStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedEvent[]): void {
  try {
    sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

async function flushQueue(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("tingle_events").insert(queue);
  if (!error) writeQueue([]);
}

// =============================================================================
// Hook
// =============================================================================

export interface UseTingleLoggerOptions {
  contentId: string;
  /** null when the visitor is not yet authenticated */
  userId: string | null;
  playerRef: React.RefObject<PlayerAdapterRef | null>;
  /** Called after each tingle is successfully persisted to the DB */
  onLog?: (timestampMs: number, intensity: TingleIntensity) => void;
}

export interface UseTingleLoggerReturn {
  log: (intensity?: TingleIntensity, notes?: string) => Promise<void>;
  pendingCount: number;
  lastLoggedMs: number | null;
  isDebouncing: boolean;
  /** True after the first anonymous tingle, until dismissed */
  showAuthBanner: boolean;
  dismissAuthBanner: () => void;
}

export function useTingleLogger({
  contentId,
  userId,
  playerRef,
  onLog,
}: UseTingleLoggerOptions): UseTingleLoggerReturn {
  // Effective user ID — starts as the prop, may be set to an anon UUID
  const effectiveUserIdRef = useRef<string | null>(userId);
  const lastEventTime = useRef<number>(0);
  // Keep onLog in a ref so the log useCallback doesn't need it as a dep
  const onLogRef = useRef(onLog);
  useEffect(() => { onLogRef.current = onLog; }, [onLog]);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastLoggedMs, setLastLoggedMs] = useState<number | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [showAuthBanner, setShowAuthBanner] = useState(false);

  // Keep effectiveUserIdRef in sync when a real user logs in
  if (userId !== null && effectiveUserIdRef.current !== userId) {
    effectiveUserIdRef.current = userId;
  }

  /** Ensure we have a user_id (real or anonymous) before writing to DB */
  async function resolveUserId(): Promise<string | null> {
    if (effectiveUserIdRef.current) return effectiveUserIdRef.current;

    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) return null;

    const anonId = data.user.id;
    effectiveUserIdRef.current = anonId;
    saveAnonUserId(anonId);

    // Show the banner only once per anonymous session
    if (!hasBannerBeenShown(anonId)) {
      setShowAuthBanner(true);
      markBannerShown(anonId);
    }

    return anonId;
  }

  const log = useCallback(
    async (intensity: TingleIntensity = "3", notes?: string) => {
      const now = Date.now();
      if (now - lastEventTime.current < DEBOUNCE_MS) {
        setIsDebouncing(true);
        setTimeout(() => setIsDebouncing(false), DEBOUNCE_MS);
        return;
      }
      lastEventTime.current = now;

      const resolvedId = await resolveUserId();
      if (!resolvedId) return; // anonymous sign-in failed — silent skip

      const timestampMs = playerRef.current
        ? await playerRef.current.getCurrentTimeMs()
        : 0;
      setLastLoggedMs(Math.round(timestampMs));

      const event: QueuedEvent = {
        content_id: contentId,
        user_id: resolvedId,
        timestamp_ms: Math.round(timestampMs),
        intensity,
        ...(notes ? { notes } : {}),
      };

      await flushQueue();

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("tingle_events").insert(event);
      if (error) {
        const queue = readQueue();
        queue.push(event);
        writeQueue(queue);
        setPendingCount(queue.length);
      } else {
        setPendingCount(0);
        onLogRef.current?.(Math.round(timestampMs), intensity);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentId, playerRef]
  );

  const dismissAuthBanner = useCallback(() => {
    setShowAuthBanner(false);
  }, []);

  return {
    log,
    pendingCount,
    lastLoggedMs,
    isDebouncing,
    showAuthBanner,
    dismissAuthBanner,
  };
}
