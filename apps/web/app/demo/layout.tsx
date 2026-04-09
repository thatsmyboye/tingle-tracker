import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Interactive Demo — Tingle Tracker",
  description:
    "Try Tingle Tracker without signing up. Log tingles in real time as a listener, then see the creator analytics pipeline powered by Claude AI.",
  openGraph: {
    title: "Try Tingle Tracker — Interactive Demo",
    description:
      "Log tingles in real time. See AI-powered trigger analysis and tingle heatmaps. No sign-up required.",
    type: "website",
  },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
