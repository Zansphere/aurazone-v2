import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cartRoutes from "./cart.routes.js";
import { globalErrorHandler } from "../../middleware/response.js";

vi.mock("@aurazone/database", () => ({
  prisma: {
    guestSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    cart: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cartItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    inventoryReservation: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../../services/inventory.service.js", () => ({
  holdInventory: vi.fn(),
  releaseInventory: vi.fn(),
}));

import { prisma } from "@aurazone/database";

describe("Cart Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setErrorHandler(globalErrorHandler);
    await app.register(cartRoutes, { prefix: "/api/v1/cart" });
    await app.ready();
  });

  describe("GET /api/v1/cart", () => {
    it("returns empty cart if no cart exists", async () => {
      vi.mocked(prisma.guestSession.findFirst).mockResolvedValue({
        id: "session-1",
        sessionId: "raw-session-1",
      } as any);
      vi.mocked(prisma.cart.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.cart.create).mockResolvedValue({
        id: "cart-new",
        sessionId: "session-1",
        status: "ACTIVE",
      } as any);
      vi.mocked(prisma.cart.findUnique).mockResolvedValue({
        id: "cart-new",
        sessionId: "session-1",
        status: "ACTIVE",
        items: [],
      } as any);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/cart",
        headers: { "x-guest-session": "raw-session-1" },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.items).toEqual([]);
      expect(json.data.canCheckout).toBe(false);
      expect(json.data.hasUnavailableItems).toBe(false);
    });

    it("automatically prunes deleted/inactive items and releases inventory holds", async () => {
      vi.mocked(prisma.guestSession.findFirst).mockResolvedValue({
        id: "session-1",
        sessionId: "raw-session-1",
      } as any);

      vi.mocked(prisma.cart.findFirst).mockResolvedValue({
        id: "cart-1",
        sessionId: "session-1",
        status: "ACTIVE",
      } as any);

      vi.mocked(prisma.cart.findUnique).mockResolvedValue({
        id: "cart-1",
        sessionId: "session-1",
        status: "ACTIVE",
        items: [
          {
            id: "item-active",
            variantId: "11111111-1111-1111-1111-111111111111",
            unitPrice: "100.00",
            quantity: 1,
            variant: {
              id: "11111111-1111-1111-1111-111111111111",
              isAvailable: true,
              deletedAt: null,
              inventory: { quantity: 10, reserved: 0 },
              product: { id: "prod-1", name: "Active Headphones", isActive: true, deletedAt: null },
              images: [],
              attributes: [],
            },
          },
          {
            id: "item-deleted",
            variantId: "22222222-2222-2222-2222-222222222222",
            unitPrice: "200.00",
            quantity: 1,
            variant: {
              id: "22222222-2222-2222-2222-222222222222",
              isAvailable: false,
              deletedAt: new Date(),
              inventory: { quantity: 0, reserved: 0 },
              product: { id: "prod-2", name: "Deleted Microphone", isActive: false, deletedAt: new Date() },
              images: [],
              attributes: [],
            },
          },
        ],
      } as any);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/cart",
        headers: { "x-guest-session": "raw-session-1" },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["item-deleted"] } },
      });
      expect(json.data.items).toHaveLength(1);
      expect(json.data.items[0].id).toBe("item-active");
    });

    it("flags out-of-stock items and blocks checkout", async () => {
      vi.mocked(prisma.guestSession.findFirst).mockResolvedValue({
        id: "session-1",
        sessionId: "raw-session-1",
      } as any);

      vi.mocked(prisma.cart.findFirst).mockResolvedValue({
        id: "cart-1",
        sessionId: "session-1",
        status: "ACTIVE",
      } as any);

      vi.mocked(prisma.cart.findUnique).mockResolvedValue({
        id: "cart-1",
        sessionId: "session-1",
        status: "ACTIVE",
        items: [
          {
            id: "item-oos",
            variantId: "11111111-1111-1111-1111-111111111111",
            unitPrice: "100.00",
            quantity: 5,
            variant: {
              id: "11111111-1111-1111-1111-111111111111",
              isAvailable: true,
              deletedAt: null,
              inventory: { quantity: 2, reserved: 0 }, // only 2 in stock, requested 5
              product: { id: "prod-1", name: "Limited Headphones", isActive: true, deletedAt: null },
              images: [],
              attributes: [],
            },
          },
        ],
      } as any);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/cart",
        headers: { "x-guest-session": "raw-session-1" },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data.hasUnavailableItems).toBe(true);
      expect(json.data.canCheckout).toBe(false);
      expect(json.data.items[0].isAvailable).toBe(false);
      expect(json.data.items[0].unavailableReason).toContain("Only 2 in stock");
    });
  });

  describe("POST /api/v1/cart", () => {
    it("rejects adding deleted or inactive product to cart", async () => {
      vi.mocked(prisma.guestSession.findFirst).mockResolvedValue({
        id: "session-1",
        sessionId: "raw-session-1",
      } as any);

      vi.mocked(prisma.cart.findFirst).mockResolvedValue({
        id: "cart-1",
        sessionId: "session-1",
        status: "ACTIVE",
      } as any);

      vi.mocked(prisma.productVariant.findUnique).mockResolvedValue({
        id: "22222222-2222-2222-2222-222222222222",
        isAvailable: false,
        deletedAt: new Date(),
        product: {
          id: "prod-deleted",
          isActive: false,
          deletedAt: new Date(),
        },
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/cart",
        headers: { "x-guest-session": "raw-session-1" },
        payload: {
          variantId: "22222222-2222-2222-2222-222222222222",
          quantity: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("no longer available");
    });
  });

  describe("PATCH /api/v1/cart/:itemId", () => {
    it("rejects updating cart item if product variant was deleted", async () => {
      vi.mocked(prisma.cartItem.findUnique).mockResolvedValue({
        id: "item-1",
        cartId: "cart-1",
        variantId: "22222222-2222-2222-2222-222222222222",
        quantity: 1,
        cart: {
          sessionId: "session-1",
        },
        variant: {
          id: "22222222-2222-2222-2222-222222222222",
          isAvailable: false,
          deletedAt: new Date(),
          product: {
            id: "prod-1",
            isActive: false,
            deletedAt: new Date(),
          },
        },
      } as any);

      vi.mocked(prisma.guestSession.findFirst).mockResolvedValue({
        id: "session-1",
        sessionId: "raw-session-1",
      } as any);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/cart/item-1",
        headers: { "x-guest-session": "raw-session-1" },
        payload: {
          quantity: 2,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(false);
      expect(json.message).toContain("no longer available");
    });
  });
});
