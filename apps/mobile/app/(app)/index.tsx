import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuthContext } from "@/context/AuthContext";

// =============================================================================
// Home screen — YouTube URL input
//
// Listener pastes any YouTube URL and navigates to the player screen where
// they can watch the video and log tingles. The URL is resolved to a
// content row via the Next.js /api/content/resolve endpoint (which creates
// the row if it doesn't already exist).
// =============================================================================

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(
  /\/$/,
  ""
);

/** Client-side video ID extraction — mirrors the server-side logic in lib/youtube.ts */
function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export default function HomeScreen() {
  const { user, signOut } = useAuthContext();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleResolve() {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!extractVideoId(trimmed)) {
      Alert.alert(
        "Invalid URL",
        "Please paste a valid YouTube video URL or video ID."
      );
      return;
    }

    if (!API_BASE_URL) {
      Alert.alert("Config error", "EXPO_PUBLIC_API_BASE_URL is not set.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/content/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: trimmed }),
      });

      const data = (await res.json()) as {
        contentId?: string;
        error?: string;
      };

      if (!res.ok || !data.contentId) {
        Alert.alert("Error", data.error ?? "Could not load that video.");
        return;
      }

      router.push(`/(app)/player/${data.contentId}`);
    } catch {
      Alert.alert("Network error", "Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = !!url.trim() && !isLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>✦</Text>
      <Text style={styles.title}>Tingle Tracker</Text>
      <Text style={styles.subtitle}>Paste any ASMR video to start</Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="youtube.com/watch?v=..."
          placeholderTextColor="#3A3A56"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleResolve}
          editable={!isLoading}
        />
      </View>

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleResolve}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <ActivityIndicator color="#7FFFD4" size="small" />
        ) : (
          <Text style={styles.buttonText}>Start listening →</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        {user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}
        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0F",
    paddingHorizontal: 24,
    gap: 12,
  },
  logo: {
    fontSize: 32,
    color: "#7FFFD4",
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#E8E8F0",
    fontFamily: "monospace",
  },
  subtitle: {
    fontSize: 13,
    color: "#3A3A56",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  inputWrapper: {
    width: "100%",
    maxWidth: 400,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 10,
    backgroundColor: "#12121A",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#E8E8F0",
    fontSize: 13,
    fontFamily: "monospace",
  },
  button: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "rgba(127,255,212,0.5)",
    borderRadius: 10,
    backgroundColor: "rgba(127,255,212,0.1)",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#7FFFD4",
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  footer: {
    marginTop: 24,
    alignItems: "center",
    gap: 8,
  },
  email: {
    fontSize: 11,
    color: "#3A3A56",
    fontFamily: "monospace",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  signOutText: {
    fontSize: 12,
    color: "#3A3A56",
    fontFamily: "monospace",
  },
});
