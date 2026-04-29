import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@tingle/database";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ creatorId: string }> }
) {
  const { creatorId } = await params;

  if (!creatorId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json({ error: "Invalid creatorId" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({ limit: searchParams.get("limit") ?? 10 });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 422 });
  }

  const db = getSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- new RPC not yet in generated types
  const { data, error } = await (db as any).rpc("find_similar_creators", {
    p_creator_id: creatorId,
    p_limit: parsed.data.limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
