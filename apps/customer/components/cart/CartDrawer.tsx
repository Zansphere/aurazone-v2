"use client";

import { useCartStore } from "@/stores/cart.store";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CartDrawer() {
  const { cart, isOpen, setIsOpen, updateQuantity, removeItem, isLoading } = useCartStore();
  const router = useRouter();

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  const items = cart?.items ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div 
        className="relative flex h-full w-full max-w-md flex-col bg-[var(--color-bg-surface)] shadow-[var(--shadow-xl)]"
        style={{ animation: "slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-bold font-[var(--font-heading)] flex items-center gap-2 text-[var(--color-text-primary)]">
            <ShoppingBag size={20} />
            Your Cart
            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-[11px] text-[var(--color-text-secondary)] font-bold">
              {new Set(cart?.items?.map((item) => item.productId || (item as any).variant?.product?.id || item.variantId)).size}
            </span>
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center space-y-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-bg-muted)]">
                <ShoppingBag size={32} className="text-[var(--color-text-tertiary)]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">Your cart is empty</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Looks like you haven't added anything yet.</p>
              </div>
              <button
                onClick={() => { setIsOpen(false); router.push("/products"); }}
                className="btn-primary mt-4"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 group">
                  <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bg-muted)] border border-[var(--color-border)]">
                    {item.variant.images?.[0] ? (
                      <img src={item.variant.images[0].url} alt={item.variant.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--color-text-tertiary)]">
                        <ShoppingBag size={20} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between py-1">
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                            {item.variant.product.store.name}
                          </p>
                          <Link 
                            href={`/product/${item.variant.product.slug}`} 
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 hover:underline"
                          >
                            {item.variant.product.name}
                          </Link>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          disabled={isLoading}
                          className="text-[var(--color-text-tertiary)] hover:text-red-500 transition-colors shrink-0 pt-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      {/* Attributes */}
                      <div className="flex flex-wrap gap-x-2 text-[11px] text-[var(--color-text-secondary)]">
                        {item.variant.attributes.map(attr => (
                          <span key={attr.key}>{attr.value}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-0.5">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={isLoading || item.quantity <= 1}
                          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isLoading || item.quantity >= (item.variant.inventory?.quantity ?? 0)}
                          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] disabled:opacity-50"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <p className="font-bold text-sm text-[var(--color-text-primary)]">
                        {"\u20B9"}{Number(item.unitPrice).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 space-y-4">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-[var(--color-text-secondary)]">Subtotal</span>
              <span className="font-bold text-xl text-[var(--color-text-primary)]">
                {"\u20B9"}{Number(cart?.subtotal ?? 0).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] text-center">
              Taxes and shipping calculated at checkout.
            </p>
            {cart?.hasUnavailableItems || items.some((it: any) => it.isAvailable === false || it.unavailableReason || !it.variant?.product?.name) ? (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full py-4 text-sm font-semibold rounded-xl bg-gray-400 text-white cursor-not-allowed opacity-80"
                >
                  Remove unavailable items to checkout
                </button>
                <p className="text-[11px] text-center text-rose-600 font-medium">
                  Some items in your cart are no longer available.
                </p>
              </div>
            ) : (
              <button
                onClick={() => { setIsOpen(false); router.push("/checkout"); }}
                className="btn-primary w-full py-4 text-base flex justify-center items-center gap-2 group"
              >
                Proceed to Checkout
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
