"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ArrowLeft, ChevronRight, Package, MapPin, CreditCard, Truck } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  SUCCESS: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

const ORDER_STATUSES = ["PENDING", "RECEIVED", "SHIPPED", "DELIVERED", "SUCCESS", "CANCELLED"];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "order", orderId],
    queryFn: () => api.get<any>(`/admin/orders/${orderId}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/admin/orders/${orderId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "order", orderId] }),
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <Link href="/orders" className="hover:text-[var(--color-text-primary)] flex items-center gap-1">
          <ArrowLeft size={14} /> Orders
        </Link>
        <ChevronRight size={14} />
        <span className="text-[var(--color-text-primary)] font-mono font-medium">{order.orderNumber}</span>
      </div>

      {/* Order Header */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{order.orderNumber}</h1>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
            {order.user && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {order.user.fullName ?? order.user.email}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_COLORS[order.status] ?? "bg-gray-100"
            }`}>
              {order.status}
            </span>
            <select
              value={order.status}
              disabled={["DELIVERED", "SUCCESS", "CANCELLED"].includes(order.status)}
              onChange={(e) => updateStatusMutation.mutate(e.target.value)}
              className="form-input py-1.5 px-3 text-xs w-36 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 card">
          <div className="border-b border-[var(--color-border)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Package size={14} /> Items ({order.items?.length ?? 0})
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package size={14} className="text-[var(--color-text-tertiary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.productName}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    {item.storeName} · Qty: {item.quantity}
                  </p>
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {"\u20B9"}{Number(item.subtotal).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] px-5 py-3 flex justify-end">
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-tertiary)]">Total</p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {"\u20B9"}{Number(order.totalAmount).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Address */}
          {order.orderAddress && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2 flex items-center gap-1">
                <MapPin size={12} /> Shipping Address
              </h3>
              <div className="text-sm text-[var(--color-text-secondary)] space-y-0.5">
                <p className="font-medium text-[var(--color-text-primary)]">{order.orderAddress.name}</p>
                <p>{order.orderAddress.addressLine1}</p>
                {order.orderAddress.addressLine2 && <p>{order.orderAddress.addressLine2}</p>}
                <p>{order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}</p>
                {order.orderAddress.phone && <p className="mt-1">{order.orderAddress.phone}</p>}
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2 flex items-center gap-1">
              <CreditCard size={12} /> Payment
            </h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Method</span>
                <span className="font-medium text-[var(--color-text-primary)]">{order.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Status</span>
                <span className={`text-xs font-semibold ${
                  order.paymentStatus === "SUCCESS" ? "text-emerald-600" : "text-amber-600"
                }`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {order.orderLogs && order.orderLogs.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-2">
                Timeline
              </h3>
              <div className="space-y-3">
                {order.orderLogs.map((log: any) => (
                  <div key={log.id} className="flex gap-2">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[var(--color-accent)] shrink-0" />
                    <div>
                      <p className="text-xs text-[var(--color-text-primary)]">{log.note ?? log.action}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
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