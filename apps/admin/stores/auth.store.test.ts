import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "./auth.store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });
  });

  it("should have correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  describe("login", () => {
    it("should successfully log in, set localStorage token, and update state", async () => {
      const mockUser = {
        id: "admin-1",
        email: "admin@aurazone.shop",
        fullName: "Super Admin",
        avatar: null,
        role: "SUPER_ADMIN",
      };

      vi.mocked(api.post).mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser,
          accessToken: "jwt-token-xyz",
        },
      });

      await useAuthStore.getState().login("admin@aurazone.shop", "secret123");

      expect(api.post).toHaveBeenCalledWith("/auth/login", {
        email: "admin@aurazone.shop",
        password: "secret123",
      });
      expect(localStorage.getItem("accessToken")).toBe("jwt-token-xyz");
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("should not set authentication if login response data is missing", async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        success: false,
      });

      await useAuthStore.getState().login("admin@aurazone.shop", "wrong");

      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("logout", () => {
    it("should remove token and clear authentication state", async () => {
      localStorage.setItem("accessToken", "jwt-token-xyz");
      useAuthStore.setState({
        user: { id: "1", email: "test@example.com", fullName: "Admin", avatar: null, role: "SUPER_ADMIN" },
        isAuthenticated: true,
      });

      vi.mocked(api.post).mockResolvedValueOnce({ success: true });

      await useAuthStore.getState().logout();

      expect(api.post).toHaveBeenCalledWith("/auth/logout");
      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("should clear state even if API call fails", async () => {
      localStorage.setItem("accessToken", "jwt-token-xyz");
      useAuthStore.setState({
        user: { id: "1", email: "test@example.com", fullName: "Admin", avatar: null, role: "SUPER_ADMIN" },
        isAuthenticated: true,
      });

      vi.mocked(api.post).mockRejectedValueOnce(new Error("Network failure"));

      await expect(useAuthStore.getState().logout()).rejects.toThrow("Network failure");

      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe("fetchUser", () => {
    it("should fetch current user and mark isAuthenticated: true", async () => {
      const mockUser = {
        id: "admin-1",
        email: "admin@aurazone.shop",
        fullName: "Super Admin",
        avatar: null,
        role: "SUPER_ADMIN",
      };

      vi.mocked(api.get).mockResolvedValueOnce({
        success: true,
        data: { user: mockUser },
      });

      await useAuthStore.getState().fetchUser();

      expect(api.get).toHaveBeenCalledWith("/auth/me");
      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should handle 401 or network error by setting user: null and isAuthenticated: false", async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error("Unauthorized"));

      await useAuthStore.getState().fetchUser();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
