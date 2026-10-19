"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  ChevronRight,
  Package,
  MapPin,
  CreditCard,
  Truck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  RECEIVED: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  SHIPPED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  FAILED: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400",
  REFUNDED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  PARTIALLY_REFUNDED: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
};

const ALLOWED_ORDER_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RECEIVED", "CANCELLED", "FAILED"],
  RECEIVED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["SUCCESS"],
  SUCCESS: [],
  CANCELLED: [],
  FAILED: [],
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const queryClient = useQueryClient();
  const [transitionError, setTransitionError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => api.get<any>(`/admin/orders/${orderId}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/admin/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      setTransitionError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err: any) => {
      setTransitionError(err.message || "Failed to update order status");
    },
  });

  const order = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 shimmer rounded" />
        <div className="card p-6 h-60 shimmer" />
      </div>
    );
  }

  if (!order) return <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Order not found</div>;

  const validNextStatuses = ALLOWED_ORDER_TRANSITIONS[order.status] || [];
  const isTerminal = validNextStatuses.length === 0;

  const handleStatusChange = (nextStatus: string) => {
    if (nextStatus === order.status) return;

    if (nextStatus === "CANCELLED") {
      const confirmed = window.confirm(
        `Are you sure you want to cancel order ${order.orderNumber}?\n\nThis will automatically restock ${order.items?.length ?? 0} items back into available inventory.`
      );
      if (!confirmed) return;
    }

    updateStatusMutation.mutate(nextStatus);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <Link href="/orders" className="hover:text-[var(--color-text-primary)] flex items-center gap-1">
          <ArrowLeft size={14} /> Orders
        </Link>
        <ChevronRight size={14} />
        <span className="text-[var(--color-text-primary)] font-mono font-medium">{order.orderNumber}</span>
      </div>

      {transitionError && (
        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} /> {transitionError}
        </div>
      )}

      {/* Order Header Card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{order.orderNumber}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${
                STATUS_COLORS[order.status] ?? "bg-gray-100"
              }`}>
                {order.status}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "bg-gray-100"
              }`}>
                Payment: {order.paymentStatus}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
            {order.user && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Customer: <strong>{order.user.fullName ?? order.user.email}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">State Machine Transition:</span>
            <select
              value={order.status}
              disabled={isTerminal || updateStatusMutation.isPending}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="form-input py-1.5 px-3 text-xs w-44 font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-bg-surface)] border-[var(--color-border)]"
            >
              <option value={order.status}>Current: {order.status}</option>
              {validNextStatuses.map((s) => (
                <option key={s} value={s}>
                  → Transition to {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="border-b border-[var(--color-border)] px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <Package size={14} /> Items Snapshot ({order.items?.length ?? 0})
              </h2>
              <span className="text-xs text-[var(--color-text-tertiary)]">Immutable purchase snapshot</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-12 w-12 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--color-border)]">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package size={16} className="text-[var(--color-text-tertiary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{item.productName}</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                      Store: {item.storeName} · Unit Price: ₹{Number(item.price).toLocaleString()} · Qty: {item.quantity}
                    </p>
                    {item.attributesSnapshot && Array.isArray(item.attributesSnapshot) && item.attributesSnapshot.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.attributesSnapshot.map((attr: any, idx: number) => (
                          <span key={idx} className="text-[10px] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded text-[var(--color-text-secondary)]">
                            {attr.key}: {attr.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    ₹{Number(item.subtotal).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--color-border)] px-5 py-3 flex justify-between items-center bg-[var(--color-bg-muted)]/30">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {order.discountAmount > 0 && `(Includes ₹${Number(order.discountAmount).toLocaleString()} discount)`}
              </span>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-tertiary)]">Grand Total</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  ₹{Number(order.totalAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Refunds Section */}
          {order.refunds && order.refunds.length > 0 && (
            <div className="card">
              <div className="border-b border-[var(--color-border)] px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <RotateCcw size={14} /> Recorded Refunds ({order.refunds.length})
                </h2>
                <span className="text-xs font-semibold text-purple-600">
                  Total Refunded: ₹{order.refunds.filter((r: any) => r.status === "SUCCEEDED").reduce((sum: number, r: any) => sum + Number(r.amount), 0).toLocaleString()}
                </span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {order.refunds.map((refund: any) => (
                  <div key={refund.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">
                        Refund of ₹{Number(refund.amount).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                        {refund.reason || "No reason specified"} · Gateway Ref: {refund.gatewayRefundId || "N/A"}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                        Processed on {new Date(refund.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      {refund.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Address */}
          {order.orderAddress && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2 flex items-center gap-1">
                <MapPin size={12} /> Shipping Address
              </h3>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-0.5">
                <p className="font-semibold text-[var(--color-text-primary)]">{order.orderAddress.name}</p>
                <p>{order.orderAddress.addressLine1}</p>
                {order.orderAddress.addressLine2 && <p>{order.orderAddress.addressLine2}</p>}
                <p>{order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}</p>
                {order.orderAddress.phone && <p className="mt-1 font-mono text-xs">{order.orderAddress.phone}</p>}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2 flex items-center gap-1">
              <CreditCard size={12} /> Payment Gateway Info
            </h3>
            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Method</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Payment Status</span>
                <span className="font-semibold text-[var(--color-text-primary)]">{order.paymentStatus}</span>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Payment ID</span>
                  <span className="font-mono text-[var(--color-accent)]">{order.razorpayPaymentId}</span>
                </div>
              )}
              {order.razorpayOrderId && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Order Ref</span>
                  <span className="font-mono text-[var(--color-text-tertiary)]">{order.razorpayOrderId}</span>
                </div>
              )}
            </div>
          </div>

          {/* State Machine Transition Timeline */}
          {order.orderLogs && order.orderLogs.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-3 flex items-center gap-1">
                State Transition History
              </h3>
              <div className="space-y-3">
                {order.orderLogs.map((log: any) => (
                  <div key={log.id} className="flex gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[var(--color-accent)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {log.fromStatus && log.toStatus
                          ? `${log.fromStatus} → ${log.toStatus}`
                          : log.action}
                      </p>
                      {log.note && <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{log.note}</p>}
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                        {new Date(log.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}