import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Tingle Tracker",
  description: "Simple pricing for ASMR creators. Free to start, upgrade when your audience grows.",
};

// =============================================================================
// Pricing page
//
// Static — no auth required. Upgrade CTAs link to /dashboard which will
// trigger the checkout flow once the creator is signed in.
// =============================================================================

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-tingle-aqua hover:opacity-80 transition-opacity">
          <span className="text-lg">✦</span>
          <span className="text-sm font-mono">Tingle Tracker</span>
        </Link>
        <Link href="/demo" className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors">
          Try demo →
        </Link>
      </nav>

      {/* Header */}
      <section className="max-w-4xl mx-auto px-6 pt-10 pb-12 text-center">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">Pricing</p>
        <h1 className="font-serif text-4xl text-white mb-4">
          Simple plans for every creator
        </h1>
        <p className="text-sm text-surface-muted max-w-lg mx-auto leading-relaxed">
          Listeners are always free. Creators get analytics — start free, upgrade when
          you&apos;re ready to go deeper.
        </p>
      </section>

      {/* Tier cards */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free tier */}
          <TierCard
            name="Listener"
            price="Free"
            priceNote="forever"
            description="For fans who want to track their tingle responses and discover new creators."
            highlight={false}
            features={[
              "Log tingles in real time",
              "Personal trigger profile",
              "Intensity tracking (1–5)",
              "Discover creators by trigger",
              "Offline queue (mobile)",
            ]}
            cta="Get started"
            ctaHref="/profile"
            ctaVariant="secondary"
          />

          {/* Creator Pro */}
          <TierCard
            name="Creator Pro"
            price="$12"
            priceNote="/ month  ·  or $99/yr"
            description="For active creators who want to understand what's working in their content."
            highlight={true}
            badge="Most popular"
            features={[
              "Everything in Listener",
              "Unlimited videos",
              "AI trigger analysis (Claude)",
              "Full heatmap + intensity data",
              "Listener aggregate stats",
              "Trigger insights export",
            ]}
            cta="Start free trial"
            ctaHref="/dashboard?upgrade=pro"
            ctaVariant="primary"
          />

          {/* Creator Studio */}
          <TierCard
            name="Creator Studio"
            price="$29"
            priceNote="/ month  ·  or $239/yr"
            description="For power creators and agencies who need deeper control and faster processing."
            highlight={false}
            features={[
              "Everything in Creator Pro",
              "Priority AI processing",
              "Custom trigger taxonomy",
              "Early feature access",
              "Multi-channel support",
            ]}
            cta="Start free trial"
            ctaHref="/dashboard?upgrade=studio"
            ctaVariant="secondary"
          />
        </div>

        {/* FAQ note */}
        <div className="mt-12 rounded-lg border border-surface-border bg-surface-elevated p-6 max-w-2xl mx-auto text-center">
          <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">Early access</p>
          <p className="text-sm text-surface-muted leading-relaxed">
            Tingle Tracker is in early access. Pricing is subject to change —
            early subscribers lock in their rate permanently.{" "}
            <Link href="/demo" className="text-tingle-aqua hover:underline underline-offset-2">
              Try the demo first →
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="font-mono text-xs text-surface-muted">Tingle Tracker · Early access</span>
          <Link href="/demo" className="font-mono text-xs text-surface-muted hover:text-tingle-aqua transition-colors">
            Try demo
          </Link>
        </div>
      </footer>
    </main>
  );
}

// =============================================================================
// TierCard
// =============================================================================

interface TierCardProps {
  name: string;
  price: string;
  priceNote: string;
  description: string;
  highlight: boolean;
  badge?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaVariant: "primary" | "secondary";
}

function TierCard({
  name,
  price,
  priceNote,
  description,
  highlight,
  badge,
  features,
  cta,
  ctaHref,
  ctaVariant,
}: TierCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-xl border p-6 ${
        highlight
          ? "border-tingle-aqua/40 bg-tingle-aqua/5"
          : "border-surface-border bg-surface-elevated"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-tingle-aqua/40 bg-surface px-3 py-0.5 text-[10px] uppercase tracking-widest text-tingle-aqua">
          {badge}
        </span>
      )}

      {/* Name */}
      <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">{name}</p>

      {/* Price */}
      <div className="mb-4">
        <span className="font-serif text-4xl text-white">{price}</span>
        <span className="ml-2 font-mono text-xs text-surface-muted">{priceNote}</span>
      </div>

      <p className="text-sm text-surface-muted leading-relaxed mb-6">{description}</p>

      {/* Features */}
      <ul className="flex-1 space-y-2.5 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-surface-muted">
            <span className="mt-0.5 text-tingle-aqua flex-shrink-0">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={ctaHref}
        className={`block w-full rounded-lg border py-2.5 text-center text-sm transition-colors ${
          ctaVariant === "primary"
            ? "border-tingle-aqua/50 bg-tingle-aqua/15 text-tingle-aqua hover:bg-tingle-aqua/25"
            : "border-surface-border bg-surface text-white hover:border-tingle-aqua/30 hover:text-tingle-aqua"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
