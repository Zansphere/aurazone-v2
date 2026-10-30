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
  });
});

