"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Eye, ShoppingCart, Check } from "lucide-react";
import { ProductQuickViewModal } from "./ProductQuickViewModal";
import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ProductCardProps {
  product: {
    id?: string;
    name: string;
    slug: string;
    brand?: string;
    store?: { name: string; slug: string };
    variants?: Array<{
      id?: string;
      price: number;
      compareAtPrice?: number | null;
      images?: Array<{ url: string }>;
      inventory?: { quantity: number };
      attributes?: Array<{ key: string; value: string }>;
    }>;
  };
  viewMode?: "grid" | "list";
}

export function ProductCard({ product, viewMode = "grid" }: ProductCardProps) {
  const [showQuickView, setShowQuickView] = useState(false);
  const [added, setAdded] = useState(false);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const { addToCart, isLoading: cartLoading } = useCartStore();

  const variant = product.variants?.[0];
  const price = Number(variant?.price ?? 0);
  const comparePrice = variant?.compareAtPrice ? Number(variant.compareAtPrice) : null;
  const imageUrl = variant?.images?.[0]?.url;
  const discount = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const stock = variant?.inventory?.quantity ?? 10;

  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/wishlist"),
    enabled: isAuthenticated,
  });

  const addWishlistMutation = useMutation({
    mutationFn: (body: { productId: string; variantId?: string }) => api.post("/wishlist", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const removeWishlistMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const wishlistItems: any[] = wishlistData?.data ?? [];
  const wishlistItem = wishlistItems.find((w) => w.productId === product.id);
  const isWishlisted = !!wishlistItem;

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (isWishlisted) {
      removeWishlistMutation.mutate(wishlistItem.id);
    } else if (product.id) {
      addWishlistMutation.mutate({ productId: product.id, variantId: variant?.id });
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!variant?.id) return;
    try {
      await addToCart(variant.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      // Handled in cart store
    }
  };

  const handleOpenQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowQuickView(true);
  };

  // Horizontal List View Layout
  if (viewMode === "list") {
    return (
      <>
        <div className="group relative flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-all hover:shadow-[var(--shadow-md)]">
          <Link href={`/product/${product.slug}`} className="relative h-44 sm:w-44 sm:h-44 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-muted)]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-3xl text-[var(--color-text-tertiary)]">📦</span>
              </div>
            )}
            {discount > 0 && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--color-accent-warm)] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                -{discount}%
              </span>
            )}
          </Link>

          <div className="flex flex-1 flex-col justify-between py-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                  {product.brand || product.store?.name}
                </span>
                <button
                  onClick={handleWishlistToggle}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${isWishlisted ? "border-red-300 bg-red-50 text-red-500" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-red-500"
                    }`}
                  title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart size={14} className={isWishlisted ? "fill-current" : ""} />
                </button>
              </div>

              <Link href={`/product/${product.slug}`} className="hover:text-[var(--color-accent)] transition-colors">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] line-clamp-1">
                  {product.name}
                </h3>
              </Link>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-lg font-bold text-[var(--color-text-primary)]">
                  {"\u20B9"}{price.toLocaleString()}
                </span>
                {comparePrice && (
                  <span className="text-xs text-[var(--color-text-tertiary)] line-through">
                    {"\u20B9"}{comparePrice.toLocaleString()}
                  </span>
                )}
                {stock <= 5 && stock > 0 && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    Only a few left
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleQuickAdd}
                disabled={stock === 0 || cartLoading}
                className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
              >
                {added ? <Check size={14} /> : <ShoppingCart size={14} />}
                {added ? "Added" : "Add to Cart"}
              </button>
              <button
                onClick={handleOpenQuickView}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Eye size={14} /> Quick View
              </button>
            </div>
          </div>
        </div>

        <ProductQuickViewModal
          product={product}
          isOpen={showQuickView}
          onClose={() => setShowQuickView(false)}
        />
      </>
    );
  }

  // Standard Grid View Layout
  return (
    <>
      <div className="product-card group relative flex flex-col justify-between">
        {/* Image & Quick Action Overlay */}
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[var(--color-bg-muted)]">
          <Link href={`/product/${product.slug}`} className="block h-full w-full">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="text-3xl text-[var(--color-text-tertiary)]">📦</span>
              </div>
            )}
          </Link>

          {/* Discount badge */}
          {discount > 0 && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--color-accent-warm)] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{discount}%
            </span>
          )}

          {/* Quick Action floating buttons */}
          <div className="absolute right-2 top-2 flex flex-col gap-1.5 transition-all">
            {/* Wishlist button */}
            <button
              onClick={handleWishlistToggle}
              title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-all ${isWishlisted
                ? "bg-red-50 text-red-500"
                : "bg-white/80 text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-white "
                }`}
            >
              <Heart size={14} className={isWishlisted ? "fill-current" : ""} />
            </button>

            {/* Quick View trigger */}
            <button
              onClick={handleOpenQuickView}
              title="Quick view"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80  text-[var(--color-text-secondary)] shadow-sm backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all hover:text-[var(--color-text-primary)] hover:bg-white "
            >
              <Eye size={14} />
            </button>
          </div>

          {/* Quick Add To Cart Button bar on bottom hover */}
          <div className="absolute inset-x-2 bottom-2 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <button
              onClick={handleQuickAdd}
              disabled={stock === 0 || cartLoading}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white/95 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] shadow-lg backdrop-blur-sm hover:bg-[var(--color-primary)] hover:text-white transition-all disabled:opacity-50"
            >
              {added ? <Check size={14} className="text-emerald-500" /> : <ShoppingCart size={14} />}
              {added ? "Added to Cart" : "Quick Add"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-3 space-y-1">
          {product.brand ? (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
              {product.brand}
            </p>
          ) : product.store ? (
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {product.store.name}
            </p>
          ) : null}

          <Link href={`/product/${product.slug}`} className="block">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>

          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {"\u20B9"}{price.toLocaleString()}
            </span>
            {comparePrice && (
              <span className="text-xs text-[var(--color-text-tertiary)] line-through">
                {"\u20B9"}{comparePrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <ProductQuickViewModal
        product={product}
        isOpen={showQuickView}
        onClose={() => setShowQuickView(false)}
      />
    </>
  );
}