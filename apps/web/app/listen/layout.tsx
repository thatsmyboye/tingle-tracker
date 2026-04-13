import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Listen — Tingle Tracker",
  description:
    "Paste any YouTube ASMR video and tap to log your tingles in real time.",
};

export default function ListenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
