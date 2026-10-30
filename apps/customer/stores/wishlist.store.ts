import { create } from "zustand";
import { api } from "@/lib/api";
import { useAuthStore } from "./auth.store";

export interface WishlistItem {
  id: string;
  wishlistId?: string;
  productId: string;
  variantId?: string | null;
  addedAt?: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    brand?: string;
    store?: { id: string; name: string; slug: string };
    variants?: Array<{
      id: string;
      price: number | string;
      compareAtPrice?: number | string | null;
      images?: Array<{ url: string }>;
    }>;
  };
}

interface WishlistStore {
  items: WishlistItem[];
  itemIds: Set<string>;
  isLoading: boolean;
  isInitialized: boolean;
  fetchWishlist: () => Promise<void>;
  hasItem: (productId: string) => boolean;
  toggle: (productId: string, variantId?: string, productData?: any) => Promise<boolean>;
  removeItem: (itemId: string, productId?: string) => Promise<void>;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  itemIds: new Set<string>(),
  isLoading: false,
  isInitialized: false,

  hasItem: (productId: string) => {
    return get().itemIds.has(productId);
  },

  clearWishlist: () => {
    set({ items: [], itemIds: new Set(), isInitialized: false });
  },

  fetchWishlist: async () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      set({ items: [], itemIds: new Set(), isInitialized: true });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await api.get<WishlistItem[]>("/wishlist");
      if (res.success && Array.isArray(res.data)) {
        const itemIds = new Set(res.data.map((i) => i.productId || i.product?.id || ""));
        itemIds.delete("");
        set({ items: res.data, itemIds, isInitialized: true });
      }
    } catch (err) {
      console.error("Failed to fetch wishlist:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  toggle: async (productId: string, variantId?: string, productData?: any): Promise<boolean> => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
      return false;
    }

    const currentItems = get().items;
    const currentItemIds = new Set(get().itemIds);
    const existing = currentItems.find(
      (i) => i.productId === productId || i.product?.id === productId
    );

    if (existing) {
      // 1. Optimistic removal (0ms UI latency)
      const nextItems = currentItems.filter((i) => i.id !== existing.id);
      currentItemIds.delete(productId);
      set({ items: nextItems, itemIds: currentItemIds });

      try {
        await api.delete(`/wishlist/${existing.id}`);
        return false;
      } catch (err) {
        // Rollback on network failure
        console.error("Failed to remove from wishlist:", err);
        set({ items: currentItems, itemIds: get().itemIds.add(productId) });
        return true;
      }
    } else {
      // 2. Optimistic addition (0ms UI latency)
      const tempId = `temp-${Date.now()}`;
      const optimisticItem: WishlistItem = {
        id: tempId,
        productId,
        variantId: variantId ?? null,
        addedAt: new Date().toISOString(),
        product: productData,
      };

      currentItemIds.add(productId);
      set({ items: [optimisticItem, ...currentItems], itemIds: currentItemIds });

      try {
        const res = await api.post<WishlistItem>("/wishlist", {
          productId,
          variantId,
        });

        if (res.success && res.data) {
          // Reconcile server id
          set((state) => ({
            items: state.items.map((it) => (it.id === tempId ? { ...it, ...res.data } : it)),
          }));
        }
        return true;
      } catch (err) {
        // Rollback on network failure
        console.error("Failed to add to wishlist:", err);
        currentItemIds.delete(productId);
        set({ items: currentItems, itemIds: currentItemIds });
        return false;
      }
    }
  },

  removeItem: async (itemId: string, productId?: string) => {
    const currentItems = get().items;
    const currentItemIds = new Set(get().itemIds);

    const targetItem = currentItems.find((i) => i.id === itemId);
    const pId = productId || targetItem?.productId || targetItem?.product?.id;

    // Optimistic removal (0ms)
    const nextItems = currentItems.filter((i) => i.id !== itemId);
    if (pId) currentItemIds.delete(pId);
    set({ items: nextItems, itemIds: currentItemIds });

    try {
      await api.delete(`/wishlist/${itemId}`);
    } catch (err) {
      console.error("Failed to remove wishlist item:", err);
      // Rollback
      set({ items: currentItems, itemIds: get().itemIds.add(pId || "") });
    }
  },
}));

