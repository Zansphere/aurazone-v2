import { create } from 'zustand';
import { api } from '@/lib/api';

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  isAvailable?: boolean;
  availableStock?: number;
  unavailableReason?: string | null;
  variant: {
    id: string;
    product: {
      id: string;
      name: string;
      slug: string;
      store: {
        id: string;
        name: string;
        slug: string;
      }
    };
    images: Array<{ url: string }>;
    attributes: Array<{ key: string; value: string }>;
    inventory?: { quantity: number };
  };
}

export interface Cart {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  status: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hasUnavailableItems?: boolean;
  canCheckout?: boolean;
}

interface CartStore {
  cart: Cart | null;
  isLoading: boolean;
  isOpen: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  setIsOpen: (isOpen: boolean) => void;
  initGuestSession: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart: null,
  isLoading: false,
  isOpen: false,

  setIsOpen: (isOpen) => set({ isOpen }),

  initGuestSession: async () => {
    // Check if we need a guest session
    const hasGuestSession = typeof window !== "undefined" ? localStorage.getItem("guest_session_id") : null;
    if (!hasGuestSession) {
      try {
        const res = await api.post<{ sessionId: string, guestId: string }>("/sessions");
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
      const res = await api.get<Cart>('/cart');
      if (res.success && res.data) {
        set({ cart: res.data });
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addToCart: async (variantId, quantity) => {
    set({ isLoading: true });
    try {
      await get().initGuestSession();
      const res = await api.post('/cart', { variantId, quantity });
      if (res.success) {
        await get().fetchCart();
        set({ isOpen: true }); // Open cart drawer on success
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateQuantity: async (itemId, quantity) => {
    set({ isLoading: true });
    try {
      if (quantity <= 0) {
        await get().removeItem(itemId);
        return;
      }
      const res = await api.patch(`/cart/${itemId}`, { quantity });
      if (res.success) {
        await get().fetchCart();
      }
    } catch (error) {
      console.error('Failed to update cart quantity:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (itemId) => {
    set({ isLoading: true });
    try {
      const res = await api.delete(`/cart/${itemId}`);
      if (res.success) {
        await get().fetchCart();
      }
    } catch (error) {
      console.error('Failed to remove cart item:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearCart: async () => {
    set({ isLoading: true });
    try {
      const res = await api.delete('/cart');
      if (res.success) {
        set({ cart: null });
      }
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  }
}));
