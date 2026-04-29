import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";
import { resolveYouTubeChannelMetadata } from "@/lib/youtube";

const AddChannelSchema = z.object({
  channelUrl: z.string().trim().min(1),
  latestVideoCount: z.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- watched_channels not yet in generated types
  const { data, error } = await (admin.serviceClient as any)
    .from("watched_channels")
    .select("id, youtube_channel_id, channel_title, uploads_playlist_id, latest_video_count, is_active, last_refreshed_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ channels: data ?? [] });
}

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

  const parsed = AddChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  let channelMeta: Awaited<ReturnType<typeof resolveYouTubeChannelMetadata>>;
  try {
    channelMeta = await resolveYouTubeChannelMetadata(parsed.data.channelUrl);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not resolve channel: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- watched_channels not yet in generated types
  const { data, error } = await (admin.serviceClient as any)
    .from("watched_channels")
    .upsert(
      {
        youtube_channel_id: channelMeta.channelId,
        channel_title: channelMeta.title,
        uploads_playlist_id: channelMeta.uploadsPlaylistId,
        latest_video_count: parsed.data.latestVideoCount,
        is_active: true,
      },
      { onConflict: "youtube_channel_id" }
    )
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to add channel" }, { status: 500 });
  }

  return NextResponse.json({ channel: data }, { status: 201 });
}
