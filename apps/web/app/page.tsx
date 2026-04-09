import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tingle Tracker — ASMR analytics for creators",
  description:
    "Listeners tap when they feel a tingle. You see exactly where it happens, which triggers cause it, and how strong it is. AI-powered ASMR analytics.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-tingle-aqua">
          <span className="text-lg">✦</span>
          <span className="text-sm">Tingle Tracker</span>
        </div>
        <Link
          href="/pricing"
          className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
        >
          Pricing
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-14">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-5">
          ASMR analytics platform · Early access
        </p>
        <h1 className="font-serif text-5xl md:text-6xl text-white leading-tight mb-6 max-w-2xl">
          Know exactly when your ASMR lands.
        </h1>
        <p className="text-sm text-surface-muted max-w-xl leading-relaxed mb-10">
          Listeners tap a button the moment they feel a tingle — in real time as
          your video plays. Tingle Tracker turns those moments into a heatmap and
          uses AI to identify which triggers are driving the strongest responses.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors"
          >
            Try the demo →
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-surface-border bg-surface-elevated px-6 py-3 text-sm text-white hover:border-tingle-aqua/30 transition-colors"
          >
            For creators
          </Link>
        </div>
      </section>

      {/* Feature strip */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            symbol="◈"
            symbolColor="text-tingle-aqua"
            title="Tingle Heatmaps"
            body="See the exact seconds where listeners respond. 30-second buckets, crowd-sourced from your whole audience in real time."
          />
          <FeatureCard
            symbol="◎"
            symbolColor="text-tingle-purple"
            title="AI Trigger Analysis"
            body="Claude classifies your content against a curated ASMR trigger taxonomy — whisper tapping, paper sounds, slow hands, and more."
          />
          <FeatureCard
            symbol="◇"
            symbolColor="text-tingle-gold"
            title="Listener Profiles"
            body="Every listener builds a personal trigger profile. Discover creators whose content matches your most-responsive triggers."
          />
        </div>
      </section>

      {/* Demo preview callout */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">
              Interactive demo
            </p>
            <p className="text-white text-sm leading-relaxed mb-1">
              Try both sides of the platform — log tingles as a listener, then
              watch the creator analytics pipeline run in real time.
            </p>
            <p className="text-xs text-surface-muted">
              No sign-up required · Takes about 2 minutes
            </p>
          </div>
          <Link
            href="/demo"
            className="flex-shrink-0 rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-6 py-3 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors whitespace-nowrap"
          >
            See it live →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-xs text-surface-muted">Tingle Tracker · Early access</span>
          <Link
            href="/demo"
            className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
          >
            Try demo
          </Link>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  symbol,
  symbolColor,
  title,
  body,
}: {
  symbol: string;
  symbolColor: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated p-5">
      <span className={`text-2xl ${symbolColor} block mb-3`}>{symbol}</span>
      <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">{title}</p>
      <p className="text-sm text-surface-muted leading-relaxed">{body}</p>
    </div>
  );
}
