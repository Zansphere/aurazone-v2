"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Search, Edit2, Trash2, Package,
  CheckCircle, XCircle, Eye, Filter,
} from "lucide-react";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  store: { id: string; name: string; slug: string };
  category: { id: string; name: string; slug: string };
  variants: Array<{
    id: string;
    price: number;
    compareAtPrice: number | null;
    images: Array<{ url: string }>;
    inventory?: { quantity: number; reserved?: number } | null;
  }>;
  _count: { variants: number };
}

interface Store {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: storesData } = useQuery({
    queryKey: ["admin", "stores"],
    queryFn: () => api.get<Store[]>("/admin/stores"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", search, storeFilter, page],
    queryFn: () =>
      api.get<Product[]>(
        `/admin/products?search=${search}${storeFilter ? `&storeId=${storeFilter}` : ""}&skip=${(page - 1) * 20}&take=20`
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
  });

  const products = data?.data ?? [];
  const stores = storesData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Catalog</p>
          <h1 className="page-title">Products</h1>
        </div>
        <Link href="/stores" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add Product in Store
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 w-full md:w-72">
          <Search size={14} className="text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
        <select
          value={storeFilter}
          onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
          className="form-input w-48 py-2"
        >
          <option value="">All Stores</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Product
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Store
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Category
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Price
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Stock (Overall Qty)
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Status
              </th>
              <th className="px-5 py-3 w-28 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-5 py-3"><div className="w-40 h-4 shimmer rounded" /></td>
                  <td className="px-5 py-3"><div className="w-20 h-4 shimmer rounded" /></td>
                  <td className="px-5 py-3"><div className="w-24 h-4 shimmer rounded" /></td>
                  <td className="px-5 py-3"><div className="w-16 h-4 shimmer rounded ml-auto" /></td>
                  <td className="px-5 py-3"><div className="w-20 h-5 shimmer rounded mx-auto" /></td>
                  <td className="px-5 py-3"><div className="w-14 h-5 shimmer rounded-full mx-auto" /></td>
                  <td className="px-5 py-3" />
                </tr>
              ))
              : products.map((product) => {
                const price = product.variants[0]?.price;
                const comparePrice = product.variants[0]?.compareAtPrice;
                const imageUrl = product.variants[0]?.images?.[0]?.url;
                const overallStock = product.variants?.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0) ?? 0;
                const variantCount = product._count?.variants ?? product.variants?.length ?? 1;

                return (
                  <tr key={product.id} className="hover:bg-[var(--color-bg-muted)] transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/products/${product.id}`}
                          className="h-10 w-10 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden shrink-0 hover:opacity-85 transition-opacity"
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Package size={16} className="text-[var(--color-text-tertiary)]" />
                          )}
                        </Link>
                        <div>
                          <Link
                            href={`/products/${product.id}`}
                            className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline truncate max-w-[200px] block transition-colors"
                          >
                            {product.name}
                          </Link>
                          <p className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                            /{product.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                      <Link
                        href={`/stores/${product.store.id}`}
                        className="hover:text-[var(--color-accent)] hover:underline transition-colors"
                      >
                        {product.store.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--color-text-secondary)]">
                      {product.category.name}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {"\u20B9"}{Number(price ?? 0).toLocaleString()}
                      </span>
                      {comparePrice && (
                        <span className="ml-1 text-xs text-[var(--color-text-tertiary)] line-through">
                          {"\u20B9"}{Number(comparePrice).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            overallStock <= 0
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : overallStock <= 5
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              overallStock <= 0
                                ? "bg-red-500"
                                : overallStock <= 5
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {overallStock} in stock
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-medium">
                          {variantCount} {variantCount === 1 ? "variant" : "variants"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {product.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                          <CheckCircle size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/products/${product.id}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                          title="View product details"
                        >
                          <Eye size={13} />
                        </Link>
                        <Link
                          href={`/products/${product.id}?edit=true`}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                          title="Edit product"
                        >
                          <Edit2 size={13} />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${product.name}"?`)) deleteMutation.mutate(product.id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
                          title="Delete product"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {!isLoading && products.length === 0 && (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">No products yet</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Add your first product to start selling.
            </p>
          </div>
        )}

        {data?.meta && data.meta.totalPages && data.meta.totalPages > 0 ? (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-3">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.meta.total || 0)} of {data.meta.total} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                Page {page} of {data.meta.totalPages}
              </span>
              <button
                disabled={page === data.meta.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}