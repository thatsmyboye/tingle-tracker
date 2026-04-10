import { NextResponse } from "next/server";
import Stripe from "stripe";

// =============================================================================
// GET /api/billing/health
//
// Stripe sandbox connectivity report. Returns a structured JSON response
// showing whether the configured API keys and price IDs are valid.
//
// SAFETY: Only responds when STRIPE_SECRET_KEY has the "sk_test_" prefix.
// Returns 403 for live keys so this endpoint cannot leak live-account data.
//
// Usage: curl https://<preview-url>/api/billing/health
// =============================================================================

type PriceResult =
  | { product: string; amount: string; interval: string; active: boolean; price_id: string }
  | { error: string; price_id: string };

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

const PRICE_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_STUDIO_MONTHLY",
  "STRIPE_PRICE_STUDIO_YEARLY",
] as const;

const ALL_VARS = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  ...PRICE_VARS,
] as const;

export async function GET() {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

  // ---- Only allow test-mode keys ------------------------------------------
  if (!secretKey.startsWith("sk_test_")) {
    return NextResponse.json(
      { error: "Health endpoint is only available with Stripe test keys (sk_test_…)." },
      { status: 403 }
    );
  }

  // ---- Missing vars check --------------------------------------------------
  const missing_vars = ALL_VARS.filter((v) => !process.env[v]);

  // ---- API connectivity ----------------------------------------------------
  const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });

  let connectivity: "ok" | "error" = "ok";
  let balance_error: string | undefined;
  let balance: Stripe.Balance | undefined;

  try {
    balance = await stripe.balance.retrieve();
  } catch (err) {
    connectivity = "error";
    balance_error = err instanceof Stripe.errors.StripeError ? err.message : String(err);
  }

  // ---- Price ID validation -------------------------------------------------
  const prices: Record<string, PriceResult> = {};

  for (const varName of PRICE_VARS) {
    const priceId = process.env[varName];
    if (!priceId) {
      prices[varName] = { error: "env var not set", price_id: "" };
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as Stripe.Product;
      prices[varName] = {
        product: product.name,
        amount: formatAmount(price.unit_amount, price.currency),
        interval: price.recurring?.interval ?? "one-time",
        active: price.active,
        price_id: priceId,
      };
    } catch (err) {
      const msg = err instanceof Stripe.errors.StripeError ? err.message : String(err);
      prices[varName] = { error: msg, price_id: priceId };
    }
  }

  // ---- Key mode -----------------------------------------------------------
  const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  const report = {
    mode: "test" as const,
    connectivity,
    ...(balance_error ? { connectivity_error: balance_error } : {}),
    ...(balance
      ? {
          balance: {
            available: balance.available.map((b) => ({
              amount: formatAmount(b.amount, b.currency),
              currency: b.currency,
            })),
          },
        }
      : {}),
    key_checks: {
      secret_key: secretKey.startsWith("sk_test_") ? "ok (sk_test_…)" : "unexpected prefix",
      publishable_key: pubKey.startsWith("pk_test_")
        ? "ok (pk_test_…)"
        : pubKey
          ? "unexpected prefix"
          : "missing",
      webhook_secret: webhookSecret.startsWith("whsec_")
        ? "ok (whsec_…)"
        : webhookSecret
          ? "unexpected prefix"
          : "missing",
    },
    prices,
    missing_vars,
  };

  const hasErrors =
    connectivity === "error" ||
    missing_vars.length > 0 ||
    Object.values(prices).some((p) => "error" in p);

  return NextResponse.json(report, { status: hasErrors ? 207 : 200 });
}
