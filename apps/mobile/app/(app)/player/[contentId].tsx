import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import type { Content } from "@tingle/types";
import { useAuthContext } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { YouTubePlayerView, type YouTubePlayerViewRef } from "@/components/YouTubePlayerView";
import { TingleLogger } from "@/components/TingleLogger";
import { TingleHeatmap } from "@/components/TingleHeatmap";

// =============================================================================
// Player screen — /player/[contentId]
//
// Fetches content metadata by contentId, embeds the YouTube video via
// YouTubePlayerView, and mounts TingleLogger so every tap is persisted.
//
// All mobile users are authenticated (the auth guard in AuthContext.tsx
// redirects unauthenticated users to the login screen), so the full tingle
// history is available and the heatmap is always accessible.
//
// Note: A mobile HeatmapChart visualisation is planned for a future iteration.
// For now this screen shows a running session tingle count.
// =============================================================================

type ContentRow = Pick<
  Content,
  "id" | "youtube_video_id" | "title" | "channel_title" | "duration_seconds"
> & { creators: { display_name: string } | null };

export default function PlayerScreen() {
  const { contentId } = useLocalSearchParams<{ contentId: string }>();
  const { user } = useAuthContext();
  const navigation = useNavigation();

  const playerRef = useRef<YouTubePlayerViewRef | null>(null);

  const [content, setContent] = useState<ContentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Load content metadata ------------------------------------------------

  useEffect(() => {
    if (!contentId) return;

    supabase
      .from("content")
      .select(
        "id, youtube_video_id, title, channel_title, duration_seconds, creators(display_name)"
      )
      .eq("id", contentId)
      .eq("status", "ready")
      .single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase types not generated for mobile
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError(err?.message ?? "Video not found.");
        } else {
          setContent(data as ContentRow);
          navigation.setOptions({ title: data.title ?? "Player" });
        }
        setLoading(false);
      });
  }, [contentId, navigation]);

  // ---- Loading / error -------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7FFFD4" />
      </View>
    );
  }

  if (error || !content || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Something went wrong."}</Text>
      </View>
    );
  }

  const creatorName =
    content.creators?.display_name ?? content.channel_title ?? "Unknown";

  // ---- Render ---------------------------------------------------------------

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Video info */}
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {content.title}
        </Text>
        <Text style={styles.creatorName}>{creatorName}</Text>
      </View>

      {/* Player */}
      <YouTubePlayerView
        ref={playerRef}
        videoId={content.youtube_video_id}
      />

      {/* Logger */}
      <View style={styles.loggerSection}>
        <Text style={styles.sectionLabel}>Log a Tingle</Text>
        <TingleLogger
          contentId={content.id}
          userId={user.id}
          playerRef={playerRef}
        />
      </View>

      {/* Heatmap */}
      <View style={styles.heatmapSection}>
        <Text style={styles.sectionLabel}>Tingle Heatmap</Text>
        <TingleHeatmap
          contentId={content.id}
          userId={user.id}
          durationSeconds={content.duration_seconds}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  content: {
    paddingBottom: 40,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0A0F",
  },
  errorText: {
    color: "#F87171",
    fontFamily: "monospace",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  videoInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 4,
  },
  videoTitle: {
    color: "#E8E8F0",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 22,
  },
  creatorName: {
    color: "#3A3A56",
    fontSize: 12,
    fontFamily: "monospace",
  },
  loggerSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 12,
    marginHorizontal: 16,
    backgroundColor: "#0D0D16",
    gap: 16,
    alignItems: "center",
  },
  sectionLabel: {
    color: "#3A3A56",
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 2,
    alignSelf: "flex-start",
  },
  heatmapSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: "#1E1E2E",
    borderRadius: 12,
    marginHorizontal: 16,
    backgroundColor: "#0D0D16",
    gap: 12,
  },
});
