import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import authRoutes from "./auth.routes.js";
import { globalErrorHandler } from "../../middleware/response.js";

// Mock services
vi.mock("../../services/auth.service.js", () => ({
  signupWithEmail: vi.fn(),
  loginWithEmail: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeSession: vi.fn(),
  logoutAllSessions: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
  changePassword: vi.fn(),
}));

import * as authService from "../../services/auth.service.js";

describe("Auth Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    await app.register(fastifyCookie, { secret: "test-secret" });
    app.setErrorHandler(globalErrorHandler);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.ready();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("returns 400 when invalid email format is passed", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "not-an-email",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("email");
    });

    it("returns 400 when password is shorter than 6 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "user@example.com",
          password: "123",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("6 characters");
    });

    it("returns 201 on valid signup with normalized lowercase email", async () => {
      const mockResult = {
        user: {
          id: "usr_new",
          email: "user@example.com",
          fullName: "Test User",
          role: "CUSTOMER",
        },
        accessToken: "mock.access.token",
        refreshToken: "mock.refresh.token",
        verificationToken: "mock.verify.token",
      };

      vi.mocked(authService.signupWithEmail).mockResolvedValueOnce(mockResult as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/signup",
        payload: {
          email: "User@Example.COM",
          password: "securePassword123",
          fullName: "Test User",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe("user@example.com");
      expect(json.data.accessToken).toBe("mock.access.token");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("returns 400 on malformed body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
    });

    it("returns 200 on valid credentials", async () => {
      const mockLoginResult = {
        user: {
          id: "usr_1",
          email: "buyer@example.com",
          role: "CUSTOMER",
        },
        accessToken: "access.jwt.token",
        refreshToken: "refresh.jwt.token",
      };

      vi.mocked(authService.loginWithEmail).mockResolvedValueOnce(mockLoginResult as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "buyer@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.user.email).toBe("buyer@example.com");
      expect(json.data.accessToken).toBe("access.jwt.token");
    });

    it("returns 403 when account is deactivated or suspended", async () => {
      vi.mocked(authService.loginWithEmail).mockRejectedValueOnce(
        Object.assign(new Error("Account suspended. Please contact support."), { statusCode: 403 })
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "suspended@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("Account suspended");
    });
  });

  describe("POST /api/v1/auth/admin/login (TC-AUTH-016 & TC-AUTH-017)", () => {
    it("returns 403 Forbidden when a non-admin user (STORE_MANAGER) attempts to log in", async () => {
      vi.mocked(authService.loginWithEmail).mockResolvedValueOnce({
        user: { id: "mgr_1", email: "manager@example.com", role: "STORE_MANAGER" },
        accessToken: "mgr.access.token",
        refreshToken: "mgr.refresh.token",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          email: "manager@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("Administrator privileges required");
    });

    it("returns 403 Forbidden when a CUSTOMER attempts to log in via admin login", async () => {
      vi.mocked(authService.loginWithEmail).mockResolvedValueOnce({
        user: { id: "cust_1", email: "customer@example.com", role: "CUSTOMER" },
        accessToken: "cust.access.token",
        refreshToken: "cust.refresh.token",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          email: "customer@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("Administrator privileges required");
    });

    it("returns 200 OK when a SUPER_ADMIN logs in", async () => {
      vi.mocked(authService.loginWithEmail).mockResolvedValueOnce({
        user: { id: "admin_1", email: "admin@example.com", role: "SUPER_ADMIN" },
        accessToken: "admin.access.token",
        refreshToken: "admin.refresh.token",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/admin/login",
        payload: {
          email: "admin@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe("SUPER_ADMIN");
    });
  });

  describe("POST /api/v1/auth/logout & Token Revocation (TC-AUTH-038)", () => {
    it("revokes access token on logout and rejects subsequent access to protected endpoints", async () => {
      const jwt = (await import("jsonwebtoken")).default;
      const { env } = await import("../../config/env.js");
      const token = jwt.sign({ userId: "usr_active", role: "SUPER_ADMIN" }, env.JWT_SECRET, { expiresIn: "15m" });

      // 1. Logout with the token
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(logoutRes.statusCode).toBe(200);

      // 2. Try to reuse the token on /api/v1/auth/me
      const meRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(meRes.statusCode).toBe(401);
      const json = JSON.parse(meRes.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("revoked");
    });
  });
});

