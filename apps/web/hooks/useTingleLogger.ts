"use client";

import { useCallback, useRef, useState } from "react";
import type { PlayerAdapterRef, TingleIntensity } from "@tingle/types";
import { getSupabaseBrowserClient } from "@tingle/database";

// =============================================================================
// useTingleLogger — web
// Handles tingle event creation with debounce and sessionStorage offline queue.
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
    // sessionStorage unavailable — silent fail
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

  const log = useCallback(
    async (intensity: TingleIntensity = "3", notes?: string) => {
      const now = Date.now();
      if (now - lastEventTime.current < DEBOUNCE_MS) {
        setIsDebouncing(true);
        setTimeout(() => setIsDebouncing(false), DEBOUNCE_MS);
        return;
      }
      lastEventTime.current = now;

      const timestampMs = playerRef.current
        ? await playerRef.current.getCurrentTimeMs()
        : 0;

      setLastLoggedMs(Math.round(timestampMs));

      const event: QueuedEvent = {
        content_id: contentId,
        user_id: userId,
        timestamp_ms: Math.round(timestampMs),
        intensity,
        ...(notes ? { notes } : {}),
      };

      // Try flushing any previously queued events first, then write current one
      await flushQueue();

      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("tingle_events").insert(event);

      if (error) {
        // Save to offline queue
        const queue = readQueue();
        queue.push(event);
        writeQueue(queue);
        setPendingCount(queue.length);
      } else {
        setPendingCount(0);
      }
    },
    [contentId, userId, playerRef]
  );

  return { log, pendingCount, lastLoggedMs, isDebouncing };
}
