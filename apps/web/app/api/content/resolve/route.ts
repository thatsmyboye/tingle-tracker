import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractVideoId, fetchYouTubeMetadata } from "@/lib/youtube";

// =============================================================================
// POST /api/content/resolve
//
// Public endpoint — no authentication required.
//
// Accepts a YouTube URL (any format) and returns a contentId. If a content
// row already exists for the video it is returned immediately. If not, video
// metadata is fetched from the YouTube Data API and a new content row is
// created with creator_id = NULL (unclaimed). The row becomes claimable once
// a creator verifies ownership of the YouTube channel.
//
// Used by the /listen page so listeners can paste any video and start logging
// tingles without waiting for a creator to register first.
// =============================================================================

const ResolveBodySchema = z.object({
  youtubeUrl: z.string().min(1, "youtubeUrl is required"),
});

export async function POST(request: Request) {
  // ---- Parse + validate body ------------------------------------------------

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ResolveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed" },
      { status: 422 }
    );
  }

  // ---- Extract video ID -----------------------------------------------------

  const videoId = extractVideoId(parsed.data.youtubeUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not parse a YouTube video ID from the provided URL." },
      { status: 422 }
    );
  }

  // ---- Service role client — bypasses RLS for unclaimed content insert -------

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---- Return existing row if present ----------------------------------------

  const { data: existing } = await supabase
    .from("content")
    .select("id")
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ contentId: existing.id, isNew: false });
  }

  // ---- Fetch YouTube metadata -----------------------------------------------

  let metadata;
  try {
    metadata = await fetchYouTubeMetadata(videoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "YouTube API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // ---- Insert unclaimed content row -----------------------------------------
  // creator_id is intentionally omitted (NULL). The channel owner can claim
  // this content later by verifying their YouTube channel in the dashboard.

  const { data: content, error: insertError } = await supabase
    .from("content")
    .insert({
      youtube_video_id: videoId,
      youtube_channel_id: metadata.channelId,
      channel_title: metadata.channelTitle,
      title: metadata.title,
      description: metadata.description,
      duration_seconds: metadata.durationSeconds || null,
      thumbnail_url: metadata.thumbnailUrl || null,
      published_at: metadata.publishedAt || null,
      status: "ready",
      transcript_available: metadata.captionsAvailable,
    })
    .select("id")
    .single();

  if (insertError || !content) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create content record." },
      { status: 500 }
    );
  }

  return NextResponse.json({ contentId: content.id, isNew: true }, { status: 201 });
}
