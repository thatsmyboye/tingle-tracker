import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PlayerAdapterRef, TingleIntensity } from "@tingle/types";
import { IntensityPicker } from "./IntensityPicker";
import { useTingleLogger } from "@/hooks/useTingleLogger";

// =============================================================================
// TingleLogger — mobile (primary tingle-logging surface)
//
// Usage:
//   <TingleLogger contentId="..." userId="..." playerRef={playerRef} />
//
// UX:
//   • Single tap  → log at current timestamp, default intensity (3)
//   • Long press  → open IntensityPicker, log at selected intensity
//   • Debounced   → 500ms minimum between events
//   • Offline     → queued to AsyncStorage, flushed on next write
// =============================================================================

const LONG_PRESS_DELAY = 300; // ms

interface TingleLoggerProps {
  contentId: string;
  userId: string;
  playerRef: React.RefObject<PlayerAdapterRef | null>;
}

export function TingleLogger({ contentId, userId, playerRef }: TingleLoggerProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const { log, pendingCount, lastLoggedMs, isDebouncing } = useTingleLogger({
    contentId,
    userId,
    playerRef,
  });

  function animatePulse() {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.18, useNativeDriver: true, speed: 40, bounciness: 6 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }),
    ]).start();
  }

  async function handlePress() {
    if (isDebouncing) return;
    animatePulse();
    await log("3");
  }

  async function handleIntensitySelect(intensity: TingleIntensity) {
    setPickerVisible(false);
    animatePulse();
    await log(intensity);
  }

  return (
    <>
      <View style={styles.container}>
        {/* Main tap target */}
        <Pressable
          onPress={handlePress}
          onLongPress={() => !isDebouncing && setPickerVisible(true)}
          delayLongPress={LONG_PRESS_DELAY}
          disabled={isDebouncing}
          accessibilityRole="button"
          accessibilityLabel="Log tingle — tap or hold to set intensity"
          style={styles.pressable}
        >
          <Animated.View
            style={[
              styles.tapButton,
              { transform: [{ scale: scaleAnim }] },
              isDebouncing && styles.tapButtonDebouncing,
            ]}
          >
            <Text style={styles.tapIcon}>✦</Text>
          </Animated.View>
        </Pressable>

        {/* Status */}
        <View style={styles.statusRow}>
          {isDebouncing ? (
            <Text style={[styles.statusText, styles.statusWait]}>wait…</Text>
          ) : pendingCount > 0 ? (
            <Text style={[styles.statusText, styles.statusOffline]}>
              {pendingCount} queued offline
            </Text>
          ) : lastLoggedMs !== null ? (
            <Text style={styles.statusText}>
              ✦ {formatMs(lastLoggedMs)}
            </Text>
          ) : (
            <Text style={styles.statusHint}>tap · hold to set intensity</Text>
          )}
        </View>
      </View>

      <IntensityPicker
        visible={pickerVisible}
        onSelect={handleIntensitySelect}
        onDismiss={() => setPickerVisible(false)}
      />
    </>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
  },
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  tapButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(127,255,212,0.1)",
    borderWidth: 2,
    borderColor: "rgba(127,255,212,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  tapButtonDebouncing: {
    opacity: 0.4,
  },
  tapIcon: {
    fontSize: 32,
    color: "#7FFFD4",
  },
  statusRow: {
    minHeight: 18,
  },
  statusText: {
    color: "#7FFFD4",
    fontSize: 12,
    fontFamily: "monospace",
    textAlign: "center",
  },
  statusWait: {
    color: "#FFD580",
  },
  statusOffline: {
    color: "#FFD580",
  },
  statusHint: {
    color: "#3A3A56",
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "center",
  },
});
