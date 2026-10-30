import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import LoginPage from "./page";
import { useAuthStore } from "@/stores/auth.store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("LoginPage", () => {
  const loginMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      login: loginMock,
    });
  });

  it("renders login form with branding, email, and password inputs", () => {
    render(<LoginPage />);

    expect(screen.getByText("AuraZone")).toBeInTheDocument();
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("submits login credentials and redirects to '/' on success", async () => {
    loginMock.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitBtn = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "admin@aurazone.shop" } });
    fireEvent.change(passwordInput, { target: { value: "SecretPassword123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("admin@aurazone.shop", "SecretPassword123");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("displays error message when login fails and does not redirect", async () => {
    loginMock.mockRejectedValueOnce(new Error("Invalid email or password"));

    render(<LoginPage />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitBtn = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(emailInput, { target: { value: "admin@aurazone.shop" } });
    fireEvent.change(passwordInput, { target: { value: "WrongPassword" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

