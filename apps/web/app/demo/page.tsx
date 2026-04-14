"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { ListenerView } from "./_components/ListenerView";
import { CreatorView } from "./_components/CreatorView";

// generateMetadata can't coexist with "use client" — use a layout or head tag instead.
// The title/description are set via the layout for this route.

type DemoTab = "listener" | "creator";

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>("listener");

  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Branded nav bar */}
      <nav className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between border-b border-surface-border/50">
        <Link
          href="/"
          className="flex items-center gap-2 text-tingle-aqua hover:opacity-80 transition-opacity"
        >
          <span className="text-base">✦</span>
          <span className="text-sm">Tingle Tracker</span>
        </Link>
        <Link
          href="/pricing"
          className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
        >
          Pricing
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-10 pb-8">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-3">
          Interactive Demo
        </p>
        <h1 className="font-serif text-4xl text-white mb-3">
          Try Tingle Tracker
        </h1>
        <p className="text-sm text-surface-muted max-w-xl leading-relaxed">
          Experience both sides of the platform — log tingles in real time
          as a listener, then explore the creator analytics pipeline powered
          by Claude AI.
        </p>
      </section>

      {/* Tab bar */}
      <div className="max-w-3xl mx-auto px-6 mb-8">
        <div className="flex border border-surface-border rounded-lg overflow-hidden">
          <TabButton
            label="Listener Experience"
            active={activeTab === "listener"}
            onClick={() => setActiveTab("listener")}
          />
          <TabButton
            label="Creator Experience"
            active={activeTab === "creator"}
            onClick={() => setActiveTab("creator")}
            borderLeft
          />
        </div>
      </div>

      {/* Panel */}
      <div className="max-w-3xl mx-auto px-6 pb-10">
        {activeTab === "listener" ? <ListenerView /> : <CreatorView />}
      </div>

      {/* Early access CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-xl border border-tingle-aqua/20 bg-tingle-aqua/5 p-6 flex flex-col md:flex-row items-start md:items-center gap-5">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-tingle-aqua/60 mb-1">
              Early access
            </p>
            <p className="text-sm text-white mb-1">Like what you see?</p>
            <p className="text-xs text-surface-muted leading-relaxed">
              Tingle Tracker is in early access. Get notified when creator
              sign-ups open, or reach out directly to join the beta.
            </p>
          </div>
          <a
            href="mailto:paul@banton-digital.com?subject=Early%20access%20request"
            className="flex-shrink-0 rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-5 py-2.5 text-sm text-tingle-aqua hover:bg-tingle-aqua/20 transition-colors whitespace-nowrap"
          >
            Request access →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-border">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-xs text-surface-muted">Tingle Tracker · Early access</span>
          <Link
            href="/"
            className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
          >
            ← Home
          </Link>
        </div>
      </footer>
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
  borderLeft,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  borderLeft?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 px-6 py-3 text-sm transition-colors",
        borderLeft && "border-l border-surface-border",
        active
          ? "bg-tingle-aqua/10 text-tingle-aqua border-b-2 border-tingle-aqua"
          : "text-surface-muted hover:text-white hover:bg-surface-elevated"
      )}
    >
      {label}
    </button>
  );
}
