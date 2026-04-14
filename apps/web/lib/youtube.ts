// =============================================================================
// YouTube utilities
// All calls are server-side only (YOUTUBE_DATA_API_KEY is never public).
// =============================================================================

/** Regex patterns for extracting a YouTube video ID from various URL forms */
const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtube\.com\/v\/)([\w-]{11})/,
];

/** 11-character YouTube video ID pattern */
const BARE_ID_RE = /^[\w-]{11}$/;

/**
 * Extract the 11-character YouTube video ID from a URL or bare ID.
 * Returns null if the input is not a recognisable YouTube URL or ID.
 */
export function extractVideoId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  if (BARE_ID_RE.test(trimmed)) return trimmed;
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

// =============================================================================
// YouTube Data API v3
// =============================================================================

export interface YouTubeVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  /** Duration in seconds, parsed from ISO 8601 (e.g. PT3M14S) */
  durationSeconds: number;
  thumbnailUrl: string;
  /** YouTube publish date as ISO 8601 string */
  publishedAt: string;
  /** Whether captions are available (affects transcript fetch later) */
  captionsAvailable: boolean;
  channelId: string;
  channelTitle: string;
}

/** Parse ISO 8601 duration (PT1H2M3S) into total seconds */
function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h = "0", m = "0", s = "0"] = match;
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * Fetch video metadata via the YouTube Data API v3.
 * Must be called server-side (uses YOUTUBE_DATA_API_KEY).
 */
export async function fetchYouTubeMetadata(
  videoId: string
): Promise<YouTubeVideoMetadata> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_DATA_API_KEY environment variable.");

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("id", videoId);
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("key", apiKey);

  // API keys with HTTP-referrer restrictions block server-side requests that
  // carry no Referer header. Send the production origin so restricted keys work.
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 },
    headers: { Referer: appOrigin },
  });

  if (!res.ok) {
    // Surface the YouTube-specific error reason for easier debugging.
    let detail = `${res.status} ${res.statusText}`;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- YouTube error shape is untyped
      const errBody = (await res.clone().json()) as any;
      const ytErr = errBody?.error?.errors?.[0];
      if (ytErr?.reason) detail += ` — ${ytErr.reason}: ${ytErr.message}`;
    } catch {
      // ignore JSON parse failure, keep original detail string
    }
    throw new Error(`YouTube API error: ${detail}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- YouTube API response is untyped
  const data = (await res.json()) as any;
  const item = data?.items?.[0];
  if (!item) throw new Error(`Video not found: ${videoId}`);

  const snippet = item.snippet;
  const details = item.contentDetails;

  // Best thumbnail: maxres → high → medium → default
  const thumb =
    snippet.thumbnails?.maxres?.url ??
    snippet.thumbnails?.high?.url ??
    snippet.thumbnails?.medium?.url ??
    snippet.thumbnails?.default?.url ??
    "";

  const captionsAvailable =
    details?.caption === "true" || details?.caption === true;

  return {
    videoId,
    title: snippet.title as string,
    description: (snippet.description as string) ?? "",
    durationSeconds: parseIsoDuration(details?.duration ?? ""),
    thumbnailUrl: thumb,
    publishedAt: snippet.publishedAt as string,
    captionsAvailable,
    channelId: snippet.channelId as string,
    channelTitle: snippet.channelTitle as string,
  };
}

// =============================================================================
// YouTube Captions / Transcript
// =============================================================================

/**
 * Strip XML/HTML tags from a captions response body.
 * The timedtext API returns simple XML like:
 *   <transcript><text start="0.5" dur="2.3">Hello world</text></transcript>
 */
function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch a plain-text transcript for a YouTube video via the public timedtext API.
 * Returns null if captions are unavailable or the request fails.
 * Must be called server-side only.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/api/timedtext?lang=en&v=${encodeURIComponent(videoId)}&fmt=srv3`;
    const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim() === "") return null;
    const transcript = stripXmlTags(text);
    return transcript || null;
  } catch {
    return null;
  }
}

// =============================================================================

/**
 * Build a YouTube embed URL from a video ID.
 * Used for iframe src attributes.
 */
export function buildEmbedUrl(
  videoId: string,
  opts: { autoplay?: boolean; startMs?: number } = {}
): string {
  const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  if (opts.autoplay) url.searchParams.set("autoplay", "1");
  if (opts.startMs) url.searchParams.set("start", String(Math.floor(opts.startMs / 1000)));
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("rel", "0");
  url.searchParams.set("modestbranding", "1");
  return url.toString();
}
