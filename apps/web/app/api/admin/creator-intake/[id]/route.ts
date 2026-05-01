import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAndGetServiceClient } from "@/app/api/admin/batch-analysis/shared";
import { inngest } from "@/inngest/client";

const PatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), rejection_reason: z.string().min(1) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdminAndGetServiceClient(request);
  if ("error" in admin) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

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

  const { data: submission, error: fetchError } = await admin.serviceClient
    .from("creator_intake_submissions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  if (submission.status !== "pending") {
    return NextResponse.json(
      { error: `Submission is already ${submission.status}` },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (parsed.data.action === "approve") {
    // Upsert into watched_channels using the resolved metadata stored at submission time
    const { error: upsertError } = await admin.serviceClient
      .from("watched_channels")
      .upsert(
        {
          youtube_channel_id: submission.youtube_channel_id,
          channel_title: submission.channel_title,
          uploads_playlist_id: submission.uploads_playlist_id,
          latest_video_count: 20,
          is_active: true,
        },
        { onConflict: "youtube_channel_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Trigger immediate catalog refresh so the new channel is processed now
    await inngest.send({ name: "catalog/refresh.requested", data: {} });

    const { data: updated, error: updateError } = await admin.serviceClient
      .from("creator_intake_submissions")
      .update({
        status: "approved",
        reviewed_by_user_id: admin.user.id,
        reviewed_at: now,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message ?? "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ submission: updated });
  }

  // action === "reject"
  const { data: updated, error: updateError } = await admin.serviceClient
    .from("creator_intake_submissions")
    .update({
      status: "rejected",
      rejection_reason: parsed.data.rejection_reason,
      reviewed_by_user_id: admin.user.id,
      reviewed_at: now,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ submission: updated });
}
