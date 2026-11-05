import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import jwt from "jsonwebtoken";
import adminRoutes from "./admin/index.js";
import { globalErrorHandler } from "../../middleware/response.js";
import { env } from "../../config/env.js";

// Mock database and services
vi.mock("@aurazone/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    orderShipment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    shipmentLog: {
      create: vi.fn(),
    },
  },
  Prisma: {},
  OrderStatus: {
    PENDING: "PENDING",
    RECEIVED: "RECEIVED",
    SHIPPED: "SHIPPED",
    DELIVERED: "DELIVERED",
    SUCCESS: "SUCCESS",
    CANCELLED: "CANCELLED",
    FAILED: "FAILED",
  },
  OrderShipmentStatus: {
    PENDING: "PENDING",
    SHIPPED: "SHIPPED",
    IN_TRANSIT: "IN_TRANSIT",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
    RETURNED: "RETURNED",
    LOST: "LOST",
  },
}));

vi.mock("../../services/order.service.js", () => ({
  updateOrderStatus: vi.fn(),
  getOrderById: vi.fn(),
}));

import { prisma } from "@aurazone/database";
import * as orderService from "../../services/order.service.js";

describe("Admin Shipments & Orders Pagination (Bugs 44-55)", () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      email: "admin@aurazone.com",
      isActive: true,
    } as any);

    app = Fastify();
    await app.register(fastifyCookie, { secret: "test-secret" });
    app.setErrorHandler(globalErrorHandler);
    await app.register(adminRoutes, { prefix: "/api/v1/admin" });
    await app.ready();

    adminToken = jwt.sign(
      { userId: "admin-1", role: "SUPER_ADMIN", email: "admin@aurazone.com" },
      env.JWT_SECRET
    );
  });

  describe("Pagination with page parameter (Bug 44 & Bug 55)", () => {
    it("GET /orders?page=2 calculates skip offset correctly", async () => {
      vi.mocked(prisma.order.findMany).mockResolvedValue([]);
      vi.mocked(prisma.order.count).mockResolvedValue(25);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/admin/orders?page=2&take=10",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.meta.page).toBe(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe("POST /api/v1/admin/shipments", () => {
    it("rejects missing courierName and trackingNumber with 400 (Bug 53)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { orderId: "ord-1" },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toContain("Courier name is required");
    });

    it("rejects javascript: tracking URL with 400 (Bug 45)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
          trackingUrl: "javascript:alert(1)",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toContain("Invalid tracking URL");
    });

    it("rejects malformed tracking URL with 400 (Bug 54)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
          trackingUrl: "not-a-url",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toContain("Invalid tracking URL");
    });

    it("rejects shipment creation for CANCELLED order with 400 (Bug 49)", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "ord-1",
        status: "CANCELLED",
        orderNumber: "AZ-100",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toContain("Cannot create shipment for a cancelled order");
    });

    it("rejects shipment creation for unconfirmed PENDING order with 400 (Bug 50)", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "ord-1",
        status: "PENDING",
        orderNumber: "AZ-100",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toContain("Cannot create shipment for an unconfirmed order");
    });

    it("rejects duplicate active shipment for same order with 409 (Bug 48)", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "ord-1",
        status: "RECEIVED",
        orderNumber: "AZ-100",
      } as any);

      vi.mocked(prisma.orderShipment.findFirst).mockResolvedValue({
        id: "shp-existing",
        orderId: "ord-1",
        status: "SHIPPED",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
        },
      });

      expect(response.statusCode).toBe(409);
      const json = JSON.parse(response.payload);
      expect(json.message).toBe("Shipment already exists for this order");
    });

    it("creates shipment and updates parent order status to SHIPPED (Bug 46)", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "ord-1",
        status: "RECEIVED",
        orderNumber: "AZ-100",
      } as any);

      vi.mocked(prisma.orderShipment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.orderShipment.create).mockResolvedValue({
        id: "shp-1",
        orderId: "ord-1",
        status: "SHIPPED",
        courierName: "BlueDart",
        trackingNumber: "BD123",
      } as any);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/admin/shipments",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          orderId: "ord-1",
          courierName: "BlueDart",
          trackingNumber: "BD123",
          trackingUrl: "https://track.bluedart.com/BD123",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith("ord-1", "SHIPPED", "admin-1");
    });
  });

  describe("PATCH /api/v1/admin/shipments/:id", () => {
    it("rejects invalid status values with 400 (Bug 51)", async () => {
      vi.mocked(prisma.orderShipment.findUnique).mockResolvedValue({
        id: "shp-1",
        status: "SHIPPED",
        order: { items: [] },
      } as any);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/shipments/shp-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: "BOGUS" },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toBe("Invalid shipment status");
    });

    it("rejects backward transition from DELIVERED to SHIPPED with 400 (Bug 52)", async () => {
      vi.mocked(prisma.orderShipment.findUnique).mockResolvedValue({
        id: "shp-1",
        status: "DELIVERED",
        order: { items: [] },
      } as any);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/shipments/shp-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: "SHIPPED" },
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.payload);
      expect(json.message).toBe("Invalid shipment status transition");
    });

    it("synchronizes parent order status to DELIVERED when shipment is DELIVERED (Bug 47)", async () => {
      vi.mocked(prisma.orderShipment.findUnique).mockResolvedValue({
        id: "shp-1",
        orderId: "ord-1",
        status: "SHIPPED",
        order: { items: [] },
      } as any);

      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "ord-1",
        status: "SHIPPED",
      } as any);

      vi.mocked(prisma.orderShipment.update).mockResolvedValue({
        id: "shp-1",
        status: "DELIVERED",
      } as any);

      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/shipments/shp-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: "DELIVERED" },
      });

      expect(response.statusCode).toBe(200);
      expect(orderService.updateOrderStatus).toHaveBeenCalledWith("ord-1", "DELIVERED", "admin-1");
    });
  });
});
