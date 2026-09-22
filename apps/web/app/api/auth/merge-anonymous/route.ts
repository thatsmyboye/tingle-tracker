import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

// =============================================================================
// POST /api/auth/merge-anonymous
//
// Transfers tingle_events rows from an anonymous user to the newly authenticated
// real user. Called automatically by useAuth after a sign-in event when a prior
// anonymous session is detected.
//
// Security:
//   • The real user_id is extracted from the verified Bearer JWT — never trusted
//     from the request body.
//   • We verify anonUserId refers to an actual anonymous user in auth.users
//     before touching any rows.
//   • The UPDATE uses the service role client (bypasses RLS) since tingle_events
//     owner policies would otherwise block cross-user writes.
// =============================================================================

const BodySchema = z.object({
  anonUserId: z.string().uuid("anonUserId must be a UUID"),
});

export async function POST(request: Request) {
  if (IS_DORMANT) return dormantResponse();
  // ---- Auth: extract real user from JWT ------------------------------------

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Verify the JWT and get the real user_id
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: realUser }, error: authError } = await userClient.auth.getUser();

  if (authError || !realUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Real user must not itself be anonymous (sanity check)
  if ((realUser as { is_anonymous?: boolean }).is_anonymous) {
    return NextResponse.json(
      { error: "Target user is still anonymous." },
      { status: 400 }
    );
  }

  // ---- Parse body -----------------------------------------------------------

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { anonUserId } = parsed.data;

  // Don't attempt a no-op self-merge
  if (anonUserId === realUser.id) {
    return NextResponse.json({ merged: 0 }, { status: 200 });
  }

  // ---- Service-role client for privileged operations -----------------------

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify anonUserId is actually an anonymous Supabase user
  const { data: anonUser, error: anonLookupError } = await adminClient.auth.admin.getUserById(anonUserId);

  if (anonLookupError || !anonUser?.user) {
    return NextResponse.json(
      { error: "Anonymous user not found." },
      { status: 404 }
    );
  }

  if (!(anonUser.user as { is_anonymous?: boolean }).is_anonymous) {
    return NextResponse.json(
      { error: "Provided anonUserId does not belong to an anonymous account." },
      { status: 400 }
    );
  }

  // ---- Transfer tingle_events rows -----------------------------------------

  const { error: updateError, count } = await adminClient
    .from("tingle_events")
    .update({ user_id: realUser.id })
    .eq("user_id", anonUserId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  // ---- Delete the now-empty anonymous user (optional clean-up) -------------
  // Best-effort — don't fail the whole request if this doesn't work.
  await adminClient.auth.admin.deleteUser(anonUserId).catch(() => null);

  return NextResponse.json({ merged: count ?? 0 }, { status: 200 });
}
