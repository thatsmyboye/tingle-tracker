import { inngest } from "@/inngest/client";
import { getSupabaseServerClient } from "@tingle/database";
import { fetchLatestVideosForChannel, fetchYouTubeMetadata } from "@/lib/youtube";

// =============================================================================
// catalog.refresh
//
// Runs on a weekly schedule (Monday 03:00 UTC) and whenever a
// "catalog/refresh.requested" event is fired (admin "Refresh now" button).
//
// For each active watched_channel:
//   1. Fetch latest N video IDs via YouTube playlist API
//   2. Skip any video IDs already in the content table
//   3. Insert new content rows (status: "pending", creator_id: null)
//   4. Fire "content/ingested" for each new video so content.process +
//      audio.analyze run the full LLM pipeline
//   5. Update watched_channels.last_refreshed_at
// =============================================================================

export const catalogRefresh = inngest.createFunction(
  {
    id: "catalog.refresh",
    name: "Catalog Refresh: Ingest New Videos from Watched Channels",
    triggers: [
      { cron: "0 3 * * 1" },
      { event: "catalog/refresh.requested" },
    ],
    concurrency: { limit: 3 },
  },
  async ({ step }) => {
    const db = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- watched_channels not yet in generated types
    const anyDb = db as any;

    // ---- 1. Fetch active watched channels ------------------------------------
    const channels = await step.run("fetch-watched-channels", async () => {
      const { data, error } = await anyDb
        .from("watched_channels")
        .select("id, youtube_channel_id, channel_title, uploads_playlist_id, latest_video_count")
        .eq("is_active", true);
      if (error) throw new Error(`Failed to fetch watched_channels: ${error.message}`);
      return data ?? [];
    });

    if (channels.length === 0) {
      return { channelsChecked: 0, videosQueued: 0, videosSkipped: 0 };
    }

    let totalQueued = 0;
    let totalSkipped = 0;

    // ---- 2. Process each channel --------------------------------------------
    for (const channel of channels) {
      const result = await step.run(`refresh-channel-${channel.id}`, async () => {
        if (!channel.uploads_playlist_id) {
          console.warn(`[catalog.refresh] channel ${channel.youtube_channel_id} has no uploads_playlist_id — skipping`);
          return { queued: 0, skipped: 0 };
        }

        // Fetch latest video IDs
        let videoIds: string[];
        try {
          videoIds = await fetchLatestVideosForChannel(
            channel.uploads_playlist_id,
            channel.latest_video_count
          );
        } catch (err) {
          console.error(`[catalog.refresh] failed to fetch videos for channel ${channel.youtube_channel_id}: ${err instanceof Error ? err.message : String(err)}`);
          return { queued: 0, skipped: 0 };
        }

        if (videoIds.length === 0) return { queued: 0, skipped: 0 };

        // Check which video IDs are already in the content table
        const { data: existing } = await db
          .from("content")
          .select("youtube_video_id")
          .in("youtube_video_id", videoIds);

        const existingIds = new Set((existing ?? []).map((r) => r.youtube_video_id));
        const newVideoIds = videoIds.filter((id) => !existingIds.has(id));

        if (newVideoIds.length === 0) {
          await anyDb
            .from("watched_channels")
            .update({ last_refreshed_at: new Date().toISOString() })
            .eq("id", channel.id);
          return { queued: 0, skipped: videoIds.length };
        }

        // Insert new content rows and fire ingestion events
        let queued = 0;
        for (const videoId of newVideoIds) {
          try {
            const metadata = await fetchYouTubeMetadata(videoId);

            const { data: inserted, error: insertErr } = await db
              .from("content")
              .insert({
                youtube_video_id: videoId,
                youtube_channel_id: metadata.channelId,
                channel_title: metadata.channelTitle,
                title: metadata.title,
                description: metadata.description || null,
                duration_seconds: metadata.durationSeconds || null,
                thumbnail_url: metadata.thumbnailUrl || null,
                published_at: metadata.publishedAt || null,
                transcript_available: metadata.captionsAvailable,
                status: "pending",
                creator_id: null,
              })
              .select("id")
              .single();

            if (insertErr || !inserted) {
              console.error(`[catalog.refresh] insert failed for videoId=${videoId}: ${insertErr?.message}`);
              continue;
            }

            // Fire the ingestion pipeline — creatorId is a sentinel nil UUID since
            // this content is unclaimed (no registered creator yet).
            await inngest.send({
              name: "content/ingested",
              data: {
                contentId: inserted.id,
                creatorId: "00000000-0000-0000-0000-000000000000",
              },
            });

            queued++;
          } catch (err) {
            console.error(`[catalog.refresh] error processing videoId=${videoId}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        await anyDb
          .from("watched_channels")
          .update({ last_refreshed_at: new Date().toISOString() })
          .eq("id", channel.id);

        return { queued, skipped: existingIds.size };
      });

      totalQueued += result.queued;
      totalSkipped += result.skipped;
    }

    console.log(
      `[catalog.refresh] done — channels=${channels.length} queued=${totalQueued} skipped=${totalSkipped}`
    );

    return {
      channelsChecked: channels.length,
      videosQueued: totalQueued,
      videosSkipped: totalSkipped,
    };
  }
);
