import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Tingle Tracker",
  description: "ASMR companion app — track tingle moments, discover creators",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen bg-surface">
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
