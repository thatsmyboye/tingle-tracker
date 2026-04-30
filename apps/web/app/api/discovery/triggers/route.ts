import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@tingle/database";

const QuerySchema = z.object({
  tagIds: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface MatchedTrigger {
  trigger_tag_id: string;
  trigger_label: string;
  trigger_slug: string;
  confidence: number;
  timestamp_ms: number | null;
  lead_in_start_ms: number | null;
}

export interface ContentMatch {
  content_id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  creator_id: string | null;
  creator_display_name: string | null;
  match_count: number;
  matched_triggers: MatchedTrigger[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    tagIds: searchParams.get("tagIds") ?? "",
    limit: searchParams.get("limit") ?? 20,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 422 });
  }

  const tagIds = parsed.data.tagIds
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);

  if (tagIds.length === 0) {
    return NextResponse.json({ error: "At least one tag ID is required" }, { status: 422 });
  }

  const db = getSupabaseServerClient();

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
    .in("trigger_tag_id", tagIds);

  if (error) {
    return NextResponse.json({ error: "Failed to search triggers." }, { status: 500 });
  }

  // Group rows by content_id, accumulating matched triggers
  const byContent = new Map<string, ContentMatch>();

  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase joined shape is untyped
    const r = row as any;
    const contentId: string = r.content_id;

    if (!byContent.has(contentId)) {
      byContent.set(contentId, {
        content_id: contentId,
        youtube_video_id: r.content?.youtube_video_id ?? "",
        title: r.content?.title ?? "Untitled",
        thumbnail_url: r.content?.thumbnail_url ?? null,
        creator_id: r.content?.creator_id ?? null,
        creator_display_name: r.creators?.creators?.display_name ?? null,
        match_count: 0,
        matched_triggers: [],
      });
    }

    const entry = byContent.get(contentId)!;

    const moments: Array<{ timestamp_ms: number; confidence: number }> =
      r.content_trigger_moments ?? [];
    const bestMoment = moments
      .slice()
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    const timestampMs = bestMoment?.timestamp_ms ?? null;

    entry.matched_triggers.push({
      trigger_tag_id: r.trigger_tag_id,
      trigger_label: r.trigger_tags?.label ?? "Unknown",
      trigger_slug: r.trigger_tags?.slug ?? "",
      confidence: r.confidence ?? 0,
      timestamp_ms: timestampMs,
      lead_in_start_ms: timestampMs != null ? Math.max(0, timestampMs - 5000) : null,
    });

    entry.match_count += 1;
  }

  // Sort by match_count desc, then by max confidence desc
  const results: ContentMatch[] = Array.from(byContent.values())
    .sort((a, b) => {
      if (b.match_count !== a.match_count) return b.match_count - a.match_count;
      const maxConf = (m: ContentMatch) =>
        Math.max(...m.matched_triggers.map((t) => t.confidence));
      return maxConf(b) - maxConf(a);
    })
    .slice(0, parsed.data.limit);

  return NextResponse.json({ results });
}
