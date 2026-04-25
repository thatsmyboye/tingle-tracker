// =============================================================================
// YouTube utilities
// All calls are server-side only (YOUTUBE_DATA_API_KEY is never public).
// =============================================================================

export type { TimedTranscriptSegment } from "@tingle/types";

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

export interface YouTubeChannelMetadata {
  channelId: string;
  title: string;
  uploadsPlaylistId: string;
  customUrl: string | null;
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

function extractChannelIdFromUrl(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const directIdMatch = trimmed.match(/^UC[\w-]{22}$/);
  if (directIdMatch) return directIdMatch[0];
  const urlMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
  return urlMatch?.[1] ?? null;
}

function extractChannelHandleFromUrl(url: string): string | null {
  const handleMatch = url.match(/youtube\.com\/(@[\w.-]+)/i);
  return handleMatch?.[1] ?? null;
}

function extractChannelLegacyUsernameFromUrl(url: string): string | null {
  const usernameMatch = url.match(/youtube\.com\/(?:c\/|user\/)([\w.-]+)/i);
  return usernameMatch?.[1] ?? null;
}

async function youtubeGetJson(url: URL): Promise<any> {
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
    throw new Error(`YouTube API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function resolveYouTubeChannelMetadata(
  channelUrlOrId: string
): Promise<YouTubeChannelMetadata> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_DATA_API_KEY environment variable.");

  const directChannelId = extractChannelIdFromUrl(channelUrlOrId);
  const handle = extractChannelHandleFromUrl(channelUrlOrId);
  const username = extractChannelLegacyUsernameFromUrl(channelUrlOrId);

  const channelUrl = new URL(`${YOUTUBE_API_BASE}/channels`);
  channelUrl.searchParams.set("part", "snippet,contentDetails");
  channelUrl.searchParams.set("key", apiKey);
  if (directChannelId) channelUrl.searchParams.set("id", directChannelId);
  else if (handle) channelUrl.searchParams.set("forHandle", handle);
  else if (username) channelUrl.searchParams.set("forUsername", username);
  else throw new Error("Unsupported YouTube channel URL.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- YouTube API response is untyped
  const data = (await youtubeGetJson(channelUrl)) as any;
  const item = data?.items?.[0];
  if (!item) throw new Error("Channel not found.");
  return {
    channelId: item.id as string,
    title: item.snippet?.title as string,
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads as string,
    customUrl: (item.snippet?.customUrl as string | undefined) ?? null,
  };
}

export async function fetchLatestVideosForChannel(
  uploadsPlaylistId: string,
  limit: number
): Promise<string[]> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_DATA_API_KEY environment variable.");
  const cappedLimit = Math.max(1, Math.min(limit, 50));
  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("playlistId", uploadsPlaylistId);
  url.searchParams.set("maxResults", String(cappedLimit));
  url.searchParams.set("key", apiKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- YouTube API response is untyped
  const data = (await youtubeGetJson(url)) as any;
  const ids = (data?.items ?? [])
    .map((item: any) => item?.contentDetails?.videoId as string | undefined)
    .filter((id: string | undefined): id is string => !!id);
  return Array.from(new Set(ids));
}

// =============================================================================
// YouTube Captions / Transcript
// =============================================================================

// =============================================================================
// Timed transcript (preserves per-segment timestamps)
// =============================================================================

import type { TimedTranscriptSegment } from "@tingle/types";

/** Decode common XML/HTML entities in a caption text node */
function decodeEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse srv3 XML caption format into timed segments */
function parseTimedTextSrv3(xml: string): TimedTranscriptSegment[] {
  // srv3 format: <p t="500" d="2100">caption text</p>
  // `t` = start in ms, `d` = duration in ms
  // Attribute order is not guaranteed — extract t and d independently.
  const segments: TimedTranscriptSegment[] = [];
  const pTagRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
  let match: RegExpExecArray | null;
  while ((match = pTagRe.exec(xml)) !== null) {
    const attrs = match[1];
    const tMatch = /\bt="(\d+)"/.exec(attrs);
    const dMatch = /\bd="(\d+)"/.exec(attrs);
    if (!tMatch || !dMatch) continue;
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " "));
    if (!text) continue;
    segments.push({
      text,
      start_ms: parseInt(tMatch[1], 10),
      duration_ms: parseInt(dMatch[1], 10),
    });
  }
  return segments;
}

function parseTimedTextXml(xml: string): TimedTranscriptSegment[] {
  // Basic XML format: <text start="1.5" dur="2.3">caption text</text>
  // start and dur are in seconds (float). Used by the no-fmt timedtext endpoint.
  const segments: TimedTranscriptSegment[] = [];
  const textRe = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(xml)) !== null) {
    const attrs = match[1];
    const startMatch = /\bstart="([\d.]+)"/.exec(attrs);
    const durMatch = /\bdur="([\d.]+)"/.exec(attrs);
    if (!startMatch || !durMatch) continue;
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " ")).trim();
    if (!text) continue;
    segments.push({
      text,
      start_ms: Math.round(parseFloat(startMatch[1]) * 1000),
      duration_ms: Math.round(parseFloat(durMatch[1]) * 1000),
    });
  }
  return segments;
}

/**
 * Fetch timed caption segments for a YouTube video.
 * Tries manual English captions first, then auto-generated (kind=asr) as fallback.
 * Each track is attempted with srv3 format first, then basic XML (no fmt param)
 * because auto-generated captions may not return usable srv3 data.
 * Returns null if captions are unavailable or the request fails.
 * Must be called server-side only.
 */
export async function fetchYouTubeTimedTranscript(
  videoId: string
): Promise<TimedTranscriptSegment[] | null> {
  const v = encodeURIComponent(videoId);
  const candidates: Array<{ url: string; parser: (xml: string) => TimedTranscriptSegment[] }> = [
    { url: `https://www.youtube.com/api/timedtext?lang=en&v=${v}&fmt=srv3`, parser: parseTimedTextSrv3 },
    { url: `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${v}&fmt=srv3`, parser: parseTimedTextSrv3 },
    { url: `https://www.youtube.com/api/timedtext?lang=en&v=${v}`, parser: parseTimedTextXml },
    { url: `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${v}`, parser: parseTimedTextXml },
  ];

  for (const { url, parser } of candidates) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml || xml.trim() === "") continue;
      const segments = parser(xml);
      if (segments.length > 0) return segments;
    } catch {
      continue;
    }
  }

  return null;
}

// =============================================================================
// Plain-text transcript (strips all timing — kept for content.process)
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
 * Tries manual English captions first, then auto-generated (kind=asr) as fallback.
 * Returns null if captions are unavailable or the request fails.
 * Must be called server-side only.
 */
export async function fetchYouTubeTranscript(videoId: string): Promise<string | null> {
  const urls = [
    `https://www.youtube.com/api/timedtext?lang=en&v=${encodeURIComponent(videoId)}&fmt=srv3`,
    `https://www.youtube.com/api/timedtext?lang=en&kind=asr&v=${encodeURIComponent(videoId)}&fmt=srv3`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.trim() === "") continue;
      const transcript = stripXmlTags(text);
      if (transcript) return transcript;
    } catch {
      continue;
    }
  }

  return null;
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
