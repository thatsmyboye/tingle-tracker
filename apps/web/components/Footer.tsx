import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-surface-border font-mono">
      <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-surface-muted">Tingle Tracker · Early access</span>
        <div className="flex items-center gap-5">
          <Link
            href="/demo"
            className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
          >
            Try demo
          </Link>
          <Link
            href="/privacy"
            className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
