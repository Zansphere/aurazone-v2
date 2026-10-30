import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import StoreOverview from "./StoreOverview";
import { renderWithQueryClient } from "@/test-utils/test-wrapper";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    put: vi.fn(),
  },
}));

vi.mock("@/components/ui/ImageUploader", () => ({
  default: () => <div data-testid="mock-image-uploader">Image Uploader</div>,
}));

describe("StoreOverview", () => {
  const mockStore = {
    id: "store-1",
    name: "Aura Cosmetics",
    slug: "aura-cosmetics",
    description: "Premium beauty & skincare",
    logoUrl: "https://example.com/logo.png",
    bannerUrl: "https://example.com/banner.png",
    accentColor: "#E11D48",
    isActive: true,
    _count: { products: 24, categories: 5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders store overview statistics and details", () => {
    renderWithQueryClient(<StoreOverview store={mockStore} />);

    expect(screen.getByText("Aura Cosmetics")).toBeInTheDocument();
    expect(screen.getByText("Premium beauty & skincare")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument(); // products count
    expect(screen.getByText("5")).toBeInTheDocument(); // categories count
  });

  it("switches to edit form when Edit Details button is clicked", () => {
    renderWithQueryClient(<StoreOverview store={mockStore} />);

    const editBtn = screen.getByRole("button", { name: /edit details/i });
    fireEvent.click(editBtn);

    expect(screen.getByLabelText("Store Name")).toHaveValue("Aura Cosmetics");
    expect(screen.getByLabelText("Slug")).toHaveValue("aura-cosmetics");
    expect(screen.getByLabelText("Description")).toHaveValue("Premium beauty & skincare");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("submits update mutation when save changes is clicked", async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ success: true, data: mockStore });

    renderWithQueryClient(<StoreOverview store={mockStore} />);

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));

    const nameInput = screen.getByLabelText("Store Name");
    fireEvent.change(nameInput, { target: { value: "Aura Luxury Cosmetics" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        "/admin/stores/store-1",
        expect.objectContaining({
          name: "Aura Luxury Cosmetics",
          slug: "aura-cosmetics",
        })
      );
    });
  });

  it("cancels edit mode and restores view mode", () => {
    renderWithQueryClient(<StoreOverview store={mockStore} />);

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /edit details/i })).toBeInTheDocument();
  });
});

