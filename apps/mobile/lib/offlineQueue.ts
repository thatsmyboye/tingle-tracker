import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TingleIntensity } from "@tingle/types";

// =============================================================================
// Offline queue — persists failed tingle_events to AsyncStorage.
// Flushed automatically on next successful Supabase write.
// =============================================================================

const QUEUE_KEY = "@tingle_tracker/offline_queue";

export interface QueuedTingleEvent {
  content_id: string;
  user_id: string;
  timestamp_ms: number;
  intensity: TingleIntensity;
  notes?: string;
  queued_at: number; // epoch ms — for ordering and age checks
}

export async function enqueueEvent(event: Omit<QueuedTingleEvent, "queued_at">): Promise<void> {
  try {
    const current = await readQueue();
    current.push({ ...event, queued_at: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(current));
  } catch {
    // AsyncStorage unavailable — silent fail, event is lost but app stays usable
  }
}

export async function readQueue(): Promise<QueuedTingleEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedTingleEvent[]) : [];
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}

/** Remove events older than maxAgeMs (default 7 days) to prevent unbounded growth */
export async function pruneQueue(maxAgeMs = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const queue = await readQueue();
  const cutoff = Date.now() - maxAgeMs;
  const fresh = queue.filter((e) => e.queued_at > cutoff);
  if (fresh.length !== queue.length) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(fresh));
  }
}
