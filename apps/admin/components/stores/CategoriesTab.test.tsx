import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import CategoriesTab from "./CategoriesTab";
import { renderWithQueryClient } from "@/test-utils/test-wrapper";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("CategoriesTab", () => {
  const mockCategories = [
    {
      id: "cat-1",
      name: "Skincare",
      slug: "skincare",
      description: "Skincare items",
      imageUrl: null,
      isActive: true,
      sortOrder: 1,
      parentId: null,
      parent: null,
      children: [
        {
          id: "cat-sub-1",
          name: "Serums",
          slug: "serums",
          isActive: true,
        },
      ],
      _count: { products: 15 },
    },
    {
      id: "cat-2",
      name: "Makeup",
      slug: "makeup",
      description: null,
      imageUrl: null,
      isActive: true,
      sortOrder: 2,
      parentId: null,
      parent: null,
      children: [],
      _count: { products: 8 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.get).mockResolvedValue({
      success: true,
      data: mockCategories,
    });
  });

  it("fetches and renders categories list for the store", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/admin/categories?storeId=store-1&take=200");
      expect(screen.getByText("Categories (2)")).toBeInTheDocument();
      expect(screen.getByText("Skincare")).toBeInTheDocument();
      expect(screen.getByText("Makeup")).toBeInTheDocument();
      expect(screen.getByText("15 products")).toBeInTheDocument();
    });
  });

  it("opens create category form when 'Add Category' button is clicked", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skincare")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: /add category/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("New Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
  });

  it("prevents submission and displays duplicate validation error when category name already exists in this store", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skincare")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add category/i }));

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Skincare" } });

    const submitBtn = screen.getByRole("button", { name: /create/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText('A category named "Skincare" already exists in this store.')
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("submits create category successfully for a unique category in this store", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      data: { id: "cat-3", name: "Fragrances", slug: "fragrances" },
    });

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skincare")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add category/i }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fragrances" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/admin/categories", {
        storeId: "store-1",
        name: "Fragrances",
        slug: "fragrances",
        description: undefined,
        parentId: null,
        isActive: true,
      });
    });
  });

  it("displays server error banner when API returns error", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });
    vi.mocked(api.post).mockRejectedValueOnce(
      new Error("A category with this name already exists in this store")
    );

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skincare")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add category/i }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Others" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(
        screen.getByText("A category with this name already exists in this store")
      ).toBeInTheDocument();
    });
  });

  it("calls delete mutation when delete button is clicked and confirmed", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      success: true,
      data: mockCategories,
    });
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    renderWithQueryClient(<CategoriesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skincare")).toBeInTheDocument();
    });

    // The delete buttons
    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.className && btn.className.includes("hover:text-red-500")
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/admin/categories/cat-1");
    });
  });
});
