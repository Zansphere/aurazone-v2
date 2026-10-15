"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Search, Package, Trash2, Edit2, CheckCircle, XCircle,
  Tag, ChevronDown, X, Eye,
} from "lucide-react";
import Link from "next/link";
import ProductForm from "@/components/stores/ProductForm";

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  isActive: boolean;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
  variants: Array<{
    id: string;
    price: number;
    compareAtPrice: number | null;
    images: Array<{ url: string }>;
    inventory?: { quantity: number; reserved?: number } | null;
  }>;
  _count: { variants: number };
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function ProductsTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "products", storeId, search, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams({ storeId, take: "50" });
      if (search) params.set("search", search);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      return api.get<Product[]>(`/admin/products?${params}`);
    },
  });

  const { data: catsData } = useQuery({
    queryKey: ["admin", "categories", storeId],
    queryFn: () => api.get<Category[]>(`/admin/categories?storeId=${storeId}&take=200`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => invalidate(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/products/${id}`, { isActive }),
    onSuccess: () => invalidate(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "products", storeId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "store", storeId] });
  };

  const products: Product[] = (data as any)?.data ?? [];
  const categories: Category[] = (catsData as any)?.data ?? [];

  const formatPrice = (p: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(p);

  if (showForm || editingProduct) {
    return (
      <ProductForm
        storeId={storeId}
        productId={editingProduct}
        onClose={() => { setShowForm(false); setEditingProduct(null); }}
        onSuccess={() => { invalidate(); setShowForm(false); setEditingProduct(null); }}
      />
    );
  }

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-16 shimmer rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Package size={16} /> Products ({(data as any)?.meta?.total ?? products.length})
        </h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text" className="form-input pl-9 text-xs" placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-input text-xs w-48"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Product List */}
      <div className="space-y-1">
        {products.map((product) => {
          const mainVariant = product.variants?.[0];
          const imageUrl = mainVariant?.images?.[0]?.url;
          const overallStock = product.variants?.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0) ?? 0;
          const variantCount = product._count?.variants ?? product.variants?.length ?? 1;

          return (
            <div
              key={product.id}
              className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--color-bg-muted)] transition-colors group"
            >
              {/* Thumbnail */}
              <Link
                href={`/products/${product.id}`}
                className="h-10 w-10 rounded-lg bg-[var(--color-bg-muted)] overflow-hidden flex items-center justify-center shrink-0 hover:opacity-85 transition-opacity"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <Package size={16} className="text-[var(--color-text-tertiary)]" />
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/products/${product.id}`}
                    className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline truncate transition-colors"
                  >
                    {product.name}
                  </Link>
                  {product.isFeatured && (
                    <span className="text-[9px] font-medium text-[var(--color-warning-text)] bg-[var(--color-warning-bg)] px-1.5 py-0.5 rounded">★ Featured</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    <Tag size={9} className="inline mr-0.5" />
                    {product.category?.name}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      overallStock <= 0
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : overallStock <= 5
                        ? "bg-amber-50 text-amber-600 border border-amber-200"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    }`}
                  >
                    <span
                      className={`h-1 w-1 rounded-full ${
                        overallStock <= 0 ? "bg-red-500" : overallStock <= 5 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    {overallStock} in stock
                  </span>
                  <span className="text-[10px] text-[var(--color-text-tertiary)]">
                    · {variantCount} {variantCount === 1 ? "variant" : "variants"}
                  </span>
                  {product.brand && (
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">· {product.brand}</span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                {mainVariant && (
                  <>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums">
                      {formatPrice(Number(mainVariant.price))}
                    </p>
                    {mainVariant.compareAtPrice && (
                      <p className="text-[10px] text-[var(--color-text-tertiary)] line-through tabular-nums">
                        {formatPrice(Number(mainVariant.compareAtPrice))}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Status Toggle */}
              <button
                onClick={() => toggleMutation.mutate({ id: product.id, isActive: !product.isActive })}
                className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                  product.isActive ? "bg-[var(--color-accent)]" : "bg-gray-300"
                }`}
              >
                <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  product.isActive ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>

              {/* Actions */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/products/${product.id}`}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                  title="View product details"
                >
                  <Eye size={12} />
                </Link>
                <button
                  onClick={() => setEditingProduct(product.id)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
                  title="Edit product"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${product.name}"?`)) deleteMutation.mutate(product.id); }}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500"
                  title="Delete product"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {products.length === 0 && (
          <div className="py-8 text-center">
            <Package size={28} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">No products yet</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Create your first product in this store
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
