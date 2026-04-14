import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Tingle Tracker",
  description: "The terms governing your use of Tingle Tracker.",
};

export default function TermsPage() {
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
        <h1 className="font-serif text-4xl text-white mb-2">Terms of Service</h1>
        <p className="text-xs text-surface-muted mb-12">Last updated: April 14, 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) form a legal agreement between you and
            Tingle Tracker (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By creating
            an account or using any part of the Tingle Tracker platform — including the web app,
            mobile app, and API — you agree to be bound by these Terms. If you do not agree, do not
            use the service.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            Tingle Tracker is an ASMR analytics platform that allows:
          </p>
          <ul className="list-disc list-inside space-y-2 text-surface-muted text-sm leading-relaxed mt-2">
            <li>
              <strong className="text-white">Creators</strong> to link YouTube videos and receive
              AI-generated tingle heatmaps and trigger analysis reports.
            </li>
            <li>
              <strong className="text-white">Listeners</strong> to log tingle moments during
              playback, build a personal trigger profile, and discover creators whose content matches
              their most-responsive triggers.
            </li>
          </ul>
          <p className="mt-4">
            The service is in early access and features may change without notice.
          </p>
        </Section>

        <Section title="3. Eligibility">
          <p>
            You must be at least 13 years old (or 16 in the EU/UK) to use Tingle Tracker. By
            agreeing to these Terms you represent that you meet this requirement. Accounts registered
            on behalf of an organisation must be authorised by that organisation.
          </p>
        </Section>

        <Section title="4. Accounts">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activity that occurs under your account. Notify us immediately at{" "}
            <a href="mailto:support@tingletracker.com" className="text-tingle-aqua hover:underline">
              support@tingletracker.com
            </a>{" "}
            if you suspect unauthorised access.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms or that
            have been inactive for an extended period.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-2 text-surface-muted text-sm leading-relaxed mt-2">
            <li>Upload, link, or submit content that you do not have the right to share.</li>
            <li>
              Link videos containing illegal content, hate speech, graphic violence, or sexual
              content involving minors.
            </li>
            <li>Attempt to reverse-engineer, scrape, or circumvent any security measure.</li>
            <li>Use automated means to generate artificial tingle events or manipulate analytics.</li>
            <li>Impersonate another person or entity.</li>
            <li>Violate any applicable law or regulation.</li>
          </ul>
          <p className="mt-4">
            We may remove content and/or suspend accounts that violate these rules without prior
            notice.
          </p>
        </Section>

        <Section title="6. Creator Content &amp; YouTube">
          <p>
            By linking a YouTube video you represent that you have the necessary rights to analyse
            that video through Tingle Tracker. You remain solely responsible for the content of
            linked videos and for compliance with YouTube&apos;s Terms of Service.
          </p>
          <p>
            Tingle Tracker uses the YouTube Data API. Our use is subject to the{" "}
            <a
              href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-tingle-aqua hover:underline"
            >
              YouTube API Services Terms of Service
            </a>
            .
          </p>
        </Section>

        <Section title="7. AI-Generated Reports">
          <p>
            Tingle Tracker uses AI (Claude, by Anthropic) to classify ASMR triggers and generate
            analytics reports. These reports are provided for informational purposes only. We make no
            warranty as to their accuracy, completeness, or fitness for any particular purpose.
            AI-generated insights should be treated as one signal among many, not as definitive
            conclusions about your content.
          </p>
        </Section>

        <Section title="8. Subscriptions &amp; Billing">
          <p>
            Certain features require a paid subscription. Billing is handled by Stripe. Subscriptions
            renew automatically at the end of each billing period unless cancelled. You may cancel at
            any time through your account settings; cancellation takes effect at the end of the
            current paid period with no prorated refund unless otherwise required by law.
          </p>
          <p>
            We reserve the right to change pricing with 30 days&apos; notice to active subscribers.
            Continued use after the notice period constitutes acceptance of the new price.
          </p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>
            Tingle Tracker and its original content, features, and functionality are owned by us and
            protected by applicable intellectual property laws. You retain all rights to your own
            content (videos, tingle data). By using the service you grant us a limited, non-exclusive
            licence to process your content solely to provide the features described.
          </p>
          <p>
            Aggregate, anonymised analytics data derived from user activity may be used by us to
            improve the service and in product communications (e.g., &ldquo;creators receive X tingle
            events per video on average&rdquo;).
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
            warranties of any kind, express or implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, or non-infringement. We do not
            guarantee that the service will be uninterrupted, error-free, or that any defects will be
            corrected.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p>
            To the maximum extent permitted by law, Tingle Tracker shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of profits
            or revenues, whether incurred directly or indirectly, arising from your use of the
            service. Our total liability for any claim arising from these Terms shall not exceed the
            amount you paid us in the 12 months preceding the claim, or $50 USD, whichever is
            greater.
          </p>
        </Section>

        <Section title="12. Indemnification">
          <p>
            You agree to indemnify and hold harmless Tingle Tracker and its officers, directors, and
            employees from any claim, liability, or expense (including reasonable legal fees) arising
            from your use of the service, your content, or your violation of these Terms.
          </p>
        </Section>

        <Section title="13. Governing Law">
          <p>
            These Terms are governed by the laws of the jurisdiction in which Tingle Tracker is
            incorporated, without regard to its conflict of law provisions. Any disputes shall be
            resolved in the courts of that jurisdiction.
          </p>
        </Section>

        <Section title="14. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will notify active users by email for
            material changes at least 14 days before they take effect. Continued use after the
            effective date constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            Questions about these Terms? Email{" "}
            <a
              href="mailto:legal@tingletracker.com"
              className="text-tingle-aqua hover:underline"
            >
              legal@tingletracker.com
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-surface-border flex gap-6">
          <Link href="/privacy" className="text-xs text-surface-muted hover:text-tingle-aqua transition-colors">
            Privacy Policy →
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
