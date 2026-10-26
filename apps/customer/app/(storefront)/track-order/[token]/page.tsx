"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getOrderStatusMeta, ORDER_LIFECYCLE_STEPS } from "@/lib/order-status";
import { calculateGstBreakdown, formatCurrency } from "@/lib/tax";
import { Package, Truck, Check, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function TrackOrderPage() {
  const { token } = useParams() as { token?: string };
  const router = useRouter();
  const [searchToken, setSearchToken] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["track-order", token],
    queryFn: () => api.get<any>(`/orders/track/${token}`),
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return (
      <div className="section-container py-16 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-6 text-[var(--color-text-primary)]">Track Your Order</h1>
        <form onSubmit={(e) => { e.preventDefault(); if (searchToken) router.push(`/track-order/${searchToken}`); }}>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              placeholder="Enter tracking token..."
              className="flex-1 rounded-xl border border-[var(--color-border)] p-3 text-sm outline-none"
              required
            />
            <button type="submit" className="btn-primary rounded-xl px-6 flex items-center gap-2">
              <Search size={16} /> Track
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="section-container py-12 max-w-3xl mx-auto space-y-6">
        <div className="h-32 shimmer rounded-xl" />
        <div className="h-64 shimmer rounded-xl" />
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="section-container py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500 mb-4">
          <Package size={24} />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Order Not Found</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Please check your tracking token and try again.</p>
        <Link href="/track-order" className="mt-6 inline-block text-[var(--color-accent)] font-semibold hover:underline">
          Try another token
        </Link>
      </div>
    );
  }

  const order = data.data;

  // Canonical status metadata and lifecycle step index
  const statusMeta = getOrderStatusMeta(order.status);
  const currentStepIndex = statusMeta.stepIndex;

  // Accurate 18% inclusive GST
  const gst = calculateGstBreakdown(Number(order.totalAmount));

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      await api.post(`/orders/${order.id}/cancel`, { trackingToken: token });
      alert("Order cancelled successfully");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to cancel order");
    }
  };

  return (
    <div className="section-container py-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Track Order</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusMeta.badgeClass}`}>
              {statusMeta.badgeLabel}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Order #{order.orderNumber} • Placed on {new Date(order.createdAt).toLocaleDateString()}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {statusMeta.description}
          </p>
        </div>
        {["PENDING", "RECEIVED"].includes(order.status) && (
          <button 
            onClick={handleCancelOrder}
            className="rounded-lg border border-red-200 bg-red-50 text-red-600 px-4 py-2 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Cancel Order
          </button>
        )}
      </div>

      {/* Status Tracker with Completed, Current, and Pending distinction */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 md:p-8">
        {order.status === "CANCELLED" || order.status === "FAILED" ? (
          <div className="text-center py-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-3">
              <X size={24} />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              {statusMeta.badgeLabel}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{statusMeta.description}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-[var(--color-border)] rounded" />
            <div 
              className="absolute top-5 left-6 h-1 bg-emerald-600 rounded transition-all duration-500"
              style={{ width: `calc(${Math.max(0, currentStepIndex) / (ORDER_LIFECYCLE_STEPS.length - 1)} * (100% - 3rem))` }}
            />
            
            <div className="relative flex justify-between">
              {ORDER_LIFECYCLE_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isPending = index > currentStepIndex;
                
                return (
                  <div key={step.key} className="flex flex-col items-center gap-2 relative z-10 w-24 text-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                      isCompleted
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : isCurrent
                        ? "bg-[var(--color-primary)] border-white text-white ring-4 ring-[var(--color-accent-light)] shadow-md scale-105"
                        : "border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]"
                    }`}>
                      {isCompleted ? <Check size={18} strokeWidth={2.5} /> : <Icon size={16} />}
                    </div>

                    <span className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-[var(--color-primary)] font-bold"
                        : isCompleted
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-tertiary)]"
                    }`}>
                      {step.label}
                    </span>

                    <div>
                      {isCompleted && (
                        <span className="text-[10px] font-semibold text-emerald-600">
                          ✓ Completed
                        </span>
                      )}
                      {isCurrent && (
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent)] bg-[var(--color-accent-light)] px-1.5 py-0.5 rounded-full">
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
      </div>

      {/* Delivery & Items Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Items Ordered</h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {order.items.map((item: any, i: number) => (
              <div key={item.id} className={`flex gap-4 p-4 ${i !== order.items.length - 1 ? "border-b border-[var(--color-border)]" : ""}`}>
                <div className="h-20 w-16 shrink-0 rounded-lg bg-[var(--color-bg-muted)] overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Package size={20} className="text-[var(--color-text-tertiary)]" /></div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">{item.storeName}</p>
                    <Link href={`/product/${item.productSlug}`} className="text-sm font-semibold text-[var(--color-text-primary)] hover:underline line-clamp-2">
                      {item.productName}
                    </Link>
                    <div className="flex gap-2 mt-1 text-xs text-[var(--color-text-secondary)]">
                      {Array.isArray(item.attributesSnapshot) && item.attributesSnapshot.map((a: any) => <span key={a.key}>{a.value}</span>)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Qty: {item.quantity}</span>
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">₹{formatCurrency(Number(item.subtotal))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Delivery Details</h2>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
              <div className="flex gap-3 text-sm text-[var(--color-text-secondary)]">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{order.orderAddress?.name}</p>
                  <p className="mt-1">{order.orderAddress?.addressLine1}</p>
                  {order.orderAddress?.addressLine2 && <p>{order.orderAddress?.addressLine2}</p>}
                  <p>{order.orderAddress?.city}, {order.orderAddress?.state} {order.orderAddress?.postalCode}</p>
                  <p className="mt-2">Phone: {order.orderAddress?.phone}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Payment Summary</h2>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Method</span>
                <span className="font-medium">{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Payment Status</span>
                <span className={`font-medium ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] pt-1">
                <span>Taxable Base Value</span>
                <span>₹{formatCurrency(gst.taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
                <span>Included 18% GST (CGST + SGST)</span>
                <span>₹{formatCurrency(gst.totalGst)}</span>
              </div>
              <div className="pt-3 mt-3 border-t border-[var(--color-border)] flex justify-between text-base font-bold">
                <span>Total (Incl. 18% GST)</span>
                <span>₹{formatCurrency(gst.totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Shipment Details if any */}
      {order.shipments && order.shipments.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Shipments</h2>
          <div className="space-y-4">
            {order.shipments.map((shipment: any) => (
              <div key={shipment.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">Shipment #{shipment.trackingNumber ?? shipment.id.slice(0,8)}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)]">Courier: {shipment.courierName}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                    {shipment.status}
                  </span>
                </div>
                {shipment.trackingUrl && (
                  <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center gap-1">
                    Track on Courier Website <Truck size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
