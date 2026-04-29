import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";

export async function POST(request: Request) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  await inngest.send({ name: "catalog/refresh.requested", data: {} });

  return NextResponse.json({ queued: true });
}
