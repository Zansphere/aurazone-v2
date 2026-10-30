import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ProductsTab from "./ProductsTab";
import { renderWithQueryClient } from "@/test-utils/test-wrapper";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/components/stores/ProductForm", () => ({
  default: ({ onClose, productId }: { onClose: () => void; productId?: string | null }) => (
    <div data-testid="mock-product-form">
      <span>{productId ? `Editing Product ${productId}` : "Create Product Form"}</span>
      <button onClick={onClose}>Close Form</button>
    </div>
  ),
}));

describe("ProductsTab", () => {
  const mockProducts = [
    {
      id: "prod-1",
      name: "Hydrating Facial Cream",
      slug: "hydrating-facial-cream",
      brand: "GlowLab",
      isActive: true,
      isFeatured: true,
      category: { id: "cat-1", name: "Skincare", slug: "skincare" },
      variants: [
        {
          id: "var-1",
          price: 1299,
          compareAtPrice: 1599,
          images: [{ url: "https://example.com/cream.jpg" }],
          inventory: { quantity: 45, reserved: 2 },
        },
      ],
      _count: { variants: 1 },
      createdAt: new Date().toISOString(),
    },
  ];

  const mockCategories = [
    { id: "cat-1", name: "Skincare", slug: "skincare" },
    { id: "cat-2", name: "Makeup", slug: "makeup" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("fetches and renders products list", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/admin/categories")) {
        return Promise.resolve({ success: true, data: mockCategories });
      }
      return Promise.resolve({ success: true, data: mockProducts });
    });

    renderWithQueryClient(<ProductsTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hydrating Facial Cream")).toBeInTheDocument();
      expect(screen.getByText("GlowLab")).toBeInTheDocument();
      expect(screen.getByText("43 in stock")).toBeInTheDocument(); // 45 qty - 2 reserved
      expect(screen.getAllByText("Skincare").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("switches to ProductForm when 'Add Product' button is clicked", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/admin/categories")) {
        return Promise.resolve({ success: true, data: mockCategories });
      }
      return Promise.resolve({ success: true, data: mockProducts });
    });

    renderWithQueryClient(<ProductsTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hydrating Facial Cream")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add product/i });
    fireEvent.click(addBtn);

    expect(screen.getByTestId("mock-product-form")).toBeInTheDocument();
    expect(screen.getByText("Create Product Form")).toBeInTheDocument();

    // Closing form returns to list
    fireEvent.click(screen.getByText("Close Form"));
    expect(screen.queryByTestId("mock-product-form")).not.toBeInTheDocument();
  });

  it("triggers toggle active mutation when toggle status button is clicked", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/admin/categories")) {
        return Promise.resolve({ success: true, data: mockCategories });
      }
      return Promise.resolve({ success: true, data: mockProducts });
    });
    vi.mocked(api.put).mockResolvedValueOnce({ success: true });

    renderWithQueryClient(<ProductsTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hydrating Facial Cream")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTitle("Click to deactivate");
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith("/admin/products/prod-1", { isActive: false });
    });
  });

  it("triggers delete mutation when delete button is clicked and confirmed", async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes("/admin/categories")) {
        return Promise.resolve({ success: true, data: mockCategories });
      }
      return Promise.resolve({ success: true, data: mockProducts });
    });
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    renderWithQueryClient(<ProductsTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hydrating Facial Cream")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Delete product");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/admin/products/prod-1");
    });
  });
});

