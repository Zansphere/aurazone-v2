"use client";

import { useState, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ArrowLeft, ChevronRight, Package, Edit2, Trash2, CheckCircle,
  XCircle, Store as StoreIcon, Tag, AlertTriangle, Layers,
  ExternalLink, Calendar, Hash, Image as ImageIcon, Check,
  X, ShieldCheck, Sparkles, RefreshCw, BarChart2
} from "lucide-react";
import Link from "next/link";
import ProductForm from "@/components/stores/ProductForm";

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  isAvailable: boolean;
  attributes: Array<{ id?: string; key: string; value: string }>;
  images: Array<{ id?: string; url: string; position: number; altText?: string | null }>;
  inventory: { id: string; quantity: number; reserved?: number; updatedAt?: string } | null;
  _count?: { orderItems: number };
}

interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  brand: string | null;
  modelNumber: string | null;
  gender: string | null;
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  hasVariants: boolean;
  storeId: string;
  store: { id: string; name: string; slug: string };
  categoryId: string;
  category: { id: string; name: string; slug: string };
  variants: ProductVariant[];
  _count: { variants: number };
  createdAt: string;
  updatedAt: string;
}

function ProductDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const productId = params.productId as string;
  const initialEditMode = searchParams.get("edit") === "true";

  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [activeTab, setActiveTab] = useState<"overview" | "variants" | "gallery">("overview");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => api.get<ProductDetail>(`/admin/products/${productId}`),
    enabled: !!productId,
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => api.put(`/admin/products/${productId}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "product", productId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/products/${productId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      router.push("/products");
    },
  });

  const product = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-6 fade-in max-w-6xl">
        <div className="h-5 w-48 shimmer rounded" />
        <div className="card p-6 h-36 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 h-24 shimmer" />
          ))}
        </div>
        <div className="card p-6 h-72 shimmer" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card p-12 text-center max-w-md mx-auto my-12">
        <Package size={44} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Product Not Found</h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          The requested product could not be located or has been deleted.
        </p>
        <Link href="/products" className="btn-primary mt-4 inline-flex items-center gap-2 text-xs">
          <ArrowLeft size={14} /> Back to Products
        </Link>
      </div>
    );
  }

  // Stock calculations
  const overallStock = product.variants?.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0) ?? 0;
  const primaryVariant = product.variants?.[0];
  const allImages = product.variants?.flatMap((v) =>
    (v.images || []).map((img) => ({
      ...img,
      variantSku: v.sku,
      variantPrice: v.price,
    }))
  ) ?? [];

  // Price calculations
  const prices = product.variants?.map((v) => Number(v.price)).filter((p) => !isNaN(p)) ?? [];
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const priceDisplay = minPrice === maxPrice
    ? `₹${minPrice.toLocaleString()}`
    : `₹${minPrice.toLocaleString()} - ₹${maxPrice.toLocaleString()}`;

  const primaryComparePrice = primaryVariant?.compareAtPrice ? Number(primaryVariant.compareAtPrice) : null;
  const discountPercent = primaryComparePrice && primaryComparePrice > Number(primaryVariant?.price)
    ? Math.round(((primaryComparePrice - Number(primaryVariant?.price)) / primaryComparePrice) * 100)
    : null;

  const formatCurrency = (val: number) => `₹${Number(val || 0).toLocaleString()}`;

  if (isEditing) {
    return (
      <div className="space-y-5 fade-in max-w-5xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <button
              onClick={() => setIsEditing(false)}
              className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Product Details
            </button>
            <ChevronRight size={14} />
            <span className="text-[var(--color-text-primary)] font-medium">Edit {product.name}</span>
          </div>
          <button
            onClick={() => setIsEditing(false)}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <X size={14} /> Cancel Editing
          </button>
        </div>

        <div className="card p-6">
          <ProductForm
            productId={productId}
            storeId={product.storeId}
            onClose={() => setIsEditing(false)}
            onSuccess={() => {
              setIsEditing(false);
              queryClient.invalidateQueries({ queryKey: ["admin", "product", productId] });
              queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in max-w-6xl pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Link href="/products" className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} /> Products
          </Link>
          <ChevronRight size={14} />
          <Link href={`/stores/${product.store.id}`} className="hover:text-[var(--color-text-primary)] transition-colors">
            {product.store.name}
          </Link>
          <ChevronRight size={14} />
          <span className="text-[var(--color-text-primary)] font-medium truncate max-w-xs">{product.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Edit2 size={13} /> Edit Product
          </button>
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="btn-secondary text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-[var(--color-bg-muted)] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
              {allImages[0]?.url ? (
                <img src={allImages[0].url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package size={26} className="text-[var(--color-text-tertiary)]" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{product.name}</h1>
                {product.isFeatured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Sparkles size={11} /> Featured
                  </span>
                )}
                {product.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle size={12} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                    <XCircle size={12} /> Inactive
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)] pt-1">
                <span className="font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 rounded text-[11px]">
                  /{product.slug}
                </span>
                <span className="flex items-center gap-1">
                  <StoreIcon size={13} className="text-[var(--color-text-tertiary)]" />
                  <Link href={`/stores/${product.store.id}`} className="hover:text-[var(--color-accent)] hover:underline font-medium">
                    {product.store.name}
                  </Link>
                </span>
                <span className="flex items-center gap-1">
                  <Tag size={13} className="text-[var(--color-text-tertiary)]" />
                  <span>{product.category?.name}</span>
                </span>
                {product.brand && (
                  <span className="flex items-center gap-1 text-[var(--color-text-primary)] font-medium">
                    Brand: <span className="text-[var(--color-text-secondary)]">{product.brand}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-4 md:pt-0 md:pl-6">
            <button
              onClick={() => toggleMutation.mutate(!product.isActive)}
              disabled={toggleMutation.isPending}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                product.isActive
                  ? "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {product.isActive ? "Deactivate Product" : "Activate Product"}
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stock Quantity Card (Most Important) */}
        <div className="card p-5 border-l-4 border-l-[var(--color-accent)]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Stock (Overall Qty)
            </p>
            <BarChart2 size={16} className="text-[var(--color-text-tertiary)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
              {overallStock}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                overallStock <= 0
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : overallStock <= 5
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  overallStock <= 0 ? "bg-red-500" : overallStock <= 5 ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              {overallStock <= 0 ? "Out of Stock" : overallStock <= 5 ? "Low Stock" : "In Stock"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            Across {product.variants.length} {product.variants.length === 1 ? "variant" : "variants"}
          </p>
        </div>

        {/* Pricing Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Price
            </p>
            <Tag size={16} className="text-[var(--color-text-tertiary)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
              {priceDisplay}
            </span>
            {discountPercent && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                {discountPercent}% OFF
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            {primaryComparePrice ? (
              <span className="line-through">Original: ₹{primaryComparePrice.toLocaleString()}</span>
            ) : (
              "Standard catalog pricing"
            )}
          </p>
        </div>

        {/* Variants Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Variants
            </p>
            <Layers size={16} className="text-[var(--color-text-tertiary)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
              {product.variants.length}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">active configurations</span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)] truncate">
            {product.hasVariants ? "Multi-variant product" : "Single variant product"}
          </p>
        </div>

        {/* Catalog / Store Info */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Store & Catalog
            </p>
            <StoreIcon size={16} className="text-[var(--color-text-tertiary)]" />
          </div>
          <div className="mt-2">
            <Link
              href={`/stores/${product.store.id}`}
              className="text-base font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline block truncate"
            >
              {product.store.name}
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)] truncate">
            Category: <span className="text-[var(--color-text-secondary)]">{product.category.name}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-[var(--color-border)] px-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === "overview"
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Package size={14} /> Overview & Specifications
          </button>
          <button
            onClick={() => setActiveTab("variants")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === "variants"
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <Layers size={14} /> Variants & Inventory ({product.variants.length})
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-all border-b-2 -mb-px ${
              activeTab === "gallery"
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            <ImageIcon size={14} /> Media & Images ({allImages.length})
          </button>
        </div>

        {/* Tab 1: Overview & Specifications */}
        {activeTab === "overview" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Description & Tags Column */}
              <div className="md:col-span-2 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <div className="rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] p-4 text-sm text-[var(--color-text-primary)] whitespace-pre-line leading-relaxed">
                    {product.description || (
                      <span className="text-[var(--color-text-tertiary)] italic">No description provided for this product.</span>
                    )}
                  </div>
                </div>

                {product.shortDescription && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                      Short Summary
                    </h3>
                    <div className="rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border-muted)] p-3 text-xs text-[var(--color-text-secondary)]">
                      {product.shortDescription}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {product.tags && product.tags.length > 0 ? (
                      product.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-bg-muted)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"
                        >
                          <Hash size={11} className="text-[var(--color-text-tertiary)]" />
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)] italic">No tags assigned.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Specifications Column */}
              <div className="space-y-4">
                <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3 bg-[var(--color-bg-surface)]">
                  <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] pb-2">
                    Specifications
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Brand</span>
                      <span className="font-medium text-[var(--color-text-primary)]">{product.brand || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Model Number</span>
                      <span className="font-medium font-mono text-[var(--color-text-primary)]">{product.modelNumber || "—"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Gender</span>
                      <span className="font-medium text-[var(--color-text-primary)]">{product.gender || "Unisex"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Category</span>
                      <span className="font-medium text-[var(--color-text-primary)]">{product.category.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Store</span>
                      <Link href={`/stores/${product.store.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                        {product.store.name}
                      </Link>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--color-border-muted)]">
                      <span className="text-[var(--color-text-tertiary)]">Created</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {new Date(product.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[var(--color-text-tertiary)]">Updated</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {new Date(product.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-bg-surface)]">
                  <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                    Store Information
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
                      {product.store.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{product.store.name}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] font-mono">/{product.store.slug}</p>
                    </div>
                    <Link
                      href={`/stores/${product.store.id}`}
                      className="p-1.5 rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]"
                      title="Manage store"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Variants & Inventory */}
        {activeTab === "variants" && (
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Attributes
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Stock Quantity
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Availability
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {product.variants.map((v, idx) => {
                  const img = v.images?.[0]?.url;
                  const qty = v.inventory?.quantity ?? 0;

                  return (
                    <tr key={v.id || idx} className="hover:bg-[var(--color-bg-muted)] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => img && setPreviewImage(img)}
                            className={`h-10 w-10 rounded-lg bg-[var(--color-bg-muted)] border border-[var(--color-border)] overflow-hidden flex items-center justify-center shrink-0 ${
                              img ? "cursor-pointer hover:opacity-85" : ""
                            }`}
                          >
                            {img ? (
                              <img src={img} alt={v.sku} className="h-full w-full object-cover" />
                            ) : (
                              <Package size={14} className="text-[var(--color-text-tertiary)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-xs text-[var(--color-text-primary)]">
                              Variant #{idx + 1}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)]">
                              {v.images?.length ?? 0} {v.images?.length === 1 ? "image" : "images"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono font-medium text-[var(--color-text-primary)]">
                        {v.sku}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {v.attributes && v.attributes.length > 0 ? (
                            v.attributes.map((attr, aIdx) => (
                              <span
                                key={aIdx}
                                className="inline-flex items-center rounded bg-[var(--color-bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                              >
                                {attr.key}: <strong className="ml-1 text-[var(--color-text-primary)]">{attr.value}</strong>
                              </span>
                            ))
                          ) : (
                            <span className="text-[var(--color-text-tertiary)] italic">Standard</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                          {formatCurrency(v.price)}
                        </span>
                        {v.compareAtPrice && (
                          <span className="ml-1.5 text-[11px] text-[var(--color-text-tertiary)] line-through">
                            {formatCurrency(v.compareAtPrice)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            qty <= 0
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : qty <= 5
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              qty <= 0 ? "bg-red-500" : qty <= 5 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                          />
                          {qty} in stock
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {v.isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle size={12} /> Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                            <XCircle size={12} /> Unavailable
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Gallery & Media */}
        {activeTab === "gallery" && (
          <div className="p-6">
            {allImages.length === 0 ? (
              <div className="py-12 text-center">
                <ImageIcon size={36} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">No images uploaded</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Click &ldquo;Edit Product&rdquo; above to upload variant images.
                </p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-primary mt-4 text-xs"
                >
                  <Edit2 size={13} className="mr-1.5" /> Upload Images
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allImages.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => setPreviewImage(img.url)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-muted)] cursor-pointer hover:shadow-md transition-all"
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                      <span className="self-end text-[10px] font-mono text-white bg-black/60 px-1.5 py-0.5 rounded">
                        #{img.position + 1}
                      </span>
                      <p className="text-[11px] text-white font-mono truncate">
                        {img.variantSku}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox / Modal for Image Preview */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-transparent" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Enlarged preview" className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain mx-auto" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center hover:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 fade-in max-w-6xl">
          <div className="h-5 w-48 shimmer rounded" />
          <div className="card p-6 h-36 shimmer" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 h-24 shimmer" />
            ))}
          </div>
        </div>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
