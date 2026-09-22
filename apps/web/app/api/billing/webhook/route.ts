import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@tingle/database";
import { IS_DORMANT } from "@/lib/dormancy";
import { dormantResponse } from "@/lib/dormancy.server";

// =============================================================================
// POST /api/billing/webhook
//
// Receives and verifies Stripe webhook events.
// Handles the lifecycle of creator subscriptions:
//   - checkout.session.completed    → activate plan
//   - customer.subscription.updated → sync plan + status changes
//   - customer.subscription.deleted → downgrade to free
//
// Register this URL in your Stripe dashboard:
//   https://tingle-tracker.vercel.app/api/billing/webhook
//
// Required env var: STRIPE_WEBHOOK_SECRET (from Stripe dashboard → Webhooks)
// =============================================================================

// Stripe moved current_period_end off the top-level Subscription object in
// newer API versions — it now lives on each subscription item. This helper
// reads it from either location so the code works across API versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
  const raw =
    (subscription.items.data[0] as any)?.current_period_end ??
    (subscription as any).current_period_end;
  return typeof raw === "number" ? new Date(raw * 1000).toISOString() : null;
}

// Maps Stripe Price IDs to plan names. Configure in Stripe dashboard and set
// as environment variables.
function getPlanFromPriceId(priceId: string): "pro" | "studio" | null {
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  ) {
    return "pro";
  }
  if (
    priceId === process.env.STRIPE_PRICE_STUDIO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_STUDIO_YEARLY
  ) {
    return "studio";
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (IS_DORMANT) return dormantResponse();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-03-25.dahlia",
  });

  // ---- Verify webhook signature --------------------------------------------
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  // ---- Handle events -------------------------------------------------------
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;

        // subscription_data.metadata is passed at creation time and lands on
        // the Subscription object — retrieve it to read creator_id.
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const creatorId = subscription.metadata?.creator_id as string | undefined;
        if (!creatorId) break;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? getPlanFromPriceId(priceId) : null;

        await supabase
          .from("creators")
          .update({
            plan: plan ?? "free",
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused",
            plan_expires_at: getPeriodEnd(subscription),
          })
          .eq("id", creatorId);

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const creatorId = subscription.metadata?.creator_id as string | undefined;
        if (!creatorId) break;

        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? getPlanFromPriceId(priceId) : null;

        await supabase
          .from("creators")
          .update({
            plan: plan ?? "free",
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status as "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid" | "paused",
            plan_expires_at: getPeriodEnd(subscription),
          })
          .eq("id", creatorId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const creatorId = subscription.metadata?.creator_id as string | undefined;
        if (!creatorId) break;

        await supabase
          .from("creators")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            subscription_status: "canceled",
            plan_expires_at: null,
          })
          .eq("id", creatorId);

        break;
      }

      default:
        // Unhandled event type — return 200 to prevent Stripe retries
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    console.error("[billing/webhook]", event.type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
