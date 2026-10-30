import { create } from "zustand";
import { api } from "@/lib/api";

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  isAvailable?: boolean;
  availableStock?: number;
  unavailableReason?: string | null;
  variant: {
    id: string;
    product: {
      id: string;
      name: string;
      slug: string;
      store?: {
        id: string;
        name: string;
        slug: string;
      };
    };
    images: Array<{ url: string }>;
    attributes: Array<{ key: string; value: string }>;
    inventory?: { quantity: number; reserved?: number };
  };
}

export interface CartItemPreview {
  productName?: string;
  productSlug?: string;
  variantName?: string;
  imageUrl?: string;
  price?: number;
  productId?: string;
  unitPrice?: number | string;
  variant?: CartItem["variant"];
}

export interface Cart {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  status: string;
  items: CartItem[];
  itemCount: number;
  totalQuantity?: number;
  subtotal: number;
  hasUnavailableItems?: boolean;
  canCheckout?: boolean;
}

interface CartStore {
  cart: Cart | null;
  isLoading: boolean;
  isOpen: boolean;
  addingVariantIds: Record<string, boolean>;
  mutatingItemIds: Record<string, boolean>;
  isVariantAdding: (variantId: string) => boolean;
  isItemMutating: (itemId: string) => boolean;
  setIsOpen: (isOpen: boolean) => void;
  fetchCart: () => Promise<void>;
  addToCart: (
    variantId: string,
    quantity: number,
    preview?: CartItemPreview,
    openDrawer?: boolean
  ) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  initGuestSession: () => Promise<void>;
}

function calculateCartTotals(items: CartItem[]) {
  const validItems = items.filter((i) => i.isAvailable !== false);
  const subtotal = validItems.reduce((sum, item) => {
    const price = typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) : item.unitPrice;
    return sum + (isNaN(price) ? 0 : price * item.quantity);
  }, 0);

  const uniqueProductIds = new Set(
    items.map((i) => i.productId || i.variant?.product?.id || i.variantId)
  );
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasUnavailableItems = items.some((i) => i.isAvailable === false);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    itemCount: uniqueProductIds.size,
    totalQuantity,
    hasUnavailableItems,
    canCheckout: items.length > 0 && !hasUnavailableItems,
  };
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  isLoading: false,
  isOpen: false,
  addingVariantIds: {},
  mutatingItemIds: {},

  isVariantAdding: (variantId: string) => Boolean(get().addingVariantIds[variantId]),
  isItemMutating: (itemId: string) => Boolean(get().mutatingItemIds[itemId]),

  setIsOpen: (isOpen) => set({ isOpen }),

  initGuestSession: async () => {
    if (typeof window === "undefined") return;
    const hasGuestSession = localStorage.getItem("guest_session_id");
    if (!hasGuestSession) {
      try {
        const res = await api.post<{ sessionId: string; guestId: string }>("/sessions");
        if (res.success && res.data) {
          localStorage.setItem("guest_session_id", res.data.guestId);
        }
      } catch (e) {
        console.error("Failed to init guest session", e);
      }
    }
  },

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      await get().initGuestSession();
      const res = await api.get<Cart>("/cart");
      if (res.success && res.data) {
        set({ cart: res.data });
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addToCart: async (variantId, quantity, preview, openDrawer = true) => {
    // 1. Scoped loading state (only for this specific variant button)
    set((state) => ({
      addingVariantIds: { ...state.addingVariantIds, [variantId]: true },
    }));

    const currentCart = get().cart;
    const previousSnapshot = currentCart ? JSON.parse(JSON.stringify(currentCart)) : null;

    // 2. Optimistic Update (instant UI feedback in 0ms)
    if (currentCart) {
      const existingIdx = currentCart.items.findIndex((i) => i.variantId === variantId);
      let updatedItems = [...currentCart.items];

      if (existingIdx >= 0) {
        const existing = updatedItems[existingIdx];
        updatedItems[existingIdx] = {
          ...existing,
          quantity: existing.quantity + quantity,
        };
      } else if (preview) {
        const optimisticItem: CartItem = {
          id: `temp-${Date.now()}`,
          cartId: currentCart.id,
          variantId,
          productId: preview.productId || preview.variant?.product?.id || "",
          quantity,
          unitPrice: preview.price ?? preview.unitPrice ?? 0,
          isAvailable: true,
          variant: preview.variant || {
            id: variantId,
            product: {
              id: preview.productId || "",
              name: preview.productName || "Product",
              slug: preview.productSlug || "",
            },
            images: preview.imageUrl ? [{ url: preview.imageUrl }] : [],
            attributes: preview.variantName ? [{ key: "Option", value: preview.variantName }] : [],
          },
        };
        updatedItems = [optimisticItem, ...updatedItems];
      }

      const totals = calculateCartTotals(updatedItems);
      set({
        cart: {
          ...currentCart,
          items: updatedItems,
          ...totals,
        },
      });
    }

    try {
      await get().initGuestSession();
      const res = await api.post<Cart>("/cart", { variantId, quantity });

      if (res.success && res.data && Array.isArray((res.data as any).items)) {
        // Direct synchronization from single network response
        set({
          cart: res.data as Cart,
          isOpen: openDrawer ? true : get().isOpen,
        });
      } else {
        // Fallback sync
        await get().fetchCart();
        if (openDrawer) set({ isOpen: true });
      }
    } catch (error) {
      console.error("Failed to add to cart:", error);
      // Rollback on network failure
      if (previousSnapshot) {
        set({ cart: previousSnapshot });
      }
      throw error;
    } finally {
      set((state) => {
        const nextAdding = { ...state.addingVariantIds };
        delete nextAdding[variantId];
        return { addingVariantIds: nextAdding };
      });
    }
  },

  updateQuantity: async (itemId, quantity) => {
    const currentCart = get().cart;
    if (!currentCart) return;

    const previousSnapshot = JSON.parse(JSON.stringify(currentCart));

    // 1. Mark specific item as mutating (0ms freeze for other items)
    set((state) => ({
      mutatingItemIds: { ...state.mutatingItemIds, [itemId]: true },
    }));

    // 2. Optimistic Update (instant UI feedback in 0ms)
    let updatedItems: CartItem[];
    if (quantity <= 0) {
      updatedItems = currentCart.items.filter((i) => i.id !== itemId);
    } else {
      updatedItems = currentCart.items.map((i) =>
        i.id === itemId ? { ...i, quantity } : i
      );
    }

    const totals = calculateCartTotals(updatedItems);
    set({
      cart: {
        ...currentCart,
        items: updatedItems,
        ...totals,
      },
    });

    try {
      const res = await api.patch<Cart>(`/cart/${itemId}`, { quantity });
      if (res.success && res.data && Array.isArray((res.data as any).items)) {
        set({ cart: res.data as Cart });
      }
    } catch (error) {
      console.error("Failed to update cart quantity:", error);
      // Rollback on failure
      set({ cart: previousSnapshot });
      throw error;
    } finally {
      set((state) => {
        const nextMutating = { ...state.mutatingItemIds };
        delete nextMutating[itemId];
        return { mutatingItemIds: nextMutating };
      });
    }
  },

  removeItem: async (itemId) => {
    const currentCart = get().cart;
    if (!currentCart) return;

    const previousSnapshot = JSON.parse(JSON.stringify(currentCart));

    // 1. Scoped mutating status
    set((state) => ({
      mutatingItemIds: { ...state.mutatingItemIds, [itemId]: true },
    }));

    // 2. Optimistic Removal (vanishes instantly in 0ms)
    const updatedItems = currentCart.items.filter((i) => i.id !== itemId);
    const totals = calculateCartTotals(updatedItems);
    set({
      cart: {
        ...currentCart,
        items: updatedItems,
        ...totals,
      },
    });

    try {
      const res = await api.delete<Cart>(`/cart/${itemId}`);
      if (res.success && res.data && Array.isArray((res.data as any).items)) {
        set({ cart: res.data as Cart });
      }
    } catch (error) {
      console.error("Failed to remove cart item:", error);
      // Rollback
      set({ cart: previousSnapshot });
      throw error;
    } finally {
      set((state) => {
        const nextMutating = { ...state.mutatingItemIds };
        delete nextMutating[itemId];
        return { mutatingItemIds: nextMutating };
      });
    }
  },

  clearCart: async () => {
    set({ cart: null });
    try {
      await api.delete("/cart");
    } catch (error) {
      console.error("Failed to clear cart:", error);
      await get().fetchCart();
    }
  },
}));
