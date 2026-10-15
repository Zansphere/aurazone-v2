"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Check, ShoppingCart, Star, Heart, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useAuthStore } from "@/stores/auth.store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ProductQuickViewProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductQuickViewModal({ product, isOpen, onClose }: ProductQuickViewProps) {
  const queryClient = useQueryClient();
  const { addToCart, isLoading: cartLoading } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/wishlist"),
    enabled: isAuthenticated && isOpen,
  });

  const addWishlistMutation = useMutation({
    mutationFn: (body: { productId: string; variantId?: string }) => api.post("/wishlist", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const removeWishlistMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  if (!isOpen || !product) return null;

  const variants = product.variants ?? [];
  const variant = variants[selectedVariantIdx] ?? variants[0];
  const images = variant?.images ?? [];
  const price = Number(variant?.price ?? 0);
  const comparePrice = variant?.compareAtPrice ? Number(variant.compareAtPrice) : null;
  const discount = comparePrice ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const stock = variant?.inventory?.quantity ?? 10;
  const attributes = variant?.attributes ?? [];

  const wishlistItems: any[] = wishlistData?.data ?? [];
  const wishlistItem = wishlistItems.find((w) => w.productId === product.id);
  const isWishlisted = !!wishlistItem;

  const handleWishlistToggle = () => {
    if (!isAuthenticated) return;
    if (isWishlisted) removeWishlistMutation.mutate(wishlistItem.id);
    else addWishlistMutation.mutate({ productId: product.id, variantId: variant?.id });
  };

  const handleAddToCart = async () => {
    if (!variant) return;
    try {
      await addToCart(variant.id, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--color-text-secondary)] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[85vh] overflow-y-auto">
          {/* Images */}
          <div className="p-6 flex flex-col justify-between bg-[var(--color-bg-muted)]/50">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--color-bg-muted)] border border-[var(--color-border)]">
              {images.length > 0 ? (
                <img
                  src={images[selectedImage]?.url || images[0]?.url}
                  alt={product.name}
                  className="h-full w-full object-cover transition-all duration-300"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">📦</div>
              )}
              {discount > 0 && (
                <span className="absolute left-3 top-3 rounded-full bg-[var(--color-accent-warm)] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                  -{discount}%
                </span>
              )}

              {/* Prev / Next buttons for images */}
              {images.length > 1 && (
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                  <button
                    onClick={() => setSelectedImage((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
                    className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-black/70 text-sm shadow hover:scale-105 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedImage((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
                    className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-black/70 text-sm shadow hover:scale-105 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((img: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === idx ? "border-[var(--color-accent)] scale-95" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                  {product.brand || product.store?.name || "AuraZone"}
                </span>
                {isAuthenticated && (
                  <button
                    onClick={handleWishlistToggle}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${
                      isWishlisted
                        ? "border-red-300 bg-red-50 text-red-500"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-red-500"
                    }`}
                  >
                    <Heart size={16} className={isWishlisted ? "fill-current" : ""} />
                  </button>
                )}
              </div>

              <h2 className="text-lg md:text-xl font-bold text-[var(--color-text-primary)] leading-snug">
                {product.name}
              </h2>

              <div className="flex items-baseline gap-2.5">
                <span className="text-xl font-bold text-[var(--color-text-primary)]">
                  {"\u20B9"}{price.toLocaleString()}
                </span>
                {comparePrice && (
                  <>
                    <span className="text-sm text-[var(--color-text-tertiary)] line-through">
                      {"\u20B9"}{comparePrice.toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-accent-warm)]">
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Variants */}
              {variants.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase mb-1.5">Options</p>
                  <div className="flex flex-wrap gap-1.5">
                    {variants.map((v: any, idx: number) => {
                      const label = v.attributes?.map((a: any) => a.value).join(" / ") || `Variant ${idx + 1}`;
                      return (
                        <button
                          key={v.id || idx}
                          onClick={() => {
                            setSelectedVariantIdx(idx);
                            setSelectedImage(0);
                            setQuantity(1);
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            selectedVariantIdx === idx
                              ? "border-[var(--color-accent)] bg-[var(--color-accent-light)] text-[var(--color-accent)] font-semibold"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stock status */}
              <div className="text-xs">
                {stock > 0 ? (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> In Stock ({stock} available)
                  </span>
                ) : (
                  <span className="text-red-500 font-medium">Out of Stock</span>
                )}
              </div>

              {product.description && (
                <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-10 w-9 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors text-sm"
                  >
                    -
                  </button>
                  <span className="flex h-10 w-10 items-center justify-center text-xs font-bold text-[var(--color-text-primary)] border-x border-[var(--color-border)]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={quantity >= stock}
                    className="flex h-10 w-9 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors text-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={stock === 0 || cartLoading}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    addedToCart
                      ? "bg-emerald-500 text-white"
                      : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                  } disabled:opacity-50`}
                >
                  {addedToCart ? (
                    <>
                      <Check size={14} /> Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={14} /> {cartLoading ? "Adding..." : "Add to Cart"}
                    </>
                  )}
                </button>
              </div>

              <Link
                href={`/product/${product.slug}`}
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline pt-1"
              >
                View Full Product Details <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
