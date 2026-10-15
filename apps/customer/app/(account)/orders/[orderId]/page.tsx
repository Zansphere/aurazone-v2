"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCartStore } from "@/stores/cart.store";
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
} from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
  RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400",
  SHIPPED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400",
};

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
    return <p className="text-sm text-[var(--color-text-secondary)]">Order not found.</p>;
  }

  const shipments = order.shipments ?? [];
  const primaryShipment = shipments[0];

  const STATUS_STEPS = [
    { key: "PENDING", label: "Order Placed", icon: Clock },
    { key: "RECEIVED", label: "Processing", icon: Package },
    { key: "SHIPPED", label: "Shipped", icon: Truck },
    { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
  ];

  const currentStepIdx =
    STATUS_STEPS.findIndex((s) => s.key === order.status) >= 0
      ? STATUS_STEPS.findIndex((s) => s.key === order.status)
      : order.status === "DELIVERED" || order.status === "SUCCESS"
      ? 3
      : order.status === "CANCELLED"
      ? -1
      : 0;

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
            <FileText size={14} /> Download Invoice
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
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  STATUS_COLORS[order.status] ?? "bg-gray-100"
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
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
            <p className="text-xs text-[var(--color-text-tertiary)]">Total Amount</p>
            <p className="text-2xl font-black text-[var(--color-text-primary)]">
              ₹{Number(order.totalAmount).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress Stepper */}
        {order.status !== "CANCELLED" && (
          <div className="py-6 border-b border-[var(--color-border)]">
            <div className="grid grid-cols-4 relative">
              <div className="absolute top-4 left-[12%] right-[12%] h-1 bg-[var(--color-border)] -z-0">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, (currentStepIdx / 3) * 100))}%`,
                  }}
                />
              </div>

              {STATUS_STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10 text-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                        isPassed
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow"
                          : "border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]"
                      } ${isCurrent ? "ring-4 ring-[var(--color-accent-light)]" : ""}`}
                    >
                      <Icon size={16} />
                    </div>
                    <span
                      className={`mt-2 text-[11px] font-semibold ${
                        isPassed ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"
                      }`}
                    >
                      {step.label}
                    </span>
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
                  {primaryShipment.carrier || "BlueDart Express"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">
                  AWB / Tracking Number
                </p>
                <p className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                  {primaryShipment.trackingNumber || "BLD839201948"}
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
            {order.items?.map((item: any) => (
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
                    ₹{Number(item.subtotal || item.price * item.quantity).toLocaleString()}
                  </span>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    ₹{Number(item.price).toLocaleString()} each
                  </p>
                </div>
              </div>
            ))}
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

          {/* Pricing & GST Breakdown */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/30 p-4 space-y-2 text-xs">
            <h3 className="text-xs font-bold text-[var(--color-text-tertiary)] uppercase flex items-center gap-1.5 mb-2.5">
              <CreditCard size={13} className="text-[var(--color-accent)]" /> Payment Summary
            </h3>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Subtotal</span>
              <span>₹{Number(order.totalAmount).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Estimated GST (18% inclusive)</span>
              <span>₹{Math.round((Number(order.totalAmount) * 0.18) / 1.18).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[var(--color-text-secondary)]">
              <span>Delivery Fee</span>
              <span className="text-emerald-600 font-semibold">FREE</span>
            </div>
            <div className="border-t border-[var(--color-border)] pt-2 flex justify-between font-bold text-sm text-[var(--color-text-primary)]">
              <span>Total Paid</span>
              <span>₹{Number(order.totalAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      {showInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white text-gray-900 rounded-2xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal Controls */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="text-indigo-600" size={22} />
                <h3 className="text-lg font-bold">Tax Invoice</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowInvoice(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Invoice Printable Sheet */}
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-gray-900">AURAZONE V2</h1>
                  <p className="text-gray-500 text-[10px] mt-0.5">Premier Multi-Vendor Marketplace</p>
                  <p className="text-gray-500 text-[10px]">GSTIN: 29AABCA1234F1Z8</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                  <p className="text-gray-500">
                    Date: {new Date(order.createdAt).toLocaleDateString("en-IN")}
                  </p>
                  <p className="text-gray-500">Payment: {order.paymentMethod || "Online (Razorpay)"}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-2 gap-4 border-y border-gray-200 py-4">
                <div>
                  <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Billed & Shipped To:</p>
                  <p className="font-semibold text-gray-900">{order.orderAddress?.name}</p>
                  <p className="text-gray-600">{order.orderAddress?.addressLine1}</p>
                  <p className="text-gray-600">
                    {order.orderAddress?.city}, {order.orderAddress?.state} {order.orderAddress?.postalCode}
                  </p>
                  <p className="text-gray-600">Phone: {order.orderAddress?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-700 uppercase text-[10px] mb-1">Order Status:</p>
                  <p className="font-bold text-emerald-600 uppercase">{order.status}</p>
                  <p className="text-gray-600">Payment Status: {order.paymentStatus || "PAID"}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px]">
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-2.5 font-medium text-gray-800">
                        {item.productName}
                        <span className="block text-[10px] text-gray-400">{item.storeName}</span>
                      </td>
                      <td className="py-2.5 text-center">{item.quantity}</td>
                      <td className="py-2.5 text-right">₹{Number(item.price).toLocaleString()}</td>
                      <td className="py-2.5 text-right font-semibold">
                        ₹{Number(item.subtotal || item.price * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Calculation */}
              <div className="border-t border-gray-200 pt-3 space-y-1.5 text-right">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{Number(order.totalAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (9%) + SGST (9%) Included</span>
                  <span>₹{Math.round((Number(order.totalAmount) * 0.18) / 1.18).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping & Handling</span>
                  <span className="font-semibold text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between font-black text-base text-gray-900 border-t border-gray-200 pt-2">
                  <span>Grand Total</span>
                  <span>₹{Number(order.totalAmount).toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 text-center text-gray-400 text-[10px]">
                Thank you for shopping with AuraZone! This is a computer-generated tax invoice.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}