import { NextResponse } from "next/server";
import {
  BatchAnalysisRequestSchema,
  buildBatchItems,
  parseLinks,
  requireAdminAndGetServiceClient,
  type BatchLinkPreview,
} from "../shared";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  const auth = await requireAdminAndGetServiceClient(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  try {
    const links = parseLinks(parsed.data.links);
    const items = await buildBatchItems(links, parsed.data.latestVideosPerChannel);
    const videoIds = items.map((item) => item.youtube_video_id);
    const { data: existingRows } = await auth.serviceClient
      .from("content")
      .select("id, youtube_video_id")
      .in("youtube_video_id", videoIds);
    const existingMap = new Map((existingRows ?? []).map((row) => [row.youtube_video_id, row.id]));
    const preview: BatchLinkPreview[] = items.map((item) => {
      const existingContentId = existingMap.get(item.youtube_video_id) ?? null;
      return {
        input_link: item.source_link,
        source_type: item.source_type,
        resolved_video_id: item.youtube_video_id,
        existing_content_id: existingContentId,
        status: existingContentId ? "duplicate" : "ready",
        reason: existingContentId ? "Video already exists in content library." : null,
      };
    });
    return NextResponse.json({ items: preview }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to preview batch." },
      { status: 502 }
    );
  }
}
