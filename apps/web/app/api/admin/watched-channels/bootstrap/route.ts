import { NextResponse } from "next/server";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";
import { resolveYouTubeChannelMetadata } from "@/lib/youtube";
import { DIVERSITY_FIRST_STARTER_CHANNELS } from "@/lib/admin/watchedChannelsStarter";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

type BootstrapResult = {
  label: string;
  status: "upserted" | "failed";
  youtube_channel_id?: string;
  channel_title?: string | null;
  error?: string;
};

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const results: BootstrapResult[] = [];

  for (const starter of DIVERSITY_FIRST_STARTER_CHANNELS) {
    try {
      const channelMeta = await resolveYouTubeChannelMetadata(starter.channelUrl);
      const { data, error } = await admin.serviceClient
        .from("watched_channels")
        .upsert(
          {
            youtube_channel_id: channelMeta.channelId,
            channel_title: channelMeta.title,
            uploads_playlist_id: channelMeta.uploadsPlaylistId,
            latest_video_count: starter.latestVideoCount,
            is_active: true,
          },
          { onConflict: "youtube_channel_id" }
        )
        .select("youtube_channel_id, channel_title")
        .single();

      if (error || !data) {
        results.push({
          label: starter.label,
          status: "failed",
          error: error?.message ?? "Unknown insert error",
        });
        continue;
      }

      results.push({
        label: starter.label,
        status: "upserted",
        youtube_channel_id: data.youtube_channel_id,
        channel_title: data.channel_title,
      });
    } catch (err) {
      results.push({
        label: starter.label,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ mode: "diversity-first", results });
}
