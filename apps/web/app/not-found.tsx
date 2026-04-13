import Link from "next/link";

// =============================================================================
// 404 — Not found page
// =============================================================================

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface font-mono px-4">
      <span className="text-4xl text-tingle-aqua">✦</span>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-2">404</p>
        <h1 className="font-serif text-3xl text-white mb-3">Page not found</h1>
        <p className="text-sm text-surface-muted">
          That page doesn&apos;t exist or may have moved.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg border border-tingle-aqua/40 bg-tingle-aqua/10 px-5 py-2.5 text-sm text-tingle-aqua hover:bg-tingle-aqua/20"
      >
        ← Back home
      </Link>
    </main>
  );
}
