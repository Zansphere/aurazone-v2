"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Star,
  CheckCircle,
  XCircle,
  Trash2,
  Search,
  MessageSquare,
  ExternalLink,
  Filter,
} from "lucide-react";
import Link from "next/link";

export default function ReviewsModerationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "PENDING" | "APPROVED">("ALL");

  const queryStr = [
    status !== "ALL" ? `status=${status}` : "",
    search ? `search=${encodeURIComponent(search)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reviews", queryStr],
    queryFn: () => api.get<any>(`/admin/reviews?${queryStr}`),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/admin/reviews/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.put(`/admin/reviews/${id}/reject`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/reviews/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }),
  });

  const reviews = Array.isArray(data?.data) ? data.data : [];
  const total = (data as any)?.meta?.total ?? reviews.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Catalog Management</p>
          <h1 className="page-title">Product Review Moderation</h1>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Total reviews: <strong className="text-[var(--color-text-primary)]">{total}</strong>
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3.5 py-2 w-72">
          <Search size={14} className="text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews, products, users..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1 text-xs font-semibold">
          <button
            onClick={() => setStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              status === "ALL"
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatus("PENDING")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              status === "PENDING"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Pending / Hidden
          </button>
          <button
            onClick={() => setStatus("APPROVED")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              status === "APPROVED"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Approved / Published
          </button>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap min-w-[750px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)] uppercase text-[10px] font-bold tracking-wider">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Rating & Feedback</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 w-24 shimmer rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : reviews.length > 0 ? (
              reviews.map((r: any) => (
                <tr key={r.id} className="hover:bg-[var(--color-bg-muted)]/50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-xs text-[var(--color-text-primary)] max-w-xs truncate">
                      {r.product?.name || "Product"}
                    </p>
                    <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                      {r.product?.slug}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-xs text-[var(--color-text-primary)]">
                      {r.user?.fullName || "Anonymous"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">{r.user?.email}</p>
                  </td>
                  <td className="px-5 py-4 max-w-md whitespace-normal">
                    <div className="flex items-center gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={
                            s <= r.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
                          }
                        />
                      ))}
                      <span className="text-[11px] font-bold text-[var(--color-text-primary)] ml-1">
                        {r.rating}/5
                      </span>
                    </div>
                    {r.body ? (
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                        "{r.body}"
                      </p>
                    ) : (
                      <span className="text-[10px] italic text-[var(--color-text-tertiary)]">
                        No review text provided
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        r.isApproved
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      }`}
                    >
                      {r.isApproved ? "Approved" : "Pending Review"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-xs text-[var(--color-text-tertiary)]">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!r.isApproved ? (
                        <button
                          onClick={() => approveMutation.mutate(r.id)}
                          disabled={approveMutation.isPending}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                          title="Approve & Publish Review"
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => rejectMutation.mutate(r.id)}
                          disabled={rejectMutation.isPending}
                          className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors"
                          title="Hide / Unpublish"
                        >
                          <XCircle size={13} /> Hide
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this review?")) {
                            deleteMutation.mutate(r.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Delete Review"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : null}
          </tbody>
        </table>

        {!isLoading && reviews.length === 0 && (
          <div className="p-12 text-center">
            <MessageSquare size={36} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              No reviews found
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Try adjusting your search or status filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
