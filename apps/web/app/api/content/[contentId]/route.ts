import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

// =============================================================================
// DELETE /api/content/[contentId]
// Removes the creator's association with a video by setting creator_id to NULL.
// The content row and all listener tingle data are preserved.
// Requires the caller to be authenticated and own the content.
// =============================================================================

export async function DELETE(
  request: Request,
  { params }: { params: { contentId: string } }
) {
  if (IS_DORMANT) return dormantResponse();
  const { contentId } = params;

  if (!contentId) {
    return NextResponse.json({ error: "contentId is required" }, { status: 400 });
  }

  // ---- Verify auth ----------------------------------------------------------

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // User-scoped client — RLS ensures we only see content owned by this user's creator
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Confirm the content exists and belongs to the authenticated user's creator
  const { data: content, error: fetchError } = await userClient
    .from("content")
    .select("id, creator_id, creators!inner(user_id)")
    .eq("id", contentId)
    .single();

  if (fetchError || !content) {
    return NextResponse.json(
      { error: "Content not found or not owned by authenticated user." },
      { status: 403 }
    );
  }

  // ---- Dissociate via service role (setting creator_id=NULL fails RLS WITH CHECK) --

  const serviceClient = createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: updateError } = await serviceClient
    .from("content")
    .update({ creator_id: null })
    .eq("id", contentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
