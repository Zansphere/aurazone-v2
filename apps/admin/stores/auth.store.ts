"use client";

import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const res = await api.post<{ user: User; accessToken: string }>("/auth/login", {
      email,
      password,
    });
    if (res.data) {
      if (typeof window !== "undefined" && res.data.accessToken) {
        localStorage.setItem("accessToken", res.data.accessToken);
      }
      set({ user: res.data.user, isAuthenticated: true });
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
      }
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchUser: async () => {
    try {
      const res = await api.get<{ user: User }>("/auth/me");
      if (res.data) {
        set({ user: res.data.user, isAuthenticated: true, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));