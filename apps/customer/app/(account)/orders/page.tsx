"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart, ChevronRight, Search, Truck, Hash, Mail, ArrowRight, ShieldCheck, Clock, Package } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { getOrderStatusMeta } from "@/lib/order-status";

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Search / Lookup state for guests or other devices
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const orders = Array.isArray(data?.data) ? data.data : [];

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError("");
    setIsSearching(true);

    try {
      const res = await api.get<{ trackingToken: string }>(
        `/orders/track/lookup?orderNumber=${encodeURIComponent(lookupOrderNumber.trim())}&email=${encodeURIComponent(lookupEmail.trim())}`
      );

      if (res.data?.trackingToken) {
        router.push(`/track-order/${res.data.trackingToken}`);
      } else {
        setSearchError("No order found matching this Order Number and Email.");
      }
    } catch (err: any) {
      setSearchError(err.message || "Order not found. Please verify your order number and email address.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Guest Mode Notice */}
      {!isAuthenticated && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 text-xs font-semibold">
                  Guest Orders
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">Session Active</span>
              </div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mt-1.5">
                Orders Placed on this Device
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 max-w-xl">
                As a guest, orders placed in this browser session appear below. You can also look up any order placed with your email address.
              </p>
            </div>
            <Link
              href="/login"
              className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
            >
              Sign In to Sync
            </Link>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {isAuthenticated ? "Order History" : "Recent Orders"}
          </h2>
          {orders.length > 0 && (
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 shimmer rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] py-12 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)] mx-auto mb-3">
              <ShoppingCart size={28} />
            </div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">No orders in this session</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              {isAuthenticated
                ? "You haven't placed any orders yet. Start exploring our latest products!"
                : "You haven't placed any orders in this browser session yet. Use the Order Finder below if you placed an order earlier."}
            </p>
            <Link
              href="/products"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
            >
              Start Shopping <ArrowRight size={13} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const statusMeta = getOrderStatusMeta(order.status);
              return (
              <div
                key={order.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm hover:border-[var(--color-accent)] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1 flex items-center gap-1.5">
                      <Clock size={12} />
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0} item
                      {(order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-[var(--color-text-primary)]">
                      ₹{Number(order.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 gap-2">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-xs font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
                  >
                    View Order Details <ChevronRight size={14} />
                  </Link>

                  {order.trackingToken && (
                    <Link
                      href={`/track-order/${order.trackingToken}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                    >
                      <Truck size={13} className="text-emerald-600" /> Track Live
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Guest Order Lookup Box */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
            <Search size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Find Any Order by Order # & Email
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Placed an order as a guest or on another device? Look it up to view details and live status.
            </p>
          </div>
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Order Number (e.g. ORD-1234)"
                value={lookupOrderNumber}
                onChange={(e) => setLookupOrderNumber(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-9 pr-3 py-2.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] font-mono transition-colors"
              />
              <Hash size={14} className="absolute left-3 top-3 text-[var(--color-text-tertiary)]" />
            </div>
          </div>

          <div>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="Email used during checkout"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-9 pr-3 py-2.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <Mail size={14} className="absolute left-3 top-3 text-[var(--color-text-tertiary)]" />
            </div>
          </div>

          {searchError && (
            <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-xs text-red-600 dark:text-red-400">
              {searchError}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSearching}
              className="w-full sm:w-auto rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Search size={14} />
              {isSearching ? "Searching Order..." : "Find & Track Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}