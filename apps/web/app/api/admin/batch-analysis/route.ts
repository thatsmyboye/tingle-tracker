import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import {
  BatchAnalysisRequestSchema,
  buildBatchItems,
  parseLinks,
  requireAdminAndGetServiceClient,
  type BatchRunResult,
} from "./shared";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BatchAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const links = parseLinks(parsed.data.links);
  const preview = await buildBatchItems(links, parsed.data.latestVideosPerChannel);
  const results: BatchRunResult[] = [];
  const serviceClient = admin.serviceClient;
  const adminUserId = admin.user.id;
  let queued = 0;

  // Cache channel_id → creator UUID within this batch to avoid redundant lookups
  // and to handle the case where multiple videos share the same channel.
  const channelCreatorCache = new Map<string, string>();

  for (const item of preview) {
    try {
      const { data: existingContent } = await serviceClient
        .from("content")
        .select("id")
        .eq("youtube_video_id", item.youtube_video_id)
        .maybeSingle();
      if (existingContent?.id) {
        results.push({
          input_link: item.source_link,
          status: "skipped",
          resolved_video_id: item.youtube_video_id,
          content_id: existingContent.id,
          reason: "Already exists.",
        });
        continue;
      }

      let creatorId: string | null = item.youtube_channel_id
        ? (channelCreatorCache.get(item.youtube_channel_id) ?? null)
        : null;

      if (!creatorId) {
        const channelCreator = await serviceClient
          .from("creators")
          .select("id")
          .eq("youtube_channel_id", item.youtube_channel_id)
          .maybeSingle();
        creatorId = channelCreator.data?.id ?? null;
      }

      if (!creatorId) {
        // upsert on youtube_channel_id so concurrent or retried batch runs
        // don't race into a duplicate-key error on that column.
        const upserted = await serviceClient
          .from("creators")
          .upsert(
            {
              user_id: adminUserId,
              display_name:
                item.channel_title ??
                `Batch Imported ${item.youtube_channel_id ?? "Creator"}`,
              youtube_channel_id: item.youtube_channel_id,
              youtube_channel_url: item.youtube_channel_id
                ? `https://youtube.com/channel/${item.youtube_channel_id}`
                : null,
              is_batch_import: true,
            },
            { onConflict: "youtube_channel_id", ignoreDuplicates: false }
          )
          .select("id")
          .single();
        if (upserted.error || !upserted.data) {
          throw new Error(upserted.error?.message ?? "Unable to create creator row.");
        }
        creatorId = upserted.data.id;
      }

      if (item.youtube_channel_id && creatorId) {
        channelCreatorCache.set(item.youtube_channel_id, creatorId);
      }

      const insertedContent = await serviceClient
        .from("content")
        .insert({
          creator_id: creatorId,
          youtube_video_id: item.youtube_video_id,
          youtube_channel_id: item.youtube_channel_id,
          channel_title: item.channel_title,
          title: item.title,
          description: null,
          duration_seconds: item.duration_seconds,
          thumbnail_url: item.thumbnail_url,
          published_at: item.published_at,
          transcript_available: item.transcript_available,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertedContent.error || !insertedContent.data) {
        throw new Error(insertedContent.error?.message ?? "Failed inserting content.");
      }

      await inngest.send({
        name: "content/ingested",
        data: { contentId: insertedContent.data.id, creatorId },
      });

      queued += 1;
      results.push({
        input_link: item.source_link,
        status: "queued",
        resolved_video_id: item.youtube_video_id,
        content_id: insertedContent.data.id,
        reason: null,
      });
    } catch (err) {
      results.push({
        input_link: item.source_link,
        status: "failed",
        resolved_video_id: item.youtube_video_id,
        reason: err instanceof Error ? err.message : String(err),
        content_id: null,
      });
    }
  }

  return NextResponse.json({ results, queued });
}
