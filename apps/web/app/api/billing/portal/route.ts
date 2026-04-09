import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@tingle/database";

// =============================================================================
// POST /api/billing/portal
//
// Creates a Stripe Customer Portal session so a creator can manage their
// subscription (update payment method, cancel, view invoices).
// Requires a valid JWT.
//
// Response: { url: string } — redirect the browser to this URL
// =============================================================================

export async function POST(request: NextRequest) {
  // ---- Auth ----------------------------------------------------------------
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---- Load creator + Stripe customer ID -----------------------------------
  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
  }

  if (!creator.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account found. Start a subscription first." },
      { status: 400 }
    );
  }

  // ---- Create portal session -----------------------------------------------
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://tingle-tracker.vercel.app";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: creator.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
