import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";

const STATUS_VALUES = ["pending", "approved", "rejected"] as const;
const StatusFilterSchema = z.enum(STATUS_VALUES).optional();

export async function GET(request: Request) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? undefined;
  const statusFilter = StatusFilterSchema.safeParse(statusParam);
  if (statusParam && !statusFilter.success) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 422 });
  }

  let query = admin.serviceClient
    .from("creator_intake_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter.data) {
    query = query.eq("status", statusFilter.data);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}
