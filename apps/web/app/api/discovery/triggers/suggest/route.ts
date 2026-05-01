import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@tingle/database";

const QuerySchema = z.object({
  // Restrict to alphanumeric, spaces, hyphens, and underscores to prevent
  // PostgREST filter injection via the .or() string built below.
  q: z.string().trim().min(1).max(100).regex(/^[\w\s-]+$/, "Invalid search query"),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export interface TriggerSuggestion {
  id: string;
  label: string;
  slug: string;
  category: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: searchParams.get("q") ?? "",
    limit: searchParams.get("limit") ?? 10,
  });

  if (!parsed.success) {
    return NextResponse.json({ suggestions: [] });
  }

  const db = getSupabaseServerClient();
  const words = parsed.data.q.trim().split(/\s+/);
  // Escape ILIKE special chars so user input is treated as a literal substring.
  const escape = (w: string) => w.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const filters = words
    .flatMap((w: string) => { const s = escape(w); return [`label.ilike.%${s}%`, `slug.ilike.%${s}%`]; })
    .join(",");

  const { data, error } = await db
    .from("trigger_tags")
    .select("id, label, slug, category")
    .or(filters)
    .limit(parsed.data.limit);

  if (error) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json({ suggestions: (data ?? []) as TriggerSuggestion[] });
}
