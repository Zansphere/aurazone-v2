import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SearchModal } from "./SearchModal";
import { renderWithQueryClient } from "@/test-utils/test-wrapper";
import { api } from "@/lib/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

describe("SearchModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = renderWithQueryClient(
      <SearchModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders search input and navigation links when open and query is empty", () => {
    renderWithQueryClient(<SearchModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText(/search orders, products, customers/i)).toBeInTheDocument();
    expect(screen.getByText("Quick Navigation")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });

  it("calls onClose when escape key is pressed", () => {
    const onClose = vi.fn();
    renderWithQueryClient(<SearchModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls search API and renders grouped search results", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        orders: [
          {
            id: "ord-1",
            orderNumber: "ORD-9999",
            totalAmount: 1499,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            user: { fullName: "Alice Smith", email: "alice@example.com" },
            orderAddress: { name: "Alice" },
          },
        ],
        products: [
          {
            id: "prod-1",
            name: "Summer Silk Dress",
            brand: "Aura Fashion",
            store: { name: "Aura Fashion" },
          },
        ],
        stores: [
          {
            id: "store-1",
            name: "Aura Cosmetics",
            slug: "aura-cosmetics",
          },
        ],
        customers: [],
      },
    });

    renderWithQueryClient(<SearchModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/search orders, products, customers/i);
    fireEvent.change(input, { target: { value: "Silk" } });

    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith("/admin/search?q=Silk");
        expect(screen.getByText("Summer Silk Dress")).toBeInTheDocument();
        expect(screen.getByText("ORD-9999")).toBeInTheDocument();
        expect(screen.getByText("Aura Cosmetics")).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  it("navigates to selected product and closes modal", async () => {
    const onClose = vi.fn();
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: {
        orders: [],
        products: [
          {
            id: "prod-1",
            name: "Summer Silk Dress",
            brand: "Aura Fashion",
            store: { name: "Aura Fashion" },
          },
        ],
        stores: [],
        customers: [],
      },
    });

    renderWithQueryClient(<SearchModal isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText(/search orders, products, customers/i);
    fireEvent.change(input, { target: { value: "Silk" } });

    await waitFor(
      () => {
        expect(screen.getByText("Summer Silk Dress")).toBeInTheDocument();
      },
      { timeout: 1500 }
    );

    fireEvent.click(screen.getByText("Summer Silk Dress"));

    expect(mockPush).toHaveBeenCalledWith("/products/prod-1");
    expect(onClose).toHaveBeenCalled();
  });
});

