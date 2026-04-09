"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@tingle/ui";
import { ListenerView } from "./_components/ListenerView";
import { CreatorView } from "./_components/CreatorView";

type DemoTab = "listener" | "creator";

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>("listener");

  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-8">
        <div className="flex items-start justify-between">
          <div>
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
          </div>
          <Link
            href="/"
            className="text-xs text-surface-muted hover:text-tingle-aqua flex-shrink-0 mt-1"
          >
            ← Home
          </Link>
        </div>
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
      <div className="max-w-3xl mx-auto px-6 pb-16">
        {activeTab === "listener" ? <ListenerView /> : <CreatorView />}
      </div>
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
