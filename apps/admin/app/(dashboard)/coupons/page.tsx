"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Calendar,
  Layers,
  Sparkles,
  Search,
  Check,
  X,
  Package,
  Eye,
} from "lucide-react";

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["coupons", page],
    queryFn: () => api.get<any>(`/admin/coupons?skip=${(page - 1) * 20}&take=20`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/coupons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coupons"] }),
  });

  const handleEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      deleteMutation.mutate(id);
    }
  };

  const openNewModal = () => {
    setEditingCoupon(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Coupons & Promotions
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Manage discount codes, product-specific assignments, and storefront promotional banners.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors shadow-sm"
        >
          <Plus size={16} /> New Coupon
        </button>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[750px]">
            <thead className="bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-6 py-4 font-semibold">Code & Campaign</th>
                <th className="px-6 py-4 font-semibold">Discount</th>
                <th className="px-6 py-4 font-semibold">Target Scope</th>
                <th className="px-6 py-4 font-semibold">Storefront Banner</th>
                <th className="px-6 py-4 font-semibold">Usage</th>
                <th className="px-6 py-4 font-semibold">Validity</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                    Loading coupons...
                  </td>
                </tr>
              ) : data?.data?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                    No coupons found. Create your first campaign!
                  </td>
                </tr>
              ) : (
                data?.data?.map((coupon: any) => {
                  const assignedCount = coupon.products?.length ?? coupon._count?.products ?? 0;
                  return (
                    <tr key={coupon.id} className="hover:bg-[var(--color-bg-muted)]/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-[var(--color-text-primary)]">
                        <div className="flex items-center gap-2">
                          <Tag size={14} className="text-[var(--color-accent)]" /> {coupon.code}
                        </div>
                        <div className="text-xs font-sans font-normal text-[var(--color-text-secondary)] mt-0.5 max-w-[200px] truncate">
                          {coupon.description || "No description"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {coupon.discountType === "PERCENTAGE"
                          ? `${coupon.discountValue}%`
                          : `₹${coupon.discountValue}`}
                        {coupon.maxDiscount && (
                          <div className="text-xs text-[var(--color-text-tertiary)] font-normal">
                            Up to ₹{coupon.maxDiscount}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {coupon.isProductSpecific ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200">
                            <Package size={13} /> {assignedCount} Product{assignedCount !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                            <Layers size={12} /> All Products
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {coupon.showInStorefront ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                            <Sparkles size={11} className="text-emerald-500" /> Active Banner
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-text-tertiary)]">Hidden</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {coupon.usedCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : "used"}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {coupon.startDate || coupon.endDate ? (
                          <div className="flex flex-col gap-1 text-[var(--color-text-secondary)]">
                            {coupon.startDate && (
                              <span>From: {new Date(coupon.startDate).toLocaleDateString()}</span>
                            )}
                            {coupon.endDate && (
                              <span>To: {new Date(coupon.endDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--color-text-tertiary)]">Forever</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            coupon.isActive
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-gray-100 text-gray-700 border border-gray-200"
                          }`}
                        >
                          {coupon.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(coupon)}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors rounded-lg hover:bg-[var(--color-bg-muted)]"
                            title="Edit Coupon"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon.id)}
                            className="p-2 text-[var(--color-text-secondary)] hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                            title="Delete Coupon"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <CouponModal
          coupon={editingCoupon}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

function CouponModal({ coupon, onClose }: { coupon?: any; onClose: () => void }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    code: coupon?.code || "",
    description: coupon?.description || "",
    discountType: coupon?.discountType || "PERCENTAGE",
    discountValue: coupon?.discountValue || "",
    minOrderValue: coupon?.minOrderValue || "",
    maxDiscount: coupon?.maxDiscount || "",
    usageLimit: coupon?.usageLimit || "",
    startDate: coupon?.startDate ? new Date(coupon.startDate).toISOString().split("T")[0] : "",
    endDate: coupon?.endDate ? new Date(coupon.endDate).toISOString().split("T")[0] : "",
    isActive: coupon?.isActive ?? true,
    storeId: coupon?.storeId || "",
    isProductSpecific: coupon?.isProductSpecific ?? false,
    showInStorefront: coupon?.showInStorefront ?? false,
    bannerText: coupon?.bannerText || "",
    bannerColor: coupon?.bannerColor || "indigo",
  });

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (!coupon?.products) return [];
    return coupon.products.map((p: any) => p.productId || p.product?.id || p.id).filter(Boolean);
  });

  const [productSearch, setProductSearch] = useState("");

  // Fetch catalog products for product-specific coupon assignment
  const { data: catalogProductsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ["admin", "products-for-coupons"],
    queryFn: () => api.get<any>("/admin/products?take=100"),
    enabled: formData.isProductSpecific,
  });

  const catalogProducts: any[] = catalogProductsData?.data ?? [];

  const filteredCatalog = catalogProducts.filter((p: any) => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q));
  });

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const mutation = useMutation({
    mutationFn: (data: any) =>
      coupon ? api.put(`/admin/coupons/${coupon.id}`, data) : api.post("/admin/coupons", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.isProductSpecific && selectedProductIds.length === 0) {
      alert("Please select at least one product for this product-specific coupon.");
      return;
    }

    mutation.mutate({
      ...formData,
      discountValue: Number(formData.discountValue),
      minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : null,
      maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
      usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      storeId: formData.storeId || null,
      productIds: formData.isProductSpecific ? selectedProductIds : [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl rounded-2xl bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-[var(--color-border)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-bg-muted)]/30">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {coupon ? "Edit Coupon & Campaign" : "Create New Coupon"}
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Configure discount rules, product scope, and customer presentation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <form id="coupon-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Coupon Code *
                </label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm focus:border-[var(--color-primary)] font-mono uppercase font-bold"
                  placeholder="FESTIVE50"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Status
                </label>
                <select
                  value={formData.isActive ? "true" : "false"}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "true" })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                >
                  <option value="true">Active (Usable)</option>
                  <option value="false">Inactive (Disabled)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Description / Campaign Pitch
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                  placeholder="e.g., Exclusive festive 20% savings on premium headphones"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Discount Type
                </label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Discount Value *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                  placeholder={formData.discountType === "PERCENTAGE" ? "20" : "500"}
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Min. Order Value (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                  placeholder="e.g., 999"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Max Discount Cap (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxDiscount}
                  onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                  disabled={formData.discountType === "FIXED_AMOUNT"}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm disabled:bg-[var(--color-bg-muted)] disabled:opacity-50"
                  placeholder="e.g., 2000"
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Total Global Usage Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm"
                  placeholder="e.g., 100 uses total"
                />
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                  Note: Each individual customer account can avail this coupon only once.
                </p>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Validity Period
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs"
                    title="Start Date"
                  />
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs"
                    title="End Date"
                  />
                </div>
              </div>
            </div>

            {/* ─── Requirement 3: Product-Specific Assignment ─── */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Package size={16} className="text-purple-600" /> Product-Specific Coupon Assignment
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Limit this coupon to specific products instead of applying across the whole store.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isProductSpecific}
                    onChange={(e) => setFormData({ ...formData, isProductSpecific: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {formData.isProductSpecific && (
                <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                      <input
                        type="text"
                        placeholder="Search products to assign..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] focus:border-purple-600 outline-none"
                      />
                    </div>
                    <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-lg border border-purple-200 shrink-0">
                      {selectedProductIds.length} Selected
                    </span>
                  </div>

                  {/* Selected Chips */}
                  {selectedProductIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
                      {selectedProductIds.map((pid) => {
                        const product = catalogProducts.find((p) => p.id === pid);
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 rounded-md bg-purple-100/70 text-purple-900 px-2 py-0.5 text-[11px] font-medium"
                          >
                            <span className="max-w-[150px] truncate">{product?.name || pid}</span>
                            <button
                              type="button"
                              onClick={() => toggleProduct(pid)}
                              className="text-purple-700 hover:text-purple-950 font-bold"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Product Picker List */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                    {isProductsLoading ? (
                      <div className="p-4 text-center text-xs text-[var(--color-text-tertiary)]">
                        Loading products...
                      </div>
                    ) : filteredCatalog.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--color-text-tertiary)]">
                        No matching products found.
                      </div>
                    ) : (
                      filteredCatalog.map((prod: any) => {
                        const isSelected = selectedProductIds.includes(prod.id);
                        const variant = prod.variants?.[0];
                        const img = variant?.images?.[0]?.url;
                        return (
                          <div
                            key={prod.id}
                            onClick={() => toggleProduct(prod.id)}
                            className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors hover:bg-[var(--color-bg-muted)]/50 ${
                              isSelected ? "bg-purple-50/60" : ""
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded bg-[var(--color-bg-muted)] overflow-hidden shrink-0 flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={prod.name} className="h-full w-full object-cover" />
                                ) : (
                                  <Package size={14} className="text-gray-400" />
                                )}
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-[var(--color-text-primary)] truncate">
                                  {prod.name}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {prod.brand ? `${prod.brand} · ` : ""}₹
                                  {Number(variant?.price || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-purple-600 border-purple-600 text-white"
                                  : "border-[var(--color-border)]"
                              }`}
                            >
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Requirement 5: Storefront Reflect Toggle & Banner ─── */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-500" /> Storefront Promotional Banner Reflection
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                    Display a standout banner on the products listing page with a link to eligible items.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.showInStorefront}
                    onChange={(e) => setFormData({ ...formData, showInStorefront: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {formData.showInStorefront && (
                <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Banner Headline Text
                    </label>
                    <input
                      type="text"
                      value={formData.bannerText}
                      onChange={(e) => setFormData({ ...formData, bannerText: e.target.value })}
                      placeholder="e.g., Festive Offer: Use code to get flat 20% OFF on select products!"
                      className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm bg-[var(--color-bg-surface)]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                      Color Theme
                    </label>
                    <select
                      value={formData.bannerColor}
                      onChange={(e) => setFormData({ ...formData, bannerColor: e.target.value })}
                      className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-sm bg-[var(--color-bg-surface)]"
                    >
                      <option value="indigo">Indigo / Royal Violet</option>
                      <option value="emerald">Emerald / Forest Green</option>
                      <option value="amber">Amber / Festive Gold</option>
                      <option value="rose">Rose / Crimson Sunset</option>
                      <option value="slate">Slate / Modern Dark</option>
                    </select>
                  </div>

                  {/* Banner Preview */}
                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Eye size={12} /> Live Storefront Banner Preview
                    </p>
                    <div
                      className={`p-4 rounded-xl text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${
                        formData.bannerColor === "emerald"
                          ? "bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 border border-emerald-500/30"
                          : formData.bannerColor === "amber"
                          ? "bg-gradient-to-r from-amber-950 via-yellow-900 to-amber-950 border border-amber-500/30"
                          : formData.bannerColor === "rose"
                          ? "bg-gradient-to-r from-rose-950 via-pink-900 to-rose-950 border border-rose-500/30"
                          : formData.bannerColor === "slate"
                          ? "bg-gradient-to-r from-slate-950 via-gray-900 to-slate-950 border border-slate-700"
                          : "bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border border-indigo-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-center sm:text-left">
                        <span className="p-2 rounded-lg bg-white/10 shrink-0">
                          <Sparkles size={16} className="text-amber-300 animate-pulse" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-100">
                            {formData.bannerText || `Special discount with coupon ${formData.code || "CODE"}!`}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            {formData.isProductSpecific
                              ? `Applies to ${selectedProductIds.length} hand-picked item(s)`
                              : "Applies store-wide on qualifying orders"}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold px-3 py-1 rounded bg-white/20 border border-white/30 text-amber-300 shrink-0">
                        {formData.code || "COUPON"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mutation.isError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
                {(mutation.error as Error).message}
              </div>
            )}
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-muted)]/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="coupon-form"
            disabled={mutation.isPending}
            className="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 transition-colors disabled:opacity-70 shadow-sm"
          >
            {mutation.isPending ? "Saving..." : "Save Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}
