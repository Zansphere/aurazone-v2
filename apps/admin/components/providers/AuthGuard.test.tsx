import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AuthGuard } from "./AuthGuard";
import { useAuthStore } from "@/stores/auth.store";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

describe("AuthGuard", () => {
  const fetchUserMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show loading spinner while checking authentication", () => {
    useAuthStore.setState({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      fetchUser: fetchUserMock,
    });

    render(
      <AuthGuard>
        <div>Admin Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(fetchUserMock).toHaveBeenCalled();
  });

  it("should redirect to /login if user is not authenticated", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      fetchUser: fetchUserMock,
    });

    const { container } = render(
      <AuthGuard>
        <div>Admin Content</div>
      </AuthGuard>
    );

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should show 403 Forbidden if user is authenticated but not SUPER_ADMIN", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "cust-1",
        email: "customer@example.com",
        fullName: "Regular User",
        avatar: null,
        role: "CUSTOMER",
      },
      fetchUser: fetchUserMock,
    });

    render(
      <AuthGuard>
        <div>Admin Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should render children when user is authenticated with SUPER_ADMIN role", () => {
    useAuthStore.setState({
      isLoading: false,
      isAuthenticated: true,
      user: {
        id: "admin-1",
        email: "admin@aurazone.shop",
        fullName: "Super Admin",
        avatar: null,
        role: "SUPER_ADMIN",
      },
      fetchUser: fetchUserMock,
    });

    render(
      <AuthGuard>
        <div>Protected Admin Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Protected Admin Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.queryByText("403 Forbidden")).not.toBeInTheDocument();
  });
});

