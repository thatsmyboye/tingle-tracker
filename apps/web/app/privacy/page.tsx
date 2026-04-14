import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Tingle Tracker",
  description: "How Tingle Tracker collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-surface font-mono">
      {/* Nav */}
      <nav className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-tingle-aqua hover:opacity-80 transition-opacity">
          <span className="text-lg">✦</span>
          <span className="text-sm">Tingle Tracker</span>
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-widest text-surface-muted mb-4">Legal</p>
        <h1 className="font-serif text-4xl text-white mb-2">Privacy Policy</h1>
        <p className="text-xs text-surface-muted mb-12">Last updated: April 14, 2026</p>

        <Section title="1. Overview">
          <p>
            Tingle Tracker (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is an ASMR analytics platform that
            helps creators understand where tingle responses occur in their content and helps listeners
            discover creators whose triggers match their own. This Privacy Policy explains what
            information we collect, how we use it, and your rights regarding that information.
          </p>
          <p>
            By using Tingle Tracker you agree to the practices described in this policy. If you do not
            agree, please discontinue use.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <SubSection heading="Account information">
            When you create an account we collect your email address and, optionally, a display name.
            Authentication is handled by Supabase Auth; we do not store passwords ourselves.
          </SubSection>
          <SubSection heading="Tingle event data">
            When you log a tingle moment we record the video identifier, the timestamp (milliseconds
            from video start), and an optional intensity rating (1–5). This data is linked to your
            account and used to generate heatmaps and your personal trigger profile.
          </SubSection>
          <SubSection heading="Content metadata">
            Creators who link YouTube videos allow us to fetch publicly available metadata (title,
            description, duration, thumbnails) via the YouTube Data API v3. We store only the YouTube
            video ID, never the full video file.
          </SubSection>
          <SubSection heading="Billing information">
            Payments are processed by Stripe. We do not store credit card numbers. Stripe shares
            limited billing metadata (subscription status, plan) with us to manage your account.
          </SubSection>
          <SubSection heading="Usage data">
            We may collect anonymised usage signals (page views, feature interactions) to improve the
            product. These are not linked to your identity.
          </SubSection>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc list-inside space-y-2 text-surface-muted text-sm leading-relaxed">
            <li>Generate tingle heatmaps and AI-powered trigger reports for creators.</li>
            <li>Build and display your personal trigger profile as a listener.</li>
            <li>Power creator discovery by matching listener trigger profiles to creator content.</li>
            <li>Send transactional emails (account verification, billing receipts).</li>
            <li>Detect and prevent fraud or abuse.</li>
            <li>Comply with legal obligations.</li>
          </ul>
          <p className="mt-4">
            We do not sell your personal data to third parties and do not use it for behavioural
            advertising.
          </p>
        </Section>

        <Section title="4. AI Processing">
          <p>
            Creator content (video transcripts and metadata) is processed by an AI model (Claude,
            provided by Anthropic) to classify ASMR triggers. This processing occurs server-side via
            background jobs. Transcript data is not stored beyond what is needed to generate the
            trigger report; the resulting classifications are stored in your creator dashboard.
          </p>
          <p>
            Tingle event data used to train or improve third-party AI models is anonymised and
            aggregated before any such use; individual tingle logs are not shared with Anthropic.
          </p>
        </Section>

        <Section title="5. Data Sharing">
          <p>We share data only in the following circumstances:</p>
          <ul className="list-disc list-inside space-y-2 text-surface-muted text-sm leading-relaxed mt-2">
            <li>
              <strong className="text-white">Service providers:</strong> Supabase (database &amp;
              auth), Vercel (hosting), Anthropic (AI), Stripe (billing), and Inngest (background
              jobs). Each operates under its own privacy policy and processes data only as needed to
              provide the service.
            </li>
            <li>
              <strong className="text-white">Aggregate creator analytics:</strong> Heatmap data
              displayed on a creator&apos;s dashboard is aggregated across all listeners who watched
              that content; no individual listener is identified.
            </li>
            <li>
              <strong className="text-white">Legal requirements:</strong> We may disclose information
              if required by law, court order, or to protect the rights and safety of Tingle Tracker
              and its users.
            </li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account and tingle event data for as long as your account is active. If
            you delete your account, your personal data and tingle logs are deleted within 30 days.
            Aggregated, anonymised analytics derived from your data may be retained.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction you may have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-surface-muted text-sm leading-relaxed mt-2">
            <li>Access a copy of the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;).</li>
            <li>Object to or restrict certain processing.</li>
            <li>Data portability (receive your tingle logs in machine-readable format).</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, email us at{" "}
            <a
              href="mailto:privacy@tingletracker.com"
              className="text-tingle-aqua hover:underline"
            >
              privacy@tingletracker.com
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            We use essential cookies and local storage to maintain your session and remember
            preferences. We do not use third-party tracking or advertising cookies. You can clear
            cookies at any time through your browser settings; doing so will log you out.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            Tingle Tracker is not directed at children under 13 (or 16 in the EU/UK). We do not
            knowingly collect data from children. If you believe a child has created an account,
            contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this policy from time to time. We will notify active users by email for
            material changes. Continued use after the effective date constitutes acceptance of the
            updated policy.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions or concerns? Email{" "}
            <a
              href="mailto:privacy@tingletracker.com"
              className="text-tingle-aqua hover:underline"
            >
              privacy@tingletracker.com
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-surface-border flex gap-6">
          <Link href="/terms" className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors">
            Terms of Service →
          </Link>
          <Link href="/" className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors">
            Back to home
          </Link>
        </div>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm uppercase tracking-widest text-tingle-aqua mb-4">{title}</h2>
      <div className="space-y-4 text-sm text-surface-muted leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-white text-xs uppercase tracking-wider mb-1">{heading}</p>
      <p className="text-surface-muted text-sm leading-relaxed">{children}</p>
    </div>
  );
}
