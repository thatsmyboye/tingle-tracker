import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await inngest.send({ name: "catalog/refresh.requested", data: {} });

  return NextResponse.json({ queued: true });
}
