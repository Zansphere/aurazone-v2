import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import AttributesTab from "./AttributesTab";
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

describe("AttributesTab", () => {
  const mockTemplates = [
    {
      id: "attr-1",
      name: "Size",
      key: "size",
      fieldType: "SELECT",
      options: ["S", "M", "L", "XL"],
      placeholder: "Select size",
      helpText: null,
      isRequired: true,
      isVariant: true,
      isFilterable: true,
      sortOrder: 1,
      categoryId: null,
      category: null,
    },
    {
      id: "attr-2",
      name: "Color",
      key: "color",
      fieldType: "COLOR_PICKER",
      options: null,
      placeholder: null,
      helpText: null,
      isRequired: true,
      isVariant: true,
      isFilterable: true,
      sortOrder: 2,
      categoryId: null,
      category: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.get).mockResolvedValue({
      success: true,
      data: mockTemplates,
    });
  });

  it("renders attributes list with badges", async () => {
    renderWithQueryClient(<AttributesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Attribute Templates (2)")).toBeInTheDocument();
      expect(screen.getByText("Size")).toBeInTheDocument();
      expect(screen.getByText("Color")).toBeInTheDocument();
      expect(screen.getByText("size")).toBeInTheDocument();
    });
  });

  it("opens create form and auto-generates key from name", async () => {
    renderWithQueryClient(<AttributesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Size")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add attribute/i }));

    expect(screen.getByText("New Attribute")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("e.g. Color");
    fireEvent.change(nameInput, { target: { value: "Shoe Material" } });

    const keyInput = screen.getByPlaceholderText("e.g. color");
    expect(keyInput).toHaveValue("shoe_material");
  });

  it("submits create attribute template successfully", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      success: true,
      data: { id: "attr-3", name: "Fabric", key: "fabric" },
    });

    renderWithQueryClient(<AttributesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Size")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add attribute/i }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Color"), { target: { value: "Fabric" } });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/admin/attribute-templates",
        expect.objectContaining({
          storeId: "store-1",
          name: "Fabric",
          key: "fabric",
        })
      );
    });
  });

  it("calls delete mutation when delete button is clicked and confirmed", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ success: true });

    renderWithQueryClient(<AttributesTab storeId="store-1" />);

    await waitFor(() => {
      expect(screen.getByText("Size")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button").filter(
      (btn) => btn.className && btn.className.includes("hover:text-red-500")
    );
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/admin/attribute-templates/attr-1");
    });
  });
});
