import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | AuraZone",
  description: "Learn about AuraZone's delivery speeds, shipping rates, and serviceable pincodes.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="section-container py-10 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Shipping & Delivery Policy</h1>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Last revised: October 14, 2026 • Fast, Reliable Pan-India Delivery
        </p>
      </div>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-[var(--color-text-secondary)] leading-relaxed text-sm">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">1. Serviceable Areas</h2>
          <p>
            AuraZone partners with top-tier logistics providers (including BlueDart, Delhivery, and
            Ecom Express) to deliver to over 19,000+ PIN codes across India. You can verify your exact
            pincode serviceability directly on any product page using our live Pincode Checker.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">2. Delivery Options & Charges</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[var(--color-border)] rounded-xl overflow-hidden">
              <thead className="bg-[var(--color-bg-muted)] text-[var(--color-text-primary)] uppercase">
                <tr>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Estimated Time</th>
                  <th className="py-2.5 px-4">Order Value & Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                <tr>
                  <td className="py-2.5 px-4 font-semibold">Standard Shipping</td>
                  <td className="py-2.5 px-4">3 to 5 business days</td>
                  <td className="py-2.5 px-4">FREE for orders above ₹499 (₹49 for orders below ₹499)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold">Express Shipping</td>
                  <td className="py-2.5 px-4">1 to 2 business days (Metro areas)</td>
                  <td className="py-2.5 px-4">₹99 flat fee</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">3. Order Processing & Dispatch</h2>
          <p>
            Orders placed before 2:00 PM IST on business days are dispatched on the same day from
            our regional fulfillment hubs. Orders placed on Sundays or public holidays are
            dispatched on the next business day.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">4. Tracking Your Consignment</h2>
          <p>
            Once your order is handed over to the courier partner, you will receive an automated
            dispatch notification containing your unique AWB tracking number and public live
            tracking link. You can track your shipment anytime via the{" "}
            <a href="/track-order" className="text-[var(--color-accent)] underline">Track Order</a> page.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">5. Damaged Packages & Non-Delivery</h2>
          <p>
            If your package appears tampered with or damaged at the time of delivery, please refuse
            to accept the parcel and immediately contact our customer support team at{" "}
            <a href="mailto:support@aurazone.in" className="text-[var(--color-accent)] font-semibold">support@aurazone.in</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
