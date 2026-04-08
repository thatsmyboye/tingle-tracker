import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractVideoId, fetchYouTubeMetadata } from "@/lib/youtube";

// =============================================================================
// POST /api/content/ingest
// Accepts a YouTube URL or video ID, fetches metadata, and creates a content row.
// Requires the caller to be authenticated (Supabase JWT in Authorization header).
// =============================================================================

const IngestBodySchema = z.object({
  /** YouTube URL (any format) or bare 11-character video ID */
  youtubeUrl: z.string().min(1, "youtubeUrl is required"),
  /** Creator row ID — must belong to the authenticated user */
  creatorId: z.string().uuid("creatorId must be a UUID"),
});

export async function POST(request: Request) {
  // ---- Parse + validate body ------------------------------------------------

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IngestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { youtubeUrl, creatorId } = parsed.data;

  // ---- Extract video ID -----------------------------------------------------

  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    return NextResponse.json(
      { error: "Could not parse a YouTube video ID from the provided URL." },
      { status: 422 }
    );
  }

  // ---- Verify auth (user-scoped Supabase client) ----------------------------

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify the creator row belongs to the authenticated user
  const { data: creator, error: creatorError } = await userClient
    .from("creators")
    .select("id, user_id")
    .eq("id", creatorId)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json(
      { error: "Creator not found or not owned by authenticated user." },
      { status: 403 }
    );
  }

  // ---- Check for duplicate --------------------------------------------------

  const { data: existing } = await userClient
    .from("content")
    .select("id")
    .eq("youtube_video_id", videoId)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "This video has already been ingested.", contentId: existing.id },
      { status: 409 }
    );
  }

  // ---- Fetch YouTube metadata -----------------------------------------------

  let metadata;
  try {
    metadata = await fetchYouTubeMetadata(videoId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "YouTube API error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // ---- Insert content row ---------------------------------------------------

  const { data: content, error: insertError } = await userClient
    .from("content")
    .insert({
      creator_id: creatorId,
      youtube_video_id: videoId,
      title: metadata.title,
      description: metadata.description,
      duration_seconds: metadata.durationSeconds || null,
      thumbnail_url: metadata.thumbnailUrl || null,
      published_at: metadata.publishedAt || null,
      status: "pending",
      transcript_available: metadata.captionsAvailable,
    })
    .select()
    .single();

  if (insertError || !content) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create content record." },
      { status: 500 }
    );
  }

  return NextResponse.json({ content }, { status: 201 });
}
