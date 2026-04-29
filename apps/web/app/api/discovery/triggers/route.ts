import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@tingle/database";

const QuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

interface DiscoveryResult {
  content_id: string;
  trigger_label: string;
  trigger_slug: string;
  confidence: number;
  timestamp_ms: number | null;
  start_ms: number | null;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  creator_id: string | null;
  creator_display_name: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    limit: searchParams.get("limit") ?? 20,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 422 });
  }

  const db = getSupabaseServerClient();
  const query = parsed.data.q;

  // Split into words and OR across label + slug for each word.
  // Querying trigger_tags directly avoids PostgREST failing to parse
  // ilike values with spaces when used inside a foreign-table .or() filter.
  const words = query.trim().split(/\s+/);
  const tagFilters = words
    .flatMap((w) => [`label.ilike.%${w}%`, `slug.ilike.%${w}%`])
    .join(",");

  const { data: matchedTags, error: tagError } = await db
    .from("trigger_tags")
    .select("id")
    .or(tagFilters);

  if (tagError) {
    return NextResponse.json({ error: "Failed to search triggers." }, { status: 500 });
  }

  const tagIds = (matchedTags ?? []).map((t) => t.id);
  if (tagIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await db
    .from("content_triggers")
    .select(`
      content_id,
      confidence,
      trigger_tag_id,
      trigger_tags!inner(label, slug),
      content!inner(id, youtube_video_id, title, thumbnail_url, creator_id),
      content_trigger_moments(timestamp_ms, confidence),
      creators:content!inner(creators(display_name))
    `)
    .in("trigger_tag_id", tagIds)
    .order("confidence", { ascending: false, nullsFirst: false })
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json({ error: "Failed to search triggers." }, { status: 500 });
  }

  const rows: DiscoveryResult[] = (data ?? []).map((row: any) => {
    const firstMoment = (row.content_trigger_moments ?? [])
      .slice()
      .sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    const timestampMs = firstMoment?.timestamp_ms ?? null;
    return {
      content_id: row.content_id,
      trigger_label: row.trigger_tags?.label ?? "Unknown",
      trigger_slug: row.trigger_tags?.slug ?? "",
      confidence: row.confidence ?? 0,
      timestamp_ms: timestampMs,
      start_ms: timestampMs != null ? Math.max(0, timestampMs - 5000) : null,
      youtube_video_id: row.content?.youtube_video_id ?? "",
      title: row.content?.title ?? "Untitled",
      thumbnail_url: row.content?.thumbnail_url ?? null,
      creator_id: row.content?.creator_id ?? null,
      creator_display_name: row.creators?.creators?.display_name ?? null,
    };
  });

  return NextResponse.json({ results: rows });
}
