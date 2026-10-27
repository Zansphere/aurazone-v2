"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, Package, AlertTriangle, Edit2, Check, X, Save, Download } from "lucide-react";

interface InventoryItem {
  id: string;
  quantity: number;
  lowStockThreshold: number;
  variant: {
    id: string;
    sku: string;
    price: number;
    product: { id: string; name: string; slug: string };
    images: Array<{ url: string }>;
  };
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "inventory", search, page],
    queryFn: () => api.get<InventoryItem[]>(`/admin/inventory?search=${search}&skip=${(page - 1) * 20}&take=20`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      api.patch(`/admin/inventory/${variantId}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      setEditingId(null);
    },
  });

  const items = data?.data ?? [];
  const lowStockCount = items.filter(i => i.quantity <= i.lowStockThreshold && i.quantity > 0).length;
  const outOfStockCount = items.filter(i => i.quantity === 0).length;

  const handleExportInventory = async () => {
    try {
      await api.download("/admin/export/inventory", "aurazone_inventory_export.csv");
    } catch (err: any) {
      alert(err.message || "Failed to export inventory CSV");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Operations</p>
          <h1 className="page-title">Inventory</h1>
        </div>
        <button
          onClick={handleExportInventory}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--color-bg-muted)] transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <Package size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">Total Items</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">{items.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">Low Stock</p>
            <p className="text-lg font-bold text-amber-600">{lowStockCount}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase font-semibold">Out of Stock</p>
            <p className="text-lg font-bold text-red-600">{outOfStockCount}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 w-80">
        <Search size={14} className="text-[var(--color-text-tertiary)]" />
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by SKU or product name..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]" />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]">
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Product</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">SKU</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Price</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Stock</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-5 py-3"><div className="w-20 h-4 shimmer rounded" /></td>
                ))}</tr>
              ))
            ) : items.map((item) => {
              const isLow = item.quantity <= item.lowStockThreshold && item.quantity > 0;
              const isOut = item.quantity === 0;
              const isEditing = editingId === item.variant.id;

              return (
                <tr key={item.id} className="hover:bg-[var(--color-bg-muted)] transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden">
                        {item.variant.images?.[0] ? (
                          <img src={item.variant.images[0].url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package size={12} className="text-[var(--color-text-tertiary)]" />
                        )}
                      </div>
                      <span className="font-medium text-[var(--color-text-primary)] truncate max-w-[200px]">
                        {item.variant.product.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-[var(--color-text-secondary)]">{item.variant.sku}</td>
                  <td className="px-5 py-3 text-right font-medium text-[var(--color-text-primary)]">
                    ₹{Number(item.variant.price).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        className="form-input w-20 text-center text-xs py-1 mx-auto"
                        value={editQty}
                        onChange={(e) => setEditQty(parseInt(e.target.value, 10) || 0)}
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-[var(--color-text-primary)]">{item.quantity}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {isOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                        <AlertTriangle size={10} /> Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                        <AlertTriangle size={10} /> Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        In Stock
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => updateMutation.mutate({ variantId: item.variant.id, quantity: editQty })}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          disabled={updateMutation.isPending}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)]"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(item.variant.id); setEditQty(item.quantity); }}
                          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]"
                          title="Adjust stock"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && items.length === 0 && (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">No inventory data available.</p>
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