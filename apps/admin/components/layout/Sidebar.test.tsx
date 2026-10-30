import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/stores/ui.store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
}));

describe("Sidebar", () => {
  beforeEach(() => {
    useUiStore.setState({ mobileSidebarOpen: false });
  });

  it("renders AuraZone logo and navigation sections", () => {
    render(<Sidebar />);

    expect(screen.getByText("AuraZone")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders navigation items with correct href attributes", () => {
    render(<Sidebar />);

    const ordersLink = screen.getByRole("link", { name: /orders/i });
    expect(ordersLink).toHaveAttribute("href", "/orders");

    const productsLink = screen.getByRole("link", { name: /products/i });
    expect(productsLink).toHaveAttribute("href", "/products");

    const storesLink = screen.getByRole("link", { name: /stores/i });
    expect(storesLink).toHaveAttribute("href", "/stores");
  });

  it("toggles collapsed state on desktop collapse button click", () => {
    render(<Sidebar />);

    // Collapse button
    const collapseButton = screen.getByTitle("Collapse sidebar");
    fireEvent.click(collapseButton);

    // Group headings should be hidden in collapsed mode
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();

    // Expand again
    const expandButton = screen.getByTitle("Expand sidebar");
    fireEvent.click(expandButton);
    expect(screen.getByText("Operations")).toBeInTheDocument();
  });

  it("handles mobile sidebar open overlay and close button", () => {
    useUiStore.setState({ mobileSidebarOpen: true });
    render(<Sidebar />);

    const closeButtons = screen.getAllByRole("button");
    const mobileClose = closeButtons[0];
    fireEvent.click(mobileClose);

    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
  });
});

