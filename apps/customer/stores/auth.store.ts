"use client";
import { create } from "zustand";
import { api } from "@/lib/api";
import { useCartStore } from "./cart.store";

interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
  role: string;
  isEmailVerified?: string | Date | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, isLoading: true, isAuthenticated: false,

  login: async (email, password) => {
    const res = await api.post<{ user: User }>("/auth/login", { email, password });
    if (res.data) {
      set({ user: res.data.user, isAuthenticated: true });
      localStorage.removeItem("guest_session_id");
      useCartStore.getState().fetchCart();
    }
  },

  signup: async (email, password, fullName) => {
    const res = await api.post<{ user: User }>("/auth/signup", { email, password, fullName });
    if (res.data) {
      set({ user: res.data.user, isAuthenticated: true });
      localStorage.removeItem("guest_session_id");
      useCartStore.getState().fetchCart();
    }
  },

  logout: async () => {
    await api.post("/auth/logout");
    set({ user: null, isAuthenticated: false });
    useCartStore.getState().fetchCart();
  },

  fetchUser: async () => {
    try {
      const res = await api.get<{ user: User }>("/auth/me");
      if (res.data) {
        set({ user: res.data.user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch { 
      set({ user: null, isAuthenticated: false, isLoading: false }); 
    }
  },

  resendVerification: async () => {
    await api.post("/auth/resend-verification");
  },
}));