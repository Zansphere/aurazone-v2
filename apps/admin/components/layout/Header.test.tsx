import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Header } from "./Header";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

vi.mock("./NotificationDropdown", () => ({
  NotificationDropdown: () => <div data-testid="notification-dropdown">Notifications</div>,
}));

vi.mock("./SearchModal", () => ({
  SearchModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="search-modal">Search Modal Open</div> : null,
}));

describe("Header", () => {
  const logoutMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: "admin-1",
        email: "sarah.admin@aurazone.shop",
        fullName: "Sarah Admin",
        avatar: null,
        role: "SUPER_ADMIN",
      },
      logout: logoutMock,
    });
    useUiStore.setState({ mobileSidebarOpen: false });
  });

  it("renders user information and initials correctly", () => {
    render(<Header />);

    expect(screen.getByText("Sarah Admin")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("SA")).toBeInTheDocument(); // Initials
  });

  it("opens search modal when search trigger button is clicked", () => {
    render(<Header />);

    expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();

    const searchButton = screen.getByText("Search...").closest("button")!;
    fireEvent.click(searchButton);

    expect(screen.getByTestId("search-modal")).toBeInTheDocument();
  });

  it("opens search modal on Ctrl+K / Cmd+K shortcut", () => {
    render(<Header />);

    expect(screen.queryByTestId("search-modal")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("search-modal")).toBeInTheDocument();
  });

  it("triggers mobile sidebar toggle when mobile menu icon is clicked", () => {
    render(<Header />);

    const menuButton = screen.getAllByRole("button")[0]; // first button is mobile menu toggle
    fireEvent.click(menuButton);

    expect(useUiStore.getState().mobileSidebarOpen).toBe(true);
  });

  it("calls logout and redirects to /login on logout action", async () => {
    render(<Header />);

    // Click user trigger
    fireEvent.click(screen.getByText("Sarah Admin"));

    // Click Logout item
    const logoutItem = screen.getByText("Sign out");
    fireEvent.click(logoutItem);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });
});

