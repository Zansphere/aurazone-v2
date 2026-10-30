"use client";

import { useState, useEffect } from "react";
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Bookmark, Tag, Check, Sparkles, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useCouponStore } from "@/stores/coupon.store";

export default function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const {
    cart,
    isLoading: cartLoading,
    fetchCart,
    updateQuantity,
    removeItem,
    addToCart,
    isItemMutating,
  } = useCartStore();

  const {
    items: savedItems,
    removeItem: removeWishlistItem,
    toggle: toggleWishlist,
    fetchWishlist,
  } = useWishlistStore();

  const {
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    sorrowMessage,
    clearSorrowMessage,
    checkValidity,
    calculateDiscount,
    isLoading: couponLoading,
  } = useCouponStore();

  const [couponCode, setCouponCode] = useState("");
  const [localCouponError, setLocalCouponError] = useState("");
  const [savingItemIds, setSavingItemIds] = useState<Record<string, boolean>>({});
  const [movingItemIds, setMovingItemIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCart();
    fetchWishlist();
  }, [fetchCart, fetchWishlist]);

  const items = cart?.items ?? [];
  const subtotal = Number(cart?.subtotal ?? 0);
  const itemCount = Number(cart?.itemCount ?? 0);
  const hasUnavailableItems = Boolean(cart?.hasUnavailableItems || items.some((it: any) => it.isAvailable === false || it.unavailableReason || !it.variant?.product?.name));

  const cartItemInputs = items.map((it: any) => ({
    productId: it.variant?.product?.id || it.productId,
    variantId: it.variantId,
    price: Number(it.unitPrice),
    quantity: it.quantity,
  }));

  useEffect(() => {
    if (items.length > 0) {
      checkValidity(subtotal, cartItemInputs);
    }
  }, [subtotal, items.length, checkValidity]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setLocalCouponError("");
    try {
      await applyCoupon(couponCode, subtotal, cartItemInputs);
      setCouponCode("");
    } catch (err: any) {
      setLocalCouponError(err.message || "Invalid or expired coupon");
    }
  };

  const handleSaveForLater = async (item: any) => {
    setSavingItemIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const prodId = item.productId || item.variant?.productId || item.variant?.product?.id;
      if (prodId && isAuthenticated) {
        toggleWishlist(prodId, item.variantId);
      }
      await removeItem(item.id);
    } finally {
      setSavingItemIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleMoveToCart = async (wish: any) => {
    setMovingItemIds((prev) => ({ ...prev, [wish.id]: true }));
    try {
      const variant = wish.variant || wish.product?.variants?.[0];
      const variantId = wish.variantId || variant?.id;
      if (!variantId) return;

      const preview = {
        productName: wish.product?.name ?? "Product",
        productSlug: wish.product?.slug ?? "",
        imageUrl: variant?.images?.[0]?.url,
        price: Number(variant?.price || 0),
      };

      await addToCart(variantId, 1, preview, false);
      await removeWishlistItem(wish.id);
    } finally {
      setMovingItemIds((prev) => {
        const next = { ...prev };
        delete next[wish.id];
        return next;
      });
    }
  };

  const discountAmount = calculateDiscount(subtotal, cartItemInputs);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const deliveryFee = discountedSubtotal >= 499 ? 0 : 49;
  const total = discountedSubtotal + deliveryFee;
  // Standard 18% GST included in the products price: Base = Subtotal / 1.18, GST = Subtotal * 18 / 118
  const estimatedGst = Math.round((discountedSubtotal * 18) / 118);

  if (cartLoading && !cart) {
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
      {/* Expiry Sorrow Message Alert */}
      {sorrowMessage && (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50/90 p-4 text-sm text-rose-900 shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-3">
            <span className="text-2xl select-none">💔</span>
            <div>
              <p className="font-bold text-rose-950 text-sm">Coupon Expired</p>
              <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">{sorrowMessage}</p>
            </div>
          </div>
          <button
            onClick={clearSorrowMessage}
            className="text-rose-500 hover:text-rose-900 p-1 rounded-md hover:bg-rose-100 transition-colors"
            title="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
        Shopping Cart <span className="text-base font-normal text-[var(--color-text-tertiary)]">({itemCount} items)</span>
      </h1>

      {hasUnavailableItems && (
        <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <p className="font-medium text-xs sm:text-sm">
              Some items in your cart are no longer available or out of stock. Please remove them to proceed to checkout.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            {items.map((item: any) => {
              const imageUrl = item.variant?.images?.[0]?.url;
              const productName = item.variant?.product?.name ?? "Product";
              const storeName = item.variant?.product?.store?.name;
              const unitPrice = Number(item.unitPrice);
              const isItemUnavailable = item.isAvailable === false || Boolean(item.unavailableReason) || !item.variant?.product?.name;

              return (
                <div key={item.id} className={`flex gap-4 rounded-xl border p-4 transition-shadow hover:shadow-sm ${isItemUnavailable ? "border-rose-300 bg-rose-50/40" : "border-[var(--color-border)] bg-[var(--color-bg-surface)]"}`}>
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

                    {isItemUnavailable && (
                      <div className="mt-2 text-xs font-semibold text-rose-700 bg-rose-100/70 border border-rose-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5">
                        <span>⚠️</span>
                        <span>{item.unavailableReason || "Product is no longer available"}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--color-border)]/60">
                      <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-base)]">
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          disabled={isItemMutating(item.id) || item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors disabled:opacity-40"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="flex h-8 w-10 items-center justify-center text-xs font-semibold border-x border-[var(--color-border)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isItemMutating(item.id) || item.quantity >= (item.variant?.inventory?.quantity ?? 999)}
                          className="flex h-8 w-8 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors disabled:opacity-40"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveForLater(item)}
                          disabled={isItemMutating(item.id) || savingItemIds[item.id]}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40"
                        >
                          {savingItemIds[item.id] ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Bookmark size={13} />
                          )}
                          Save for later
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isItemMutating(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                          title="Remove item"
                        >
                          {isItemMutating(item.id) ? (
                            <Loader2 size={14} className="animate-spin text-[var(--color-accent)]" />
                          ) : (
                            <Trash2 size={14} />
                          )}
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
                  const isMovingThis = movingItemIds[wish.id];
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
                            onClick={() => handleMoveToCart(wish)}
                            disabled={isMovingThis}
                            className="text-[11px] font-semibold text-white bg-[var(--color-primary)] px-2.5 py-1 rounded-md hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {isMovingThis && <Loader2 size={11} className="animate-spin" />}
                            {isMovingThis ? "Moving..." : "Move to Cart"}
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
            {localCouponError && <p className="mt-2 text-xs text-red-500 font-medium">{localCouponError}</p>}
            {appliedCoupon && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-medium">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <div>
                    <span>Code <strong>{appliedCoupon.code}</strong> applied</span>
                    {appliedCoupon.isProductSpecific && (
                      <span className="ml-1 text-[10px] text-purple-700 bg-purple-100 px-1 py-0.5 rounded font-semibold">
                        Eligible Items
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeCoupon()}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-2 shrink-0"
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
                <span>Included 18% GST (CGST 9% + SGST 9%)</span>
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

            {hasUnavailableItems ? (
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-400 py-3.5 text-sm font-semibold text-white cursor-not-allowed opacity-80"
                >
                  Remove unavailable items to checkout
                </button>
                <p className="text-[11px] text-center text-rose-600 font-medium">
                  Please remove unavailable items from your cart before proceeding.
                </p>
              </div>
            ) : (
              <Link
                href="/checkout"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-md active:scale-[0.99]"
              >
                Proceed to Checkout <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}