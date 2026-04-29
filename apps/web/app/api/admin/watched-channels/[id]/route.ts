import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";

const PatchSchema = z.object({
  is_active: z.boolean().optional(),
  latest_video_count: z.number().int().min(1).max(50).optional(),
}).refine(
  (d: { is_active?: boolean; latest_video_count?: number }) =>
    d.is_active !== undefined || d.latest_video_count !== undefined,
  { message: "At least one field must be provided" }
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 422 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;
  if (parsed.data.latest_video_count !== undefined) updates.latest_video_count = parsed.data.latest_video_count;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- watched_channels not yet in generated types
  const { data, error } = await (admin.serviceClient as any)
    .from("watched_channels")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ channel: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- watched_channels not yet in generated types
  const { error } = await (admin.serviceClient as any)
    .from("watched_channels")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
