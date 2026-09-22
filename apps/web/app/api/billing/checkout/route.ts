import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getSupabaseServerClient } from "@tingle/database";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

// =============================================================================
// POST /api/billing/checkout
//
// Creates a Stripe Checkout Session for a creator upgrading their plan.
// Requires a valid JWT (creator must be authenticated).
//
// Body: { priceId: string }
// Response: { url: string } — redirect the browser to this URL
// =============================================================================

const BodySchema = z.object({
  priceId: z.string().min(1),
});

// Stripe Price IDs — set these in env vars, created in your Stripe dashboard:
//   STRIPE_PRICE_PRO_MONTHLY   — Creator Pro, monthly
//   STRIPE_PRICE_PRO_YEARLY    — Creator Pro, annual
//   STRIPE_PRICE_STUDIO_MONTHLY — Creator Studio, monthly
//   STRIPE_PRICE_STUDIO_YEARLY  — Creator Studio, annual
const ALLOWED_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_PRO_MONTHLY,
  process.env.STRIPE_PRICE_PRO_YEARLY,
  process.env.STRIPE_PRICE_STUDIO_MONTHLY,
  process.env.STRIPE_PRICE_STUDIO_YEARLY,
].filter(Boolean) as string[]);

export async function POST(request: NextRequest) {
  if (IS_DORMANT) return dormantResponse();
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

  // ---- Parse body ----------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { priceId } = parsed.data;

  // Fail closed: if no price IDs are configured in env vars, reject all requests
  // rather than allowing any arbitrary Stripe price ID to be used.
  if (ALLOWED_PRICE_IDS.size === 0) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
  }

  // ---- Load creator record -------------------------------------------------
  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("id, stripe_customer_id, display_name")
    .eq("user_id", user.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json(
      { error: "Creator profile not found. Please set up your creator profile first." },
      { status: 404 }
    );
  }

  // ---- Stripe client -------------------------------------------------------
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });

  // ---- Get or create Stripe customer ---------------------------------------
  let customerId = creator.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: creator.display_name,
      metadata: { supabase_user_id: user.id, creator_id: creator.id },
    });
    customerId = customer.id;

    // Persist the customer ID immediately so future requests reuse it
    await supabase
      .from("creators")
      .update({ stripe_customer_id: customerId })
      .eq("id", creator.id);
  }

  // ---- Create Checkout Session ---------------------------------------------
  // Use a server-controlled origin rather than the request Origin header to
  // prevent an attacker from redirecting users to an arbitrary domain after
  // a successful Stripe checkout.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tingle-tracker.vercel.app";

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=1`,
      cancel_url: `${appUrl}/pricing`,
      subscription_data: {
        metadata: { creator_id: creator.id, supabase_user_id: user.id },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
