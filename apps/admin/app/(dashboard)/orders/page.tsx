"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, ShoppingCart, ChevronRight, Clock,
  CheckCircle, XCircle, Truck, Package,
} from "lucide-react";
import Link from "next/link";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  user: { id: string; fullName: string | null; email: string } | null;
  items: Array<{ quantity: number; subtotal: number }>;
  payments: Array<{ status: string }> | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  SUCCESS: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={10} />,
  RECEIVED: <CheckCircle size={10} />,
  SHIPPED: <Truck size={10} />,
  DELIVERED: <Package size={10} />,
  CANCELLED: <XCircle size={10} />,
};

const ORDER_STATUSES = ["PENDING", "RECEIVED", "SHIPPED", "DELIVERED", "SUCCESS", "CANCELLED"];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", search, statusFilter],
    queryFn: () =>
      api.get<Order[]>(
        `/admin/orders?search=${search}${statusFilter ? `&status=${statusFilter}` : ""}`
      ),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "orders"] }),
  });

  const orders = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="page-label">Operations</p>
        <h1 className="page-title">Orders</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 w-full md:w-72">
          <Search size={14} className="text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order # or email..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1 overflow-x-auto">
          <button
            onClick={() => setStatusFilter("")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !statusFilter
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
            }`}
          >
            All
          </button>
          {ORDER_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
              }`}
            >
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Order
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Customer
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Items
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Total
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Date
              </th>
              <th className="px-5 py-3 w-32 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="w-20 h-4 shimmer rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : orders.map((order) => (
                  <tr key={order.id} className="hover:bg-[var(--color-bg-muted)] transition-colors group">
                    <td className="px-5 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-xs font-mono font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {order.user?.fullName ?? "Guest"}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">
                        {order.user?.email ?? ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-[var(--color-text-secondary)]">
                      {order.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-[var(--color-text-primary)]">
                      {"\u20B9"}{Number(order.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_ICONS[order.status]} {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={order.status}
                        disabled={["DELIVERED", "SUCCESS", "CANCELLED"].includes(order.status)}
                        onChange={(e) =>
                          updateStatusMutation.mutate({ id: order.id, status: e.target.value })
                        }
                        className="form-input py-1 px-2 text-xs w-full disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isLoading && orders.length === 0 && (
          <div className="p-12 text-center">
            <ShoppingCart size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">No orders yet</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Orders will appear here when customers start purchasing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}