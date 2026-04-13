import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Browse Content — Tingle Tracker",
  description: "Browse ASMR content and log your tingle moments in real time.",
};

export default function ListenLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
