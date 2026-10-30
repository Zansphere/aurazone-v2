import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { NotificationDropdown } from "./NotificationDropdown";
import { renderWithQueryClient } from "@/test-utils/test-wrapper";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("NotificationDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notification bell and displays unread badge when unreadCount > 0", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        notifications: [
          {
            id: "notif-1",
            title: "New Order #1001",
            body: "Customer placed an order for ₹2,499",
            url: "/orders/1001",
            icon: "order",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unreadCount: 1,
      },
    });

    renderWithQueryClient(<NotificationDropdown />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("opens dropdown on bell click and displays notifications", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        notifications: [
          {
            id: "notif-1",
            title: "New Order #1001",
            body: "Customer placed an order for ₹2,499",
            url: "/orders/1001",
            icon: "order",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unreadCount: 1,
      },
    });

    renderWithQueryClient(<NotificationDropdown />);

    const bellButton = screen.getByRole("button");
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("New Order #1001")).toBeInTheDocument();
      expect(screen.getByText("Customer placed an order for ₹2,499")).toBeInTheDocument();
    });
  });

  it("triggers mark all read mutation when 'Mark all read' is clicked", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        notifications: [
          {
            id: "notif-1",
            title: "Stock Alert",
            body: "Item is low on stock",
            url: "/inventory",
            icon: "stock",
            isRead: false,
            createdAt: new Date().toISOString(),
          },
        ],
        total: 1,
        unreadCount: 1,
      },
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ success: true });

    renderWithQueryClient(<NotificationDropdown />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByTitle("Mark all as read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle("Mark all as read"));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/admin/notifications/read-all");
    });
  });

  it("displays empty state when there are no notifications", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        notifications: [],
        total: 0,
        unreadCount: 0,
      },
    });

    renderWithQueryClient(<NotificationDropdown />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    });
  });
});

