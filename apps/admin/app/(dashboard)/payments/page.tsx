"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CreditCard,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundSuccess, setRefundSuccess] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", search],
    queryFn: () => api.get<any>(`/admin/payments?search=${search}`),
  });

  const refundMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`/admin/payments/${orderId}/refund`, {
        reason: refundReason || "Admin initiated refund",
        amount: refundAmount ? parseFloat(refundAmount) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      setSelectedOrderForRefund(null);
      setRefundReason("");
      setRefundAmount("");
      setRefundSuccess("Refund recorded and processed successfully!");
      setTimeout(() => setRefundSuccess(""), 4000);
    },
    onError: (err: any) => {
      alert(err.message || "Failed to process refund");
    },
  });

  const orders = Array.isArray(data?.data) ? data.data : [];
  const total = (data as any)?.meta?.total ?? orders.length;

  const openRefundModal = (order: any) => {
    setSelectedOrderForRefund(order);
    setRefundAmount(String(Number(order.totalAmount)));
    setRefundReason("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Financial Integrity</p>
          <h1 className="page-title">Payments & Gateway Transactions</h1>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Total recorded orders: <strong className="text-[var(--color-text-primary)]">{total}</strong>
        </p>
      </div>

      {refundSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-semibold animate-in fade-in">
          <CheckCircle size={16} /> {refundSuccess}
        </div>
      )}

      {/* Search Input */}
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3.5 py-2 w-80">
        <Search size={14} className="text-[var(--color-text-tertiary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, payment ID, email..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
        />
      </div>

      {/* Payments Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap min-w-[850px] text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)] uppercase text-[10px] font-bold tracking-wider">
              <th className="px-5 py-3">Order Number</th>
              <th className="px-5 py-3">Gateway Payment ID</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-center">Payment Status</th>
              <th className="px-5 py-3 text-center">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="w-20 h-4 shimmer rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              orders.map((order: any) => {
                const isPaid = order.paymentStatus === "SUCCESS";
                const isRefunded = order.paymentStatus === "REFUNDED";
                const isPartiallyRefunded = order.paymentStatus === "PARTIALLY_REFUNDED";

                return (
                  <tr key={order.id} className="hover:bg-[var(--color-bg-muted)]/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-[var(--color-text-secondary)]">
                      {order.razorpayPaymentId ? (
                        <span className="flex items-center gap-1 text-[var(--color-accent)] font-medium">
                          <ShieldCheck size={12} /> {order.razorpayPaymentId}
                        </span>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--color-text-secondary)]">
                      {order.orderAddress?.name || order.user?.fullName || order.user?.email || "Guest"}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                        <CreditCard size={10} /> {order.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-right text-[var(--color-text-primary)]">
                      ₹{Number(order.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : isRefunded || isPartiallyRefunded
                            ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-center text-[var(--color-text-secondary)]">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {isPaid || isPartiallyRefunded ? (
                        <button
                          onClick={() => openRefundModal(order)}
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors"
                        >
                          <RotateCcw size={12} /> {isPartiallyRefunded ? "Refund More" : "Refund"}
                        </button>
                      ) : isRefunded ? (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                          ✓ Refunded
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {!isLoading && orders.length === 0 && (
          <div className="p-12 text-center">
            <CreditCard size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              No payment records found
            </p>
          </div>
        )}
      </div>

      {/* Independent Refund Initiation Modal */}
      {selectedOrderForRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Initiate Order Refund
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderForRefund(null)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-[var(--color-bg-muted)]/50 p-3.5 rounded-xl border border-[var(--color-border)]">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-tertiary)]">Order Number:</span>
                <span className="font-mono font-bold text-[var(--color-text-primary)]">
                  {selectedOrderForRefund.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-tertiary)]">Total Order Amount:</span>
                <span className="font-bold text-[var(--color-text-primary)]">
                  ₹{Number(selectedOrderForRefund.totalAmount).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-tertiary)]">Payment Ref:</span>
                <span className="font-mono text-[var(--color-accent)]">
                  {selectedOrderForRefund.razorpayPaymentId || "Direct / COD"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Refund Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={Number(selectedOrderForRefund.totalAmount)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs font-semibold outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                Full or partial refund amount. Maximum: ₹{Number(selectedOrderForRefund.totalAmount).toLocaleString()}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
                Refund Reason *
              </label>
              <textarea
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="e.g. Defective item returned by customer, order cancelled prior to dispatch..."
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3 text-xs outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setSelectedOrderForRefund(null)}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => refundMutation.mutate(selectedOrderForRefund.id)}
                disabled={
                  refundMutation.isPending ||
                  !refundAmount ||
                  parseFloat(refundAmount) <= 0 ||
                  parseFloat(refundAmount) > Number(selectedOrderForRefund.totalAmount)
                }
                className="flex-1 rounded-xl bg-purple-600 py-2.5 text-xs font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {refundMutation.isPending ? "Processing..." : "Confirm & Execute Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}