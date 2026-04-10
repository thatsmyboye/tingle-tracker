#!/usr/bin/env tsx
// =============================================================================
// Stripe Sandbox Connectivity Test
//
// Verifies that all Stripe environment variables are set correctly and that
// the configured sandbox price IDs resolve to real products.
//
// Usage (from repo root):
//   pnpm --filter web test:stripe
//
// Or directly (after setting up apps/web/.env.local):
//   tsx --env-file=apps/web/.env.local apps/web/scripts/test-stripe.ts
// =============================================================================

import Stripe from "stripe";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function pass(label: string, detail = "") {
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}

function fail(label: string, detail = "") {
  console.log(`  ${RED}✗${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}

function warn(label: string, detail = "") {
  console.log(`  ${YELLOW}⚠${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ""}`);
}

function section(title: string) {
  console.log(`\n${BOLD}${title}${RESET}`);
  console.log("─".repeat(50));
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

const REQUIRED_VARS = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_STUDIO_MONTHLY",
  "STRIPE_PRICE_STUDIO_YEARLY",
] as const;

const PRICE_VARS = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_STUDIO_MONTHLY",
  "STRIPE_PRICE_STUDIO_YEARLY",
] as const;

async function main() {
  console.log(`\n${BOLD}Stripe Sandbox Connectivity Test${RESET}`);
  console.log("=".repeat(50));

  // ── Section 1: Environment variables ──────────────────────────────────────
  section("1. Environment Variables");

  const missing: string[] = [];
  for (const v of REQUIRED_VARS) {
    const val = process.env[v];
    if (!val) {
      fail(v, "MISSING");
      missing.push(v);
    } else {
      // Redact most of the value for display
      const redacted =
        v.includes("SECRET") || v.includes("KEY")
          ? val.slice(0, 12) + "..." + val.slice(-4)
          : val;
      pass(v, redacted);
    }
  }

  if (missing.length > 0) {
    console.log(`\n${RED}${BOLD}Aborting: ${missing.length} required var(s) missing.${RESET}`);
    console.log("Add them to apps/web/.env.local and re-run.\n");
    process.exit(1);
  }

  // ── Section 2: Key mode validation ────────────────────────────────────────
  section("2. Key Mode");

  const secretKey = process.env.STRIPE_SECRET_KEY!;
  const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

  if (secretKey.startsWith("sk_test_")) {
    pass("STRIPE_SECRET_KEY", "sandbox (sk_test_…)");
  } else if (secretKey.startsWith("sk_live_")) {
    warn("STRIPE_SECRET_KEY", "LIVE key detected — expected a test key for sandbox testing");
  } else {
    fail("STRIPE_SECRET_KEY", "unrecognised prefix");
  }

  if (pubKey.startsWith("pk_test_")) {
    pass("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "sandbox (pk_test_…)");
  } else if (pubKey.startsWith("pk_live_")) {
    warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "LIVE key detected");
  } else {
    fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "unrecognised prefix");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (webhookSecret.startsWith("whsec_")) {
    pass("STRIPE_WEBHOOK_SECRET", "valid format (whsec_…)");
  } else {
    fail("STRIPE_WEBHOOK_SECRET", "expected whsec_ prefix");
  }

  // ── Section 3: API connectivity ───────────────────────────────────────────
  section("3. API Connectivity");

  const stripe = new Stripe(secretKey, { apiVersion: "2026-03-25.dahlia" });

  let balance: Stripe.Balance;
  try {
    balance = await stripe.balance.retrieve();
    const avail = balance.available
      .map((b) => formatAmount(b.amount, b.currency))
      .join(", ");
    pass("stripe.balance.retrieve()", `balance: ${avail}`);
  } catch (err) {
    const msg = err instanceof Stripe.errors.StripeError ? err.message : String(err);
    fail("stripe.balance.retrieve()", msg);
    console.log(`\n${RED}${BOLD}Aborting: cannot reach Stripe API.${RESET}\n`);
    process.exit(1);
  }

  // ── Section 4: Price ID validation ────────────────────────────────────────
  section("4. Price IDs");

  let allPricesOk = true;

  for (const varName of PRICE_VARS) {
    const priceId = process.env[varName]!;
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      const product = price.product as Stripe.Product;
      const amount = formatAmount(price.unit_amount, price.currency);
      const interval = price.recurring?.interval ?? "one-time";
      const status = price.active ? "active" : "inactive";

      if (price.active) {
        pass(
          varName,
          `${product.name}  •  ${amount}/${interval}  •  ${status}  •  ${priceId}`
        );
      } else {
        warn(varName, `${product.name}  •  ${amount}/${interval}  •  INACTIVE  •  ${priceId}`);
        allPricesOk = false;
      }
    } catch (err) {
      const msg = err instanceof Stripe.errors.StripeError ? err.message : String(err);
      fail(varName, `${priceId}  →  ${msg}`);
      allPricesOk = false;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  section("Summary");

  if (allPricesOk) {
    console.log(`  ${GREEN}${BOLD}All checks passed. Stripe sandbox is configured correctly.${RESET}\n`);
  } else {
    console.log(`  ${YELLOW}${BOLD}Some checks failed. Review the output above.${RESET}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${RED}Unexpected error:${RESET}`, err);
  process.exit(1);
});
