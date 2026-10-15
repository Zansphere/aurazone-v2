import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Return Policy | AuraZone",
  description: "Learn about AuraZone's 7-day return policy, exchange criteria, and refund timelines.",
};

export default function RefundPolicyPage() {
  return (
    <div className="section-container py-10 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Refund & Return Policy</h1>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Last revised: October 14, 2026 • 7-Day Hassle-Free Returns
        </p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed text-sm">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">1. 7-Day Return Guarantee</h2>
          <p>
            At AuraZone, we want you to be completely satisfied with your purchase. If you receive a
            defective, damaged, or incorrect product, you are entitled to request a return or
            replacement within <strong>7 days</strong> of delivery receipt.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">2. Return Eligibility Criteria</h2>
          <p>To be eligible for a return and full refund, items must fulfill the following:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The item must be in its original packaging with all tags, barcodes, and seals intact.</li>
            <li>The item must be unused, unwashed, and without any signs of wear or damage.</li>
            <li>All accompanying accessories, warranty cards, manuals, and freebies must be included.</li>
            <li>Proof of purchase (invoice or order confirmation number) must be provided.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">3. Non-Returnable Categories</h2>
          <p>
            Due to hygiene and health regulations, the following categories are strictly
            non-returnable unless received in a damaged or expired condition:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Personal care, cosmetics, fragrances, and intimate apparel.</li>
            <li>Perishable goods, food items, and health supplements.</li>
            <li>Digital downloadable products and gift vouchers.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">4. Refund Processing Timeline</h2>
          <p>
            Once our warehouse receives and inspects your returned merchandise (usually within 48–72
            hours of pickup):
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>UPI & Net Banking:</strong> 2 to 4 business days back to your bank account.
            </li>
            <li>
              <strong>Credit / Debit Cards:</strong> 5 to 7 business days depending on your issuing
              bank.
            </li>
            <li>
              <strong>Store Credit / AuraZone Wallet:</strong> Instant credit upon return approval.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">5. How to Initiate a Return</h2>
          <p>
            To initiate a return or refund request, please visit our{" "}
            <a href="/contact" className="text-[var(--color-accent)] underline">Contact Support</a> page or email us at{" "}
            <a href="mailto:returns@aurazone.in" className="text-[var(--color-accent)] font-semibold">returns@aurazone.in</a>{" "}
            with your Order Number and photos of the defective item.
          </p>
        </section>
      </div>
    </div>
  );
}
