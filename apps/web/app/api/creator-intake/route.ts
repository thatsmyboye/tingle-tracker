import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createUserClientFromAuthHeader,
} from "@/app/api/admin/batch-analysis/shared";
import { resolveYouTubeChannelMetadata } from "@/lib/youtube";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

const YOUTUBE_CHANNEL_RE =
  /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:channel\/UC[\w-]{22}|@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+)|^UC[\w-]{22}$/;

const SubmitChannelSchema = z.object({
  channelUrl: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((v) => YOUTUBE_CHANNEL_RE.test(v), {
      message: "Must be a valid YouTube channel URL or channel ID.",
    }),
});

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function resolveUser(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const userClient = createUserClientFromAuthHeader(authHeader);
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return { error: "Unauthorized", status: 401 as const };
  if ((user as { is_anonymous?: boolean }).is_anonymous) {
    return { error: "Anonymous users cannot submit channels. Please create an account.", status: 403 as const };
  }
  return { user };
}

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  const auth = await resolveUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SubmitChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  let channelMeta: Awaited<ReturnType<typeof resolveYouTubeChannelMetadata>>;
  try {
    channelMeta = await resolveYouTubeChannelMetadata(parsed.data.channelUrl);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not resolve YouTube channel: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 }
    );
  }

  const serviceClient = getServiceClient();

  // Dedup: already tracked as a watched channel
  const { data: watchedMatch } = await serviceClient
    .from("watched_channels")
    .select("id")
    .eq("youtube_channel_id", channelMeta.channelId)
    .maybeSingle();
  if (watchedMatch) {
    return NextResponse.json(
      { error: "This channel is already being tracked by Tingle Tracker." },
      { status: 409 }
    );
  }

  // Dedup: already registered as a creator
  const { data: creatorMatch } = await serviceClient
    .from("creators")
    .select("id")
    .eq("youtube_channel_id", channelMeta.channelId)
    .maybeSingle();
  if (creatorMatch) {
    return NextResponse.json(
      { error: "A creator is already registered with this channel on Tingle Tracker." },
      { status: 409 }
    );
  }

  // Dedup: already has an active submission
  const { data: intakeMatch } = await serviceClient
    .from("creator_intake_submissions")
    .select("id, status")
    .eq("youtube_channel_id", channelMeta.channelId)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (intakeMatch) {
    const msg =
      intakeMatch.status === "approved"
        ? "This channel has already been approved and will be added to the catalog soon."
        : "This channel already has a pending submission in the review queue.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const { data: submission, error: insertError } = await serviceClient
    .from("creator_intake_submissions")
    .insert({
      submitted_by_user_id: auth.user.id,
      youtube_channel_id: channelMeta.channelId,
      youtube_channel_url: parsed.data.channelUrl.trim(),
      channel_title: channelMeta.title,
      uploads_playlist_id: channelMeta.uploadsPlaylistId,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !submission) {
    // Unique constraint violation — concurrent duplicate submission
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "This channel already has a pending submission in the review queue." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError?.message ?? "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ submission }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await resolveUser(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient
    .from("creator_intake_submissions")
    .select("*")
    .eq("submitted_by_user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}
