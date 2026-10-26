/**
 * Standard Indian Goods & Services Tax (GST) Utilities
 * Standard Rate: 18% (9% CGST + 9% SGST)
 *
 * In AuraZone, all catalog product prices are inclusive of 18% GST.
 */

export interface GstBreakdown {
  totalAmount: number;     // Grand Total (inclusive)
  taxableAmount: number;   // Net Taxable Base Price (before GST)
  cgst: number;            // 9% Central GST
  sgst: number;            // 9% State GST
  totalGst: number;        // Combined 18% GST (CGST + SGST)
  gstRatePercent: number;  // 18
}

/**
 * Calculates accurate 18% inclusive GST breakdown for any price.
 * Formula:
 *   Taxable Amount = Price / 1.18
 *   Total GST (18%) = Price - Taxable Amount = (Price * 18) / 118
 *   CGST (9%) = Total GST / 2
 *   SGST (9%) = Total GST / 2
 */
export function calculateGstBreakdown(taxInclusiveAmount: number): GstBreakdown {
  const total = Number(taxInclusiveAmount) || 0;
  if (total <= 0) {
    return {
      totalAmount: 0,
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      totalGst: 0,
      gstRatePercent: 18,
    };
  }

  const taxableAmount = Math.round((total / 1.18) * 100) / 100;
  const totalGst = Math.round((total - taxableAmount) * 100) / 100;
  const cgst = Math.round((totalGst / 2) * 100) / 100;
  const sgst = Math.round((totalGst - cgst) * 100) / 100;

  return {
    totalAmount: total,
    taxableAmount,
    cgst,
    sgst,
    totalGst,
    gstRatePercent: 18,
  };
}

/**
 * Returns formatted integer or decimal currency string for India (₹).
 */
export function formatCurrency(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}
