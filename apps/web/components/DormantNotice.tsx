import Link from "next/link";

// =============================================================================
// DormantNotice
//
// Shown in place of any interactive surface that is switched off while the app
// is dormant. Always points at /demo, which stays fully functional — it runs
// entirely on local state with no Supabase, no API routes and no external calls.
// =============================================================================

interface DormantNoticeProps {
  /** What is unavailable, e.g. "Account sign-up". Used as the heading. */
  title?: string;
  /** One line explaining what the visitor can do instead. */
  detail?: string;
  /** Render without the full-page wrapper, for inline use inside a card. */
  inline?: boolean;
}

export function DormantNotice({
  title = "Tingle Tracker is dormant",
  detail = "This part of the app is paused for now. The interactive demo is still fully playable.",
  inline = false,
}: DormantNoticeProps) {
  const body = (
    <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-elevated p-6 text-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-tingle-gold">
        Paused
      </p>
      <h2 className="mb-2 font-serif text-xl text-white">{title}</h2>
      <p className="mb-6 font-mono text-xs leading-relaxed text-surface-muted">
        {detail}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/demo"
          className="rounded-lg border border-tingle-aqua/50 bg-tingle-aqua/10 px-5 py-2.5 font-mono text-xs text-tingle-aqua transition-colors hover:bg-tingle-aqua/20"
        >
          Try the demo →
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-surface-border px-5 py-2.5 font-mono text-xs text-surface-muted transition-colors hover:text-tingle-aqua"
        >
          Back home
        </Link>
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      {body}
    </main>
  );
}
