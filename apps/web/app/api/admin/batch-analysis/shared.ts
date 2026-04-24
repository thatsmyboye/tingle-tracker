import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fetchLatestVideosForChannel, fetchYouTubeMetadata, resolveYouTubeChannelMetadata } from "@/lib/youtube";

export const BatchAnalysisRequestSchema = z.object({
  links: z.array(z.string().min(1)).min(1).max(200),
  latestVideosPerChannel: z.number().int().min(1).max(50).default(20),
});

export type BatchAnalysisRequest = z.infer<typeof BatchAnalysisRequestSchema>;

export type InputKind = "video" | "channel" | "unsupported";

export interface BatchAnalysisPreviewItem {
  source_link: string;
  source_type: "video" | "channel";
  youtube_video_id: string;
  youtube_channel_id: string;
  channel_title: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  published_at: string | null;
  transcript_available: boolean;
}

export interface BatchLinkPreview {
  input_link: string;
  status: "ready" | "duplicate" | "invalid";
  resolved_video_id: string | null;
  source_type: "video" | "channel" | "unsupported";
  existing_content_id?: string | null;
  reason: string | null;
}

export interface BatchRunResult {
  input_link: string;
  status: "queued" | "skipped" | "failed";
  content_id: string | null;
  resolved_video_id: string | null;
  reason: string | null;
}

interface ChannelCacheValue {
  channel_id: string;
  channel_title: string;
  video_ids: string[];
}

const CHANNEL_URL_RE = /youtube\.com\/(channel\/UC[\w-]{22}|@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+)/i;

export function classifyInputKind(link: string): InputKind {
  if (extractVideoIdFromAny(link)) return "video";
  if (CHANNEL_URL_RE.test(link) || /^UC[\w-]{22}$/.test(link.trim())) return "channel";
  return "unsupported";
}

function extractVideoIdFromAny(link: string): string | null {
  const trimmed = link.trim();
  const bareId = trimmed.match(/^[\w-]{11}$/);
  if (bareId) return bareId[0];
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function parseLinks(rawLinks: string[]): string[] {
  return Array.from(
    new Set(
      rawLinks
        .flatMap((line) => line.split(/\s+/))
        .map((v) => v.trim())
        .filter(Boolean)
    )
  );
}

export async function buildBatchItems(
  links: string[],
  latestVideosPerChannel: number
): Promise<BatchAnalysisPreviewItem[]> {
  const expanded: BatchAnalysisPreviewItem[] = [];
  const channelCache = new Map<string, ChannelCacheValue>();

  for (const link of links) {
    const kind = classifyInputKind(link);
    if (kind === "unsupported") continue;

    if (kind === "video") {
      const videoId = extractVideoIdFromAny(link);
      if (!videoId) continue;
      try {
        const metadata = await fetchYouTubeMetadata(videoId);
        expanded.push({
          source_link: link,
          source_type: "video",
          youtube_video_id: videoId,
          youtube_channel_id: metadata.channelId ?? "",
          channel_title: metadata.channelTitle ?? "",
          title: metadata.title,
          description: metadata.description ?? null,
          duration_seconds: metadata.durationSeconds || null,
          thumbnail_url: metadata.thumbnailUrl || null,
          published_at: metadata.publishedAt || null,
          transcript_available: metadata.captionsAvailable,
        });
      } catch {}
      continue;
    }

    try {
      let channel = channelCache.get(link);
      if (!channel) {
        const meta = await resolveYouTubeChannelMetadata(link);
        const ids = await fetchLatestVideosForChannel(meta.uploadsPlaylistId, latestVideosPerChannel);
        channel = {
          channel_id: meta.channelId,
          channel_title: meta.title,
          video_ids: ids,
        };
        channelCache.set(link, channel);
      }
      for (const videoId of channel.video_ids) {
        try {
          const metadata = await fetchYouTubeMetadata(videoId);
          expanded.push({
            source_link: link,
            source_type: "channel",
            youtube_video_id: videoId,
            youtube_channel_id: channel.channel_id,
            channel_title: channel.channel_title,
            title: metadata.title,
            description: metadata.description ?? null,
            duration_seconds: metadata.durationSeconds || null,
            thumbnail_url: metadata.thumbnailUrl || null,
            published_at: metadata.publishedAt || null,
            transcript_available: metadata.captionsAvailable,
          });
        } catch {}
      }
    } catch {}
  }

  return Array.from(
    new Map(expanded.map((item) => [item.youtube_video_id, item])).values()
  );
}

export function createUserClientFromAuthHeader(authHeader: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function verifyAdmin(userClient: ReturnType<typeof createUserClientFromAuthHeader>) {
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  const { data: profile } = await userClient
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) return { ok: false as const, status: 403 as const, error: "Forbidden" };
  return { ok: true as const, user };
}

export async function requireAdminAndGetServiceClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 as const };
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createUserClientFromAuthHeader(authHeader);
  const adminCheck = await verifyAdmin(userClient);
  if (!adminCheck.ok) return { error: adminCheck.error, status: adminCheck.status };

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return { serviceClient, user: adminCheck.user };
}
