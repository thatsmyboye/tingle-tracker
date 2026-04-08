import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TingleIntensity } from "@tingle/types";

// =============================================================================
// IntensityPicker — mobile
// Modal triggered by long press on the TingleLogger tap button.
// Presents a 1–5 scale and immediately logs on selection.
// =============================================================================

const LEVELS: Array<{ value: TingleIntensity; label: string; hint: string }> = [
  { value: "1", label: "1", hint: "Mild tingle" },
  { value: "2", label: "2", hint: "Light tingle" },
  { value: "3", label: "3", hint: "Medium tingle" },
  { value: "4", label: "4", hint: "Strong tingle" },
  { value: "5", label: "5", hint: "Intense tingle" },
];

interface IntensityPickerProps {
  visible: boolean;
  onSelect: (intensity: TingleIntensity) => void;
  onDismiss: () => void;
}

export function IntensityPicker({
  visible,
  onSelect,
  onDismiss,
}: IntensityPickerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Sheet — stop propagation so taps inside don't dismiss */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>How strong?</Text>

          <View style={styles.levels}>
            {LEVELS.map((level) => (
              <Pressable
                key={level.value}
                style={({ pressed }) => [
                  styles.levelBtn,
                  pressed && styles.levelBtnPressed,
                ]}
                onPress={() => onSelect(level.value)}
                accessibilityRole="button"
                accessibilityLabel={`${level.hint}`}
              >
                <Text style={styles.levelNumber}>{level.label}</Text>
                <Text style={styles.levelHint}>{level.hint}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onDismiss} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0D0D18",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: "#1E1E2E",
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    color: "#E8E8F0",
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 20,
    opacity: 0.5,
  },
  levels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 20,
  },
  levelBtn: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#7FFFD430",
    backgroundColor: "#7FFFD410",
  },
  levelBtnPressed: {
    backgroundColor: "#7FFFD430",
  },
  levelNumber: {
    color: "#7FFFD4",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  levelHint: {
    color: "#3A3A56",
    fontSize: 9,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    color: "#3A3A56",
    fontSize: 13,
    fontFamily: "monospace",
  },
});
