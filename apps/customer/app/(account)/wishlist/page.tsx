"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Heart, Trash2, ShoppingCart, Package } from "lucide-react";
import Link from "next/link";
import { AuthGate } from "@/components/providers/AuthGate";

export default function WishlistPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<any[]>("/wishlist"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wishlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const moveToCartMutation = useMutation({
    mutationFn: (id: string) => api.post(`/wishlist/${id}/move-to-cart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const items = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 shimmer rounded-2xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent-light)] mb-4">
          <Heart size={28} className="text-[var(--color-accent)]" />
        </div>
        <p className="text-base font-semibold text-[var(--color-text-primary)]">Your wishlist is empty</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-xs">
          Save items you love and come back to them anytime.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <AuthGate pageLabel="your wishlist" icon={<Heart size={28} className="text-[var(--color-accent)]" />}>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{items.length} item{items.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((item: any) => {
          const product = item.product;
          const variant = product?.variants?.[0];
          const imageUrl = variant?.images?.[0]?.url;
          const isRemoving = removeMutation.isPending;
          const isMoving = moveToCartMutation.isPending;

          return (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-bg-muted)]">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={product?.name ?? ""}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package size={36} className="text-[var(--color-text-tertiary)]" />
                  </div>
                )}
                {/* Remove button */}
                <button
                  onClick={() => removeMutation.mutate(item.id)}
                  disabled={isRemoving}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[var(--color-text-secondary)] shadow-sm backdrop-blur-sm transition-all hover:bg-red-50 hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  {product?.store && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-0.5">
                      {product.store.name}
                    </p>
                  )}
                  <Link
                    href={`/product/${product?.slug}`}
                    className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] line-clamp-2 leading-snug"
                  >
                    {product?.name}
                  </Link>
                  {variant && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <p className="text-base font-bold text-[var(--color-text-primary)]">
                        ₹{Number(variant.price).toLocaleString()}
                      </p>
                      {variant.compareAtPrice && Number(variant.compareAtPrice) > Number(variant.price) && (
                        <p className="text-xs text-[var(--color-text-tertiary)] line-through">
                          ₹{Number(variant.compareAtPrice).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => moveToCartMutation.mutate(item.id)}
                  disabled={isMoving}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2.5 text-xs font-semibold text-white transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 active:scale-[0.98]"
                >
                  <ShoppingCart size={13} />
                  {isMoving ? "Moving..." : "Add to Cart"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </AuthGate>
  );
}