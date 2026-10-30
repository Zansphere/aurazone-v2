import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "./api";

describe("ApiClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should make a successful GET request", async () => {
    const mockData = { success: true, data: { message: "pong" } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    global.fetch = fetchMock;

    const res = await api.get("/ping");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/ping"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
    expect(res).toEqual(mockData);
  });

  it("should include Bearer token if accessToken is in localStorage", async () => {
    localStorage.setItem("accessToken", "test-token-123");

    const mockData = { success: true, data: { id: "1" } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });
    global.fetch = fetchMock;

    await api.get("/auth/me");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token-123",
        }),
      })
    );
  });

  it("should handle POST request with json body", async () => {
    const mockData = { success: true, data: { id: "new-prod" } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockData,
    });
    global.fetch = fetchMock;

    const payload = { name: "Test Product", price: 100 };
    const res = await api.post("/admin/products", payload);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/products"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
    expect(res).toEqual(mockData);
  });

  it("should throw error when API returns non-ok status with message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ success: false, message: "Invalid parameters" }),
    });
    global.fetch = fetchMock;

    await expect(api.get("/bad-request")).rejects.toThrow("Invalid parameters");
  });

  it("should attempt token refresh on 401 and retry request on refresh success", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      }

      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ message: "Unauthorized" }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { user: "john" } }),
      });
    });
    global.fetch = fetchMock;

    const res = await api.get("/admin/profile");

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1st try -> 401, refresh -> 200, retry -> 200
    expect(res).toEqual({ success: true, data: { user: "john" } });
  });

  it("should redirect to /login and throw when refresh fails on 401", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/auth/refresh")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({ message: "Refresh token expired" }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      });
    });
    global.fetch = fetchMock;

    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: "" } as any;

    await expect(api.get("/protected")).rejects.toThrow("Session expired");
    expect(window.location.href).toBe("/login");

    window.location = originalLocation as any;
  });
});

