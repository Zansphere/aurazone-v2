import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import orderRoutes from "./order.routes.js";
import { globalErrorHandler } from "../../middleware/response.js";

// Mock database and services
vi.mock("@aurazone/database", () => ({
  prisma: {
    coupon: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    couponUsage: {
      findFirst: vi.fn(),
    },
    cart: {
      findFirst: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../services/order.service.js", () => ({
  createOrderFromCart: vi.fn(),
  createDirectOrder: vi.fn(),
  getUserOrders: vi.fn(),
  getOrderById: vi.fn(),
  cancelOrder: vi.fn(),
  failOrder: vi.fn(),
  getOrderByTrackingToken: vi.fn(),
}));

import { prisma } from "@aurazone/database";
import * as orderService from "../../services/order.service.js";

describe("Order Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setErrorHandler(globalErrorHandler);
    await app.register(orderRoutes, { prefix: "/api/v1/orders" });
    await app.ready();
  });

  describe("POST /api/v1/orders/coupons/validate", () => {
    it("returns 400 if coupon code or subtotal is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/coupons/validate",
        payload: { code: "" },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("required");
    });

    it("returns 400 if subtotal is negative", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/coupons/validate",
        payload: { code: "SAVE20", subtotal: -100 },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
    });

    it("returns 400 if coupon is not found in database", async () => {
      vi.mocked(prisma.coupon.findFirst).mockResolvedValueOnce(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/coupons/validate",
        payload: { code: "NONEXISTENT", subtotal: 500 },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toBe("Invalid coupon code");
    });
  });

  describe("POST /api/v1/orders (Cart Checkout)", () => {
    it("returns 400 if address and addressId are missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { "x-guest-session": "sess_123" },
        payload: { paymentMethod: "COD" },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("addressId or address is required");
    });

    it("returns 400 if paymentMethod is invalid", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { "x-guest-session": "sess_123" },
        payload: {
          addressId: "addr_123",
          paymentMethod: "CRYPTO", // invalid
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("Valid paymentMethod");
    });

    it("returns 401 if neither user nor guest session is present", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        payload: {
          addressId: "addr_123",
          paymentMethod: "COD",
        },
      });

      expect(response.statusCode).toBe(401);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toBe("Unauthorized");
    });

    it("returns 201 with standard envelope on successful cart checkout", async () => {
      const mockOrder = {
        id: "ord_123",
        orderNumber: "AZ-20261030-9999",
        totalAmount: 1499,
        status: "PENDING",
      };

      vi.mocked(orderService.createOrderFromCart).mockResolvedValueOnce(mockOrder as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders",
        headers: { "x-guest-session": "sess_123" },
        payload: {
          addressId: "addr_123",
          paymentMethod: "COD",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.orderNumber).toBe(mockOrder.orderNumber);
    });
  });

  describe("POST /api/v1/orders/direct (Direct Checkout)", () => {
    it("returns 400 if variantId is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/direct",
        headers: { "x-guest-session": "sess_123" },
        payload: {
          quantity: 1,
          addressId: "addr_123",
          paymentMethod: "COD",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("variantId is required");
    });

    it("returns 400 if quantity is not a positive integer", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/direct",
        headers: { "x-guest-session": "sess_123" },
        payload: {
          variantId: "var_123",
          quantity: 0,
          addressId: "addr_123",
          paymentMethod: "COD",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("quantity must be a positive integer");
    });

    it("returns 201 on valid direct checkout", async () => {
      const mockOrder = {
        id: "ord_direct_1",
        orderNumber: "AZ-20261030-8888",
        totalAmount: 2999,
        status: "PENDING",
      };

      vi.mocked(orderService.createDirectOrder).mockResolvedValueOnce(mockOrder as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/orders/direct",
        headers: { "x-guest-session": "sess_123" },
        payload: {
          variantId: "11111111-2222-3333-4444-555555555555",
          quantity: 2,
          addressId: "addr_123",
          paymentMethod: "RAZORPAY",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.orderNumber).toBe(mockOrder.orderNumber);
    });
  });
});

