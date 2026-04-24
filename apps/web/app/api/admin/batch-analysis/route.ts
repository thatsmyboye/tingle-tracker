import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import {
  BatchAnalysisRequestSchema,
  buildBatchItems,
  parseLinks,
  requireAdminAndGetServiceClient,
  type BatchRunResult,
} from "./shared";

export async function POST(request: Request) {
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

      const channelCreator = await serviceClient
        .from("creators")
        .select("id")
          .eq("youtube_channel_id", item.youtube_channel_id)
        .maybeSingle();

      let creatorId = channelCreator.data?.id ?? null;
      if (!creatorId) {
        const created = await serviceClient
          .from("creators")
          .insert({
            user_id: adminUserId,
            display_name: item.channel_title ?? `Batch Imported ${item.youtube_channel_id ?? "Creator"}`,
            youtube_channel_id: item.youtube_channel_id,
            youtube_channel_url: item.youtube_channel_id
              ? `https://youtube.com/channel/${item.youtube_channel_id}`
              : null,
          })
          .select("id")
          .single();
        if (created.error || !created.data) {
          throw new Error(created.error?.message ?? "Unable to create creator row.");
        }
        creatorId = created.data.id;
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
