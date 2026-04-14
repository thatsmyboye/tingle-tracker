import { useCallback, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import type { PlayerAdapterRef, TingleIntensity } from "@tingle/types";
import { supabase } from "@/lib/supabase";
import {
  enqueueEvent,
  flushQueueWithRetry,
  readQueue,
} from "@/lib/offlineQueue";

// =============================================================================
// useTingleLogger — mobile
// Logs tingle events with 500ms debounce and AsyncStorage offline queue.
// Automatically flushes queued events when connectivity is restored.
// =============================================================================

const DEBOUNCE_MS = 500;

export interface UseTingleLoggerOptions {
  contentId: string;
  userId: string;
  playerRef: React.RefObject<PlayerAdapterRef | null>;
}

export interface UseTingleLoggerReturn {
  log: (intensity?: TingleIntensity, notes?: string) => Promise<void>;
  pendingCount: number;
  lastLoggedMs: number | null;
  isDebouncing: boolean;
}

export function useTingleLogger({
  contentId,
  userId,
  playerRef,
}: UseTingleLoggerOptions): UseTingleLoggerReturn {
  const lastEventTime = useRef<number>(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastLoggedMs, setLastLoggedMs] = useState<number | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Flush the offline queue when online, with exponential-backoff retries. */
  const flushQueue = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    await flushQueueWithRetry(async (events) => {
      const { error } = await supabase.from("tingle_events").insert(events);
      return !error;
    });

    const remaining = await readQueue();
    setPendingCount(remaining.length);
  }, []);

  const log = useCallback(
    async (intensity: TingleIntensity = "3", notes?: string) => {
      const now = Date.now();

      // Debounce guard
      if (now - lastEventTime.current < DEBOUNCE_MS) {
        setIsDebouncing(true);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(
          () => setIsDebouncing(false),
          DEBOUNCE_MS
        );
        return;
      }
      lastEventTime.current = now;

      // Get current playback position
      const timestampMs = playerRef.current
        ? await playerRef.current.getCurrentTimeMs()
        : 0;
      const roundedMs = Math.round(timestampMs);
      setLastLoggedMs(roundedMs);

      const event = {
        content_id: contentId,
        user_id: userId,
        timestamp_ms: roundedMs,
        intensity,
        ...(notes ? { notes } : {}),
      };

      // Try to flush queued events, then write current event
      await flushQueue();

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        await enqueueEvent(event);
        const queue = await readQueue();
        setPendingCount(queue.length);
        return;
      }

      const { error } = await supabase.from("tingle_events").insert(event);
      if (error) {
        await enqueueEvent(event);
        const queue = await readQueue();
        setPendingCount(queue.length);
      }
    },
    [contentId, userId, playerRef, flushQueue]
  );

  return { log, pendingCount, lastLoggedMs, isDebouncing };
}
