"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Bookmark, Tag, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";

export default function CartPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<any>("/cart"),
  });

  const { data: wishlistData } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/wishlist"),
    enabled: isAuthenticated,
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.patch(`/cart/${itemId}`, { quantity }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/cart/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const saveForLaterMutation = useMutation({
    mutationFn: async (item: any) => {
      if (isAuthenticated) {
        await api.post("/wishlist", {
          productId: item.productId || item.variant?.productId,
          variantId: item.variantId,
        });
      }
      await api.delete(`/cart/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const moveToCartMutation = useMutation({
    mutationFn: async (item: any) => {
      await api.post("/cart", { variantId: item.variantId, quantity: 1 });
      await api.delete(`/wishlist/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const cart = data?.data;
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const itemCount = cart?.itemCount ?? 0;
  const savedItems: any[] = wishlistData?.data ?? [];

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await api.post<any>("/orders/coupons/validate", {
        code: couponCode.trim(),
        subtotal,
      });
      setAppliedCoupon(res.data);
    } catch (err: any) {
      setCouponError(err.message || "Invalid or expired coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const discountAmount = appliedCoupon?.discount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const deliveryFee = discountedSubtotal >= 499 ? 0 : 49;
  const total = discountedSubtotal + deliveryFee;
  const estimatedGst = Math.round(total - total / 1.18);

  if (isLoading) {
    return (
      <div className="section-container py-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Shopping Cart</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0 && savedItems.length === 0) {
    return (
      <div className="section-container py-16 text-center">
        <ShoppingCart size={56} className="mx-auto text-[var(--color-text-tertiary)] mb-4" />
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Your cart is empty</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Start adding products to your cart.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="section-container py-8">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
        Shopping Cart <span className="text-base font-normal text-[var(--color-text-tertiary)]">({itemCount} items)</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            {items.map((item: any) => {
              const imageUrl = item.variant?.images?.[0]?.url;
              const productName = item.variant?.product?.name ?? "Product";
              const storeName = item.variant?.product?.store?.name;
              const unitPrice = Number(item.unitPrice);

              return (
                <div key={item.id} className="flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-shadow hover:shadow-sm">
                  {/* Image */}
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-[var(--color-bg-muted)] overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt={productName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-2xl">📦</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/product/${item.variant?.product?.slug ?? ""}`}
                        className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] line-clamp-2"
                      >
                        {productName}
                      </Link>
                      <span className="text-sm font-bold text-[var(--color-text-primary)] shrink-0">
                        ₹{(unitPrice * item.quantity).toLocaleString()}
                      </span>
                    </div>

                    {storeName && <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{storeName}</p>}
                    {item.variant?.attributes?.length > 0 && (
                      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                        {item.variant.attributes.map((a: any) => `${a.key}: ${a.value}`).join(" · ")}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--color-border)]/60">
                      <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-base)]">
                        <button
                          onClick={() => updateMutation.mutate({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) })}
                          className="flex h-8 w-8 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="flex h-8 w-10 items-center justify-center text-xs font-semibold border-x border-[var(--color-border)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                          className="flex h-8 w-8 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveForLaterMutation.mutate(item)}
                          disabled={saveForLaterMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-accent)] transition-colors"
                        >
                          <Bookmark size={13} />
                          Save for later
                        </button>
                        <button
                          onClick={() => removeMutation.mutate(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Saved for Later Section */}
          {savedItems.length > 0 && (
            <div className="pt-6 border-t border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <Bookmark size={16} /> Saved for Later ({savedItems.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedItems.map((wish: any) => {
                  const product = wish.product;
                  const variant = wish.variant || product?.variants?.[0];
                  const img = variant?.images?.[0]?.url;
                  return (
                    <div key={wish.id} className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 items-center">
                      <div className="h-16 w-16 rounded-lg bg-[var(--color-bg-muted)] overflow-hidden shrink-0">
                        {img ? <img src={img} alt={product?.name} className="h-full w-full object-cover" /> : <span className="text-xl">📦</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{product?.name}</p>
                        <p className="text-xs font-bold text-[var(--color-accent)] mt-0.5">₹{Number(variant?.price || 0).toLocaleString()}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => moveToCartMutation.mutate(wish)}
                            className="text-[11px] font-semibold text-white bg-[var(--color-primary)] px-2.5 py-1 rounded-md hover:bg-[var(--color-primary-hover)] transition-colors"
                          >
                            Move to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1 space-y-5">
          {/* Coupon Box */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <Tag size={15} /> Apply Discount Coupon
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2 text-sm uppercase outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponLoading || !couponCode.trim()}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
              >
                {couponLoading ? "..." : "Apply"}
              </button>
            </div>
            {couponError && <p className="mt-2 text-xs text-red-500">{couponError}</p>}
            {appliedCoupon && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
                <span className="flex items-center gap-1.5 font-medium">
                  <Check size={14} className="text-emerald-600" />
                  Code <strong>{appliedCoupon.code}</strong> applied
                </span>
                <button
                  type="button"
                  onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}
                  className="text-[10px] text-emerald-700 hover:underline font-bold"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 sticky top-20 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Order Summary</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Subtotal ({itemCount} items)</span>
                <span className="font-medium text-[var(--color-text-primary)]">₹{subtotal.toLocaleString()}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-₹{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Delivery</span>
                <span className="font-medium text-emerald-600">{deliveryFee === 0 ? "FREE" : "₹49"}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] pt-0.5">
                <span>Includes GST (18%)</span>
                <span>₹{estimatedGst.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between text-base font-bold text-[var(--color-text-primary)]">
              <span>Total Amount</span>
              <span>₹{total.toLocaleString()}</span>
            </div>

            {subtotal < 499 && (
              <p className="mt-3 text-[11px] text-[var(--color-accent)] bg-[var(--color-accent-light)] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                <Sparkles size={13} /> Add ₹{499 - subtotal} more for FREE Delivery!
              </p>
            )}

            <Link
              href="/checkout"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-md active:scale-[0.99]"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}