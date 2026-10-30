import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

// Mock database for store access checks
vi.mock("@aurazone/database", () => ({
  prisma: {
    storeManager: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@aurazone/database";
import { authenticate, optionalAuth, requireRole, requireStoreAccess } from "./auth.js";
import { env } from "../config/env.js";
import type { FastifyRequest, FastifyReply } from "fastify";

function createMockRequest(headers: Record<string, string> = {}, cookies: Record<string, string> = {}): FastifyRequest {
  return {
    headers,
    cookies,
    user: undefined,
    params: {},
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply {
  const reply: any = {
    statusCode: 200,
    sentData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(data: any) {
      this.sentData = data;
      return this;
    },
  };
  return reply as FastifyReply;
}

describe("Auth Middleware - authenticate", () => {
  const mockPayload = {
    userId: "usr_12345",
    email: "buyer@example.com",
    role: "CUSTOMER",
  };

  it("authenticates valid Bearer token in Authorization header", async () => {
    const token = jwt.sign(mockPayload, env.JWT_SECRET, { expiresIn: "1h" });
    const request = createMockRequest({ authorization: `Bearer ${token}` });
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(request.user).toBeDefined();
    expect(request.user?.userId).toBe(mockPayload.userId);
    expect(request.user?.role).toBe("CUSTOMER");
  });

  it("authenticates valid token from cookies fallback", async () => {
    const token = jwt.sign(mockPayload, env.JWT_SECRET, { expiresIn: "1h" });
    const request = createMockRequest({}, { access_token: token });
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(request.user).toBeDefined();
    expect(request.user?.userId).toBe(mockPayload.userId);
  });

  it("returns 401 when no token is present", async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply.statusCode).toBe(401);
    expect((reply as any).sentData.success).toBe(false);
  });

  it("returns 401 for an invalid or forged token", async () => {
    const request = createMockRequest({ authorization: "Bearer invalid.fake.token" });
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply.statusCode).toBe(401);
    expect((reply as any).sentData.success).toBe(false);
  });

  it("returns 401 for an expired token", async () => {
    const expiredToken = jwt.sign(mockPayload, env.JWT_SECRET, { expiresIn: "-1s" });
    const request = createMockRequest({ authorization: `Bearer ${expiredToken}` });
    const reply = createMockReply();

    await authenticate(request, reply);

    expect(reply.statusCode).toBe(401);
    expect((reply as any).sentData.message).toContain("expired");
  });
});

describe("Auth Middleware - optionalAuth", () => {
  it("populates request.user if valid token is provided", async () => {
    const token = jwt.sign({ userId: "usr_guest", role: "CUSTOMER" }, env.JWT_SECRET);
    const request = createMockRequest({ authorization: `Bearer ${token}` });
    const reply = createMockReply();

    await optionalAuth(request, reply);

    expect(request.user).toBeDefined();
    expect(request.user?.userId).toBe("usr_guest");
  });

  it("does not fail or return 401 if token is absent", async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    await optionalAuth(request, reply);

    expect(request.user).toBeUndefined();
    expect(reply.statusCode).toBe(200);
  });
});

describe("Auth Middleware - requireRole", () => {
  it("allows access when user has one of the allowed roles", async () => {
    const request = createMockRequest();
    request.user = { userId: "admin_1", role: "SUPER_ADMIN" } as any;
    const reply = createMockReply();

    const guard = requireRole("SUPER_ADMIN");
    await guard(request, reply);

    expect(reply.statusCode).toBe(200);
    expect((reply as any).sentData).toBeNull();
  });

  it("rejects access with 403 when user does not have required role", async () => {
    const request = createMockRequest();
    request.user = { userId: "cust_1", role: "CUSTOMER" } as any;
    const reply = createMockReply();

    const guard = requireRole("SUPER_ADMIN", "STORE_MANAGER");
    await guard(request, reply);

    expect(reply.statusCode).toBe(403);
    expect((reply as any).sentData.message).toContain("Insufficient permissions");
  });

  it("rejects unauthenticated user with 401", async () => {
    const request = createMockRequest();
    const reply = createMockReply();

    const guard = requireRole("SUPER_ADMIN");
    await guard(request, reply);

    expect(reply.statusCode).toBe(401);
  });
});

describe("Auth Middleware - requireStoreAccess", () => {
  it("allows SUPER_ADMIN to access any store", async () => {
    const request = createMockRequest();
    request.user = { userId: "super_1", role: "SUPER_ADMIN" } as any;
    (request.params as any) = { storeId: "store_xyz" };
    const reply = createMockReply();

    const guard = requireStoreAccess("params", "storeId");
    await guard(request, reply);

    expect(reply.statusCode).toBe(200);
    expect((reply as any).sentData).toBeNull();
  });

  it("allows STORE_MANAGER to access their assigned store", async () => {
    vi.mocked(prisma.storeManager.findMany).mockResolvedValueOnce([
      { id: "sm_1", userId: "mgr_1", storeId: "store_123" } as any,
    ]);

    const request = createMockRequest();
    request.user = { userId: "mgr_1", role: "STORE_MANAGER" } as any;
    (request.params as any) = { storeId: "store_123" };
    const reply = createMockReply();

    const guard = requireStoreAccess("params", "storeId");
    await guard(request, reply);

    expect(reply.statusCode).toBe(200);
    expect((reply as any).sentData).toBeNull();
  });

  it("forbids STORE_MANAGER from accessing another store", async () => {
    vi.mocked(prisma.storeManager.findMany).mockResolvedValueOnce([
      { id: "sm_1", userId: "mgr_1", storeId: "store_123" } as any,
    ]);

    const request = createMockRequest();
    request.user = { userId: "mgr_1", role: "STORE_MANAGER" } as any;
    (request.params as any) = { storeId: "store_999" };
    const reply = createMockReply();

    const guard = requireStoreAccess("params", "storeId");
    await guard(request, reply);

    expect(reply.statusCode).toBe(403);
    expect((reply as any).sentData.message).toContain("You do not have access to this store");
  });
});
