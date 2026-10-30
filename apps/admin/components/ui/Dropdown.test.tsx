import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Dropdown, MenuDropdown } from "./Dropdown";

describe("Dropdown", () => {
  const options = [
    { value: "option-1", label: "Option One" },
    { value: "option-2", label: "Option Two" },
    { value: "danger-opt", label: "Delete Item", danger: true },
  ];

  it("renders with placeholder when no value is selected", () => {
    render(<Dropdown options={options} onChange={vi.fn()} placeholder="Choose..." />);
    expect(screen.getByText("Choose...")).toBeInTheDocument();
  });

  it("renders selected option label", () => {
    render(<Dropdown options={options} value="option-2" onChange={vi.fn()} />);
    expect(screen.getByText("Option Two")).toBeInTheDocument();
  });

  it("toggles dropdown options on click", () => {
    render(<Dropdown options={options} onChange={vi.fn()} placeholder="Choose..." />);

    expect(screen.queryByText("Option One")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    expect(screen.getByText("Option One")).toBeInTheDocument();
    expect(screen.getByText("Option Two")).toBeInTheDocument();
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
  });

  it("calls onChange when an option is clicked and closes the menu", () => {
    const onChangeMock = vi.fn();
    render(<Dropdown options={options} onChange={onChangeMock} placeholder="Choose..." />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Option One"));

    expect(onChangeMock).toHaveBeenCalledWith("option-1");
    expect(screen.queryByText("Option Two")).not.toBeInTheDocument();
  });

  it("disables trigger button when disabled prop is true", () => {
    render(<Dropdown options={options} onChange={vi.fn()} disabled={true} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});

describe("MenuDropdown", () => {
  const items = [
    { value: "edit", label: "Edit" },
    { value: "delete", label: "Delete", danger: true },
  ];

  it("renders custom trigger and reveals menu on click", () => {
    const onSelect = vi.fn();
    render(
      <MenuDropdown
        trigger={<button data-testid="menu-trigger">Actions</button>}
        items={items}
        onSelect={onSelect}
      />
    );

    expect(screen.getByTestId("menu-trigger")).toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("menu-trigger"));
    expect(screen.getByText("Edit")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Edit"));
    expect(onSelect).toHaveBeenCalledWith("edit");
  });
});

