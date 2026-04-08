import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
