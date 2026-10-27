"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users, Search, Mail, Phone, ShoppingCart,
  CheckCircle, XCircle, Clock, Download,
} from "lucide-react";

interface Customer {
  id: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  avatar: string | null;
  isActive: boolean;
  isEmailVerified: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { orders: number };
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "customers", search],
    queryFn: () => api.get<Customer[]>(`/admin/customers?search=${search}&take=50`),
  });

  const customers = data?.data ?? [];

  const handleExportCustomers = async () => {
    try {
      await api.download("/admin/export/customers", "aurazone_customers_export.csv");
    } catch (err: any) {
      alert(err.message || "Failed to export customers CSV");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Operations</p>
          <h1 className="page-title">Customers</h1>
        </div>
        <button
          onClick={handleExportCustomers}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--color-bg-muted)] transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 w-80">
        <Search size={14} className="text-[var(--color-text-tertiary)]" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Customer</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Contact</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Orders</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Verified</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Last Login</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-5 py-3"><div className="w-20 h-4 shimmer rounded" /></td>
                ))}</tr>
              ))
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-bg-muted)] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden">
                      {c.avatar ? (
                        <img src={c.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users size={12} className="text-[var(--color-text-tertiary)]" />
                      )}
                    </div>
                    <span className="font-medium text-[var(--color-text-primary)]">{c.fullName ?? "—"}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="space-y-0.5">
                    <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                      <Mail size={10} /> {c.email}
                    </p>
                    {c.phone && (
                      <p className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1">
                        <Phone size={9} /> {c.phone}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                    <ShoppingCart size={11} /> {c._count.orders}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {c.isEmailVerified ? (
                    <CheckCircle size={14} className="mx-auto text-emerald-500" />
                  ) : (
                    <XCircle size={14} className="mx-auto text-[var(--color-text-disabled)]" />
                  )}
                </td>
                <td className="px-5 py-3 text-center">
                  {c.isActive ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                  {c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Never"}
                </td>
                <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                  {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && customers.length === 0 && (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">No customers yet</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Customers will appear here when they register.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
