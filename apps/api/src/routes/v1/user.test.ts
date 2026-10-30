import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import userRoutes from "./user.routes.js";
import { globalErrorHandler } from "../../middleware/response.js";

vi.mock("@aurazone/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    address: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../../middleware/auth.js", () => ({
  authenticate: async (request: any) => {
    request.user = { userId: "user-123", email: "test@example.com", role: "CUSTOMER" };
  },
  optionalAuth: async () => {},
}));

import { prisma } from "@aurazone/database";

describe("User Routes - Addresses", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setErrorHandler(globalErrorHandler);
    await app.register(userRoutes, { prefix: "/api/v1/users" });
    await app.ready();
  });

  describe("POST /api/v1/users/addresses", () => {
    it("returns 400 when phone number exceeds max length or is invalid format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users/addresses",
        payload: {
          name: "Rahul Sharma",
          phone: "98765432109876543210", // 20 digits
          addressLine1: "123 Main Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("10-digit mobile number");
    });

    it("returns 400 when postal code is not a 6-digit PIN code", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users/addresses",
        payload: {
          name: "Rahul Sharma",
          phone: "9876543210",
          addressLine1: "123 Main Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560000123", // 9 digits
          country: "India",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("6-digit PIN code");
    });

    it("returns 400 when full name is excessively long", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users/addresses",
        payload: {
          name: "A".repeat(80),
          phone: "9876543210",
          addressLine1: "123 Main Street",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560001",
          country: "India",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("70 characters");
    });

    it("successfully creates address with valid fields and sets default for first address", async () => {
      vi.mocked(prisma.address.count).mockResolvedValue(0);
      vi.mocked(prisma.address.create).mockResolvedValue({
        id: "addr-1",
        userId: "user-123",
        name: "Rahul Sharma",
        phone: "9876543210",
        addressLine1: "123 MG Road",
        addressLine2: null,
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
        isDefault: true,
        createdAt: new Date(),
      } as any);

      const payload = {
        name: "Rahul Sharma",
        phone: "9876543210",
        addressLine1: "123 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        country: "India",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/users/addresses",
        payload,
      });

      expect(response.statusCode).toBe(201);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("addr-1");
      expect(json.data.isDefault).toBe(true);
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          ...payload,
          isDefault: true,
        },
      });
    });
  });

  describe("PUT /api/v1/users/addresses/:id", () => {
    it("returns 400 if updating with invalid postal code", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/users/addresses/addr-1",
        payload: {
          postalCode: "ABCDEF",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("6-digit PIN code");
    });
  });
});
