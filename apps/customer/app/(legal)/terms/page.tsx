import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | AuraZone",
  description: "Terms and conditions governing use of the AuraZone e-commerce platform.",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="section-container py-10 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Terms & Conditions</h1>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Last revised: October 14, 2026 • Governed by Indian Jurisdiction
        </p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed text-sm">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the AuraZone platform (including websites, mobile services, and
            APIs), you agree to be bound by these Terms and Conditions and all applicable laws and
            regulations. If you do not agree with any of these terms, you are prohibited from using or
            accessing this site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">2. User Accounts & Security</h2>
          <p>
            To place orders, you may create an account or check out as a guest. When creating an
            account, you are responsible for maintaining the confidentiality of your credentials and
            for restricting access to your computer or mobile device. You agree to accept
            responsibility for all activities that occur under your account.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">3. Product Descriptions & Pricing</h2>
          <p>
            We attempt to be as accurate as possible in product descriptions, images, and pricing.
            However, we do not warrant that product descriptions or other content is 100% error-free.
            In the event that an item is listed at an incorrect price due to typographical error or
            pricing calculation error, AuraZone reserves the right to cancel any orders placed for
            items listed at the incorrect price.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">4. Payment & Order Acceptance</h2>
          <p>
            All orders placed through AuraZone are subject to our acceptance. We may accept, decline,
            or place quantity limits on any order. Payments are processed securely via approved
            payment gateways. Your receipt of an electronic order confirmation does not signify our
            acceptance of your order.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">5. Multi-Vendor Marketplace Disclaimer</h2>
          <p>
            AuraZone operates as an online marketplace connecting independent registered stores and
            customers. While AuraZone enforces quality, packaging, and delivery standards,
            individual merchant stores are directly responsible for genuine product manufacturing,
            statutory warranty claims, and regulatory licensing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">6. Governing Law & Dispute Resolution</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of India. Any
            disputes arising out of or related to these terms shall be subject to the exclusive
            jurisdiction of the courts situated in Bangalore, Karnataka.
          </p>
        </section>
      </div>
    </div>
  );
}
