"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCartStore } from "@/stores/cart.store";
import { getOrderStatusMeta, ORDER_LIFECYCLE_STEPS } from "@/lib/order-status";
import { calculateGstBreakdown, formatCurrency } from "@/lib/tax";
import {
  ArrowLeft,
  Package,
  MapPin,
  CreditCard,
  Truck,
  ExternalLink,
  Printer,
  RotateCcw,
  CheckCircle2,
  Clock,
  Check,
  FileText,
  X,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { addToCart } = useCartStore();

  const [reordering, setReordering] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.get<any>(`/orders/${orderId}`),
  });

  const order = data?.data;

  const handleBuyAgain = async () => {
    if (!order?.items) return;
    setReordering(true);
    try {
      for (const item of order.items) {
        if (item.variantId) {
          await addToCart(item.variantId, item.quantity || 1);
        }
      }
      router.push("/cart");
    } catch {
      alert("Failed to re-add some items to cart");
    } finally {
      setReordering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 shimmer rounded" />
        <div className="h-40 shimmer rounded-xl" />
        <div className="h-32 shimmer rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-[var(--color-text-tertiary)]" />
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Order not found</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">
          The requested order could not be loaded or you may need to enter a tracking token.
        </p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white mt-2"
        >
          <ArrowLeft size={14} /> Back to Orders
        </Link>
      </div>
    );
  }

  const shipments = order.shipments ?? [];
  const primaryShipment = shipments[0];

  // Canonical status metadata and lifecycle step index
  const statusMeta = getOrderStatusMeta(order.status);
  const currentStepIdx = statusMeta.stepIndex;

  // Accurate 18% inclusive GST breakdown
  const gst = calculateGstBreakdown(Number(order.totalAmount));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} /> Back to Orders
        </Link>

        <div className="flex items-center gap-2.5">
          {/* Download / Print Invoice Button */}
          <button
            onClick={() => setShowInvoice(true)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors shadow-sm"
          >
            <FileText size={14} /> Tax Invoice
          </button>

          {/* Buy Again Button */}
          <button
            onClick={handleBuyAgain}
            disabled={reordering}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-sm disabled:opacity-50"
          >
            <RotateCcw size={14} className={reordering ? "animate-spin" : ""} />
            {reordering ? "Adding..." : "Buy Again"}
          </button>
        </div>
      </div>

      {/* Order Info Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-[var(--color-border)]">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] font-mono">
                {order.orderNumber}
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusMeta.badgeClass}`}
              >
                {statusMeta.badgeLabel}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 font-medium">
              {statusMeta.description}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
              Placed on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs text-[var(--color-text-tertiary)]">Total Amount (Incl. GST)</p>
            <p className="text-2xl font-black text-[var(--color-text-primary)]">
              ₹{formatCurrency(gst.totalAmount)}
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
              Includes ₹{formatCurrency(gst.totalGst)} standard 18% GST
            </p>
          </div>
        </div>

        {/* Progress Stepper with Clear Distinction between Completed, Current, and Pending stages */}
        {order.status !== "CANCELLED" && order.status !== "FAILED" && (
          <div className="py-8 border-b border-[var(--color-border)]">
            <div className="grid grid-cols-4 relative">
              {/* Connecting Background Line */}
              <div className="absolute top-4 left-[12%] right-[12%] h-1 bg-[var(--color-border)] -z-0">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, (currentStepIdx / 3) * 100))}%`,
                  }}
                />
              </div>

              {ORDER_LIFECYCLE_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                const isPending = idx > currentStepIdx;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10 text-center px-1">
                    {/* Circle Node */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                        isCompleted
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                          : isCurrent
                          ? "border-white bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-accent-light)] shadow-lg scale-105"
                          : "border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {isCompleted ? <Check size={18} strokeWidth={2.5} /> : <Icon size={16} />}
                    </div>

                    {/* Step Label */}
                    <span
                      className={`mt-2.5 text-xs font-semibold ${
                        isCurrent
                          ? "text-[var(--color-primary)] font-bold"
                          : isCompleted
                          ? "text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {step.label}
                    </span>

                    {/* Stage Status Tag (Completed vs Current vs Upcoming) */}
                    <div className="mt-1">
                      {isCompleted && (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Completed
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 rounded-full">
                          Current Stage
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                          Upcoming
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courier / Shipment Tracking Details */}
        {primaryShipment ? (
          <div className="py-5 border-b border-[var(--color-border)]">
            <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Truck size={14} className="text-[var(--color-accent)]" /> Courier & Shipping Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl bg-[var(--color-bg-muted)]/50 p-4 border border-[var(--color-border)]">
              <div>
                <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">
                  Carrier / Courier
                </p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {primaryShipment.carrier || "Express Courier"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">
                  AWB / Tracking Number
                </p>
                <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  {primaryShipment.trackingNumber || "In Transit"}
                </p>
              </div>
              <div className="flex items-center sm:justify-end">
                {primaryShipment.trackingUrl ? (
                  <a
                    href={primaryShipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    Track on Carrier Site <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                    ✓ In Transit
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 border-b border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Truck size={14} className="text-[var(--color-accent)]" /> Standard Delivery
            </span>
            <span className="font-semibold text-emerald-600">Dispatched within 24–48 hours</span>
          </div>
        )}

        {/* Order Items */}
        <div className="pt-5 space-y-4">
          <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
            Purchased Items ({order.items?.length || 0})
          </h3>
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            {order.items?.map((item: any) => {
              const itemTotal = Number(item.subtotal || item.price * item.quantity);
              return (
                <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-[var(--color-bg-muted)]/30 transition-colors">
                  <div className="h-14 w-14 rounded-xl bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--color-border)]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={20} className="text-[var(--color-text-tertiary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {item.storeName} · Quantity: <strong>{item.quantity}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
                      ₹{formatCurrency(itemTotal)}
                    </span>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      ₹{formatCurrency(Number(item.price))} each (Incl. GST)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown & Delivery Address */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t border-[var(--color-border)]">
          {/* Address */}
          {order.orderAddress && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 p-4">
              <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase flex items-center gap-1.5 mb-2.5">
                <MapPin size={13} className="text-[var(--color-accent)]" /> Delivery Address
              </h3>
              <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                <p className="font-bold text-[var(--color-text-primary)] text-sm">
                  {order.orderAddress.name}
                </p>
                <p>{order.orderAddress.addressLine1}</p>
                {order.orderAddress.addressLine2 && <p>{order.orderAddress.addressLine2}</p>}
                <p>
                  {order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}
                </p>
                <p className="text-[var(--color-text-tertiary)] pt-1">
                  Phone: {order.orderAddress.phone || "On File"}
                </p>
              </div>
            </div>
          )}

          {/* Pricing & GST Breakdown (Standard 18% GST) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 p-4 space-y-2 text-xs">
            <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase flex items-center gap-1.5 mb-2.5">
              <CreditCard size={13} className="text-[var(--color-accent)]" /> Payment Summary
            </h3>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Gross Product Amount</span>
              <span>₹{formatCurrency(gst.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Taxable Base Value (Before GST)</span>
              <span>₹{formatCurrency(gst.taxableAmount)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>CGST (9%) Included</span>
              <span>₹{formatCurrency(gst.cgst)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>SGST (9%) Included</span>
              <span>₹{formatCurrency(gst.sgst)}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Delivery Fee</span>
              <span className="text-emerald-600 font-semibold">FREE</span>
            </div>
            <div className="border-t border-[var(--color-border)] pt-2 flex justify-between font-bold text-sm text-[var(--color-text-primary)]">
              <span>Total Paid (Inclusive of 18% GST)</span>
              <span>₹{formatCurrency(gst.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Invoice Modal with Single-Page PDF Print Isolation */}
      {showInvoice && (
        <div
          id="printable-invoice-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            id="printable-invoice-sheet"
            className="relative w-full max-w-2xl bg-white text-gray-900 rounded-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            {/* Modal Controls (Hidden in Print) */}
            <div className="no-print flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-600" size={22} />
                <h3 className="text-lg font-bold">Tax Invoice</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Printer size={14} /> Print & Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoice(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice Printable Sheet Content */}
            <div className="space-y-5 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-gray-900">AURAZONE</h1>
                  <p className="text-gray-500 text-[10px] mt-0.5">Premier Multi-Vendor Marketplace</p>
                  <p className="text-gray-500 text-[10px]">GSTIN: 29AABCA1234F1Z8</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm text-gray-900">{order.orderNumber}</p>
                  <p className="text-gray-500 text-[11px]">
                    Date: {new Date(order.createdAt).toLocaleDateString("en-IN")}
                  </p>
                  <p className="text-gray-500 text-[11px]">Payment: {order.paymentMethod || "Online (Razorpay)"}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-2 gap-4 border-y border-gray-200 py-3.5">
                <div>
                  <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Billed & Shipped To:</p>
                  <p className="font-semibold text-gray-900">{order.orderAddress?.name}</p>
                  <p className="text-gray-600">{order.orderAddress?.addressLine1}</p>
                  {order.orderAddress?.addressLine2 && <p className="text-gray-600">{order.orderAddress.addressLine2}</p>}
                  <p className="text-gray-600">
                    {order.orderAddress?.city}, {order.orderAddress?.state} {order.orderAddress?.postalCode}
                  </p>
                  <p className="text-gray-600">Phone: {order.orderAddress?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Order Status:</p>
                  <p className="font-bold text-emerald-600 uppercase">{statusMeta.badgeLabel}</p>
                  <p className="text-gray-600">Payment: {order.paymentStatus || "PAID"}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price (Incl. GST)</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items?.map((item: any) => {
                    const rowTotal = Number(item.subtotal || item.price * item.quantity);
                    return (
                      <tr key={item.id}>
                        <td className="py-2 font-medium text-gray-800">
                          {item.productName}
                          <span className="block text-[10px] text-gray-400">{item.storeName}</span>
                        </td>
                        <td className="py-2 text-center">{item.quantity}</td>
                        <td className="py-2 text-right">₹{formatCurrency(Number(item.price))}</td>
                        <td className="py-2 text-right font-semibold">
                          ₹{formatCurrency(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Total & Tax Calculation */}
              <div className="border-t border-gray-200 pt-3 space-y-1 text-right text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Gross Item Total</span>
                  <span>₹{formatCurrency(gst.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Taxable Base Value (Before GST)</span>
                  <span>₹{formatCurrency(gst.taxableAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (9%) Included</span>
                  <span>₹{formatCurrency(gst.cgst)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST (9%) Included</span>
                  <span>₹{formatCurrency(gst.sgst)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Charges</span>
                  <span className="font-semibold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between font-black text-sm text-gray-900 border-t border-gray-200 pt-2 mt-1">
                  <span>Grand Total (Incl. 18% GST)</span>
                  <span>₹{formatCurrency(gst.totalAmount)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 text-center text-gray-400 text-[10px]">
                Thank you for shopping with AuraZone! This is an official computer-generated tax invoice.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Print Styles for Perfect Single-Page PDF Invoice Output */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          /* Hide every background page element during print */
          body * {
            visibility: hidden !important;
          }
          /* Make only the invoice modal and its contents visible */
          #printable-invoice-modal,
          #printable-invoice-modal * {
            visibility: visible !important;
          }
          #printable-invoice-modal {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            display: block !important;
            z-index: 999999 !important;
          }
          #printable-invoice-sheet {
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 16px 20px !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}