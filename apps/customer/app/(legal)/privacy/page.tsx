import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | AuraZone",
  description: "Learn how AuraZone collects, protects, and handles your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="section-container py-10 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Privacy Policy</h1>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Last updated: October 14, 2026 • Effective Date: January 1, 2026
        </p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed text-sm">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">1. Introduction</h2>
          <p>
            Welcome to AuraZone ("we", "our", or "us"). We are committed to protecting your personal
            information and your right to privacy. This Privacy Policy governs how AuraZone
            Technologies Private Limited collects, uses, maintains, and discloses information
            collected from users of our website, mobile interfaces, and e-commerce services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">2. Information We Collect</h2>
          <p>
            We collect personal information that you provide voluntarily when registering on the
            platform, placing orders, subscribing to newsletters, or contacting our customer support
            team:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Personal Identifiers:</strong> Name, email address, phone number, and physical
              shipping/billing addresses.
            </li>
            <li>
              <strong>Transaction & Payment Information:</strong> Products purchased, order amounts,
              payment gateway IDs (processed securely via PCI-DSS compliant providers like
              Razorpay; we never store your raw CVV or debit/credit card numbers).
            </li>
            <li>
              <strong>Technical & Device Data:</strong> IP address, device type, browser
              specifications, operating system, and session tokens.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">3. How We Use Your Information</h2>
          <p>We use the collected information for specific, legitimate business purposes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Processing, packing, and dispatching your merchandise orders.</li>
            <li>Sending transactional notifications, tracking tokens, and invoices.</li>
            <li>Fraud prevention, account verification, and platform integrity checks.</li>
            <li>Improving customer service and responding to support tickets.</li>
            <li>
              Compliance with applicable legal obligations under Indian Information Technology laws
              and GST requirements.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">4. Sharing Your Information</h2>
          <p>
            We do not sell, trade, or rent users' personal identification information to third
            parties. We share your information only with:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Logistics & Courier Partners:</strong> BlueDart, Delhivery, and India Post to
              fulfill delivery of physical goods to your shipping address.
            </li>
            <li>
              <strong>Payment Processors:</strong> Razorpay for secure processing of online payments.
            </li>
            <li>
              <strong>Law Enforcement:</strong> If required by court order, subpoena, or applicable
              law.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">5. Data Retention & Your Rights</h2>
          <p>
            You have the right to view, update, or request permanent deletion of your personal data
            stored with us. You can edit your profile information or delete your account at any time
            directly from your <a href="/profile" className="text-[var(--color-accent)] underline">Profile Settings</a> page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">6. Contact Data Protection Officer</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data rights,
            please email us at: <a href="mailto:privacy@aurazone.in" className="text-[var(--color-accent)] font-semibold">privacy@aurazone.in</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
