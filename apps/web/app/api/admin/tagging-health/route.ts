import { NextResponse } from "next/server";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";

type TaggingHealthMetrics = {
  scanned: number;
  unresolved_count: number;
  unresolved_rate: number;
  low_confidence_count: number;
  low_confidence_rate: number;
  top_unresolved: Array<{ slug: string; count: number }>;
};

export async function GET(request: Request) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { data, error } = await admin.serviceClient
    .from("insights_cache")
    .select("report")
    .eq("status", "ready")
    .order("generated_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let scanned = 0;
  let unresolvedCount = 0;
  let lowConfidenceCount = 0;
  const unresolvedCounts = new Map<string, number>();

  for (const row of data ?? []) {
    const report = row.report as
      | {
          tagging_health?: {
            candidate_count?: number;
            unresolved_count?: number;
            low_confidence_count?: number;
            unresolved_unique_slugs?: string[];
          };
        }
      | null;
    const th = report?.tagging_health;
    if (!th || (th.candidate_count ?? 0) <= 0) continue;

    scanned += th.candidate_count ?? 0;
    unresolvedCount += th.unresolved_count ?? 0;
    lowConfidenceCount += th.low_confidence_count ?? 0;
    for (const slug of th.unresolved_unique_slugs ?? []) {
      unresolvedCounts.set(slug, (unresolvedCounts.get(slug) ?? 0) + 1);
    }
  }

  const metrics: TaggingHealthMetrics = {
    scanned,
    unresolved_count: unresolvedCount,
    unresolved_rate: scanned > 0 ? unresolvedCount / scanned : 0,
    low_confidence_count: lowConfidenceCount,
    low_confidence_rate: scanned > 0 ? lowConfidenceCount / scanned : 0,
    top_unresolved: [...unresolvedCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([slug, count]) => ({ slug, count })),
  };

  return NextResponse.json({ metrics });
}
