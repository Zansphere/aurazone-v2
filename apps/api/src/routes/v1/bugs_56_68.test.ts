import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import jwt from "jsonwebtoken";
import adminRoutes from "./admin/index.js";
import uploadRoutes from "./upload.routes.js";
import { globalErrorHandler } from "../../middleware/response.js";
import { env } from "../../config/env.js";
import * as productService from "../../services/product.service.js";
import * as storeServiceActual from "../../services/store.service.js";

// Mock database and services
vi.mock("@aurazone/database", () => {
  const p: any = {
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === "function") {
        return arg(p);
      }
      return Promise.all(arg);
    }),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    inventoryLog: {
      create: vi.fn(),
    },
    notificationHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    store: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    productVariant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    orderItem: {
      findFirst: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    attributeTemplate: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  };
  return {
    prisma: p,
    Prisma: {},
  };
});

vi.mock("../../services/audit.service.js", () => ({
  logAction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../services/upload.service.js", () => ({
  UploadService: {
    getPresignedUrl: vi.fn().mockResolvedValue({
      uploadUrl: "https://s3.fake/upload",
      publicUrl: "https://s3.fake/public/test.jpg",
    }),
  },
}));

vi.mock("../../services/category.service.js", () => ({
  listCategories: vi.fn(),
  getCategoryById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("../../services/attributeTemplate.service.js", () => ({
  listAttributeTemplates: vi.fn(),
  createAttributeTemplate: vi.fn(),
  updateAttributeTemplate: vi.fn(),
  deleteAttributeTemplate: vi.fn(),
}));

import { prisma } from "@aurazone/database";
import { UploadService } from "../../services/upload.service.js";
import * as categoryService from "../../services/category.service.js";

describe("Bugs 56-68 Test Suite", () => {
  let app: FastifyInstance;
  let adminToken: string;
  const validStoreId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      email: "admin@aurazone.com",
      role: "SUPER_ADMIN",
      isActive: true,
      deletedAt: null,
    } as any);

    adminToken = jwt.sign(
      { userId: "admin-1", email: "admin@aurazone.com", role: "SUPER_ADMIN" },
      env.JWT_SECRET || "test-secret"
    );

    app = Fastify();
    await app.register(fastifyCookie);
    app.setErrorHandler(globalErrorHandler);
    await app.register(adminRoutes, { prefix: "/api/v1/admin" });
    await app.register(uploadRoutes, { prefix: "/api/v1/upload" });
    await app.ready();
  });

  // ─── Bugs 56 & 57: Inventory Validation ─────────────────────────────────
  describe("Bugs 56 & 57: PATCH /api/v1/admin/inventory/:variantId", () => {
    it("Bug 56: rejects negative quantities with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/inventory/var-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: -1 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/negative quantity/i);
    });

    it("Bug 57: rejects decimal quantities with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/inventory/var-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: 2.5 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("Bug 57: rejects string quantities with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/inventory/var-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: "abc" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("Bug 57: rejects integer overflow (> 2147483647) with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/inventory/var-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: 2147483648 },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/2147483647/);
    });
  });

  // ─── Bug 58: Low Stock Notification ─────────────────────────────────────
  describe("Bug 58: Low-Stock Alert Notification", () => {
    it("creates a notification when quantity falls to or below threshold", async () => {
      vi.mocked(prisma.inventory.findUnique).mockResolvedValue({
        id: "inv-1",
        variantId: "var-1",
        quantity: 20,
        reserved: 0,
        variant: {
          id: "var-1",
          sku: "TEST-SKU",
          product: { id: "prod-1", name: "Test Product", storeId: "store-1" },
        },
      } as any);

      vi.mocked(prisma.inventory.update).mockResolvedValue({
        id: "inv-1",
        variantId: "var-1",
        quantity: 3,
        reserved: 0,
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/inventory/var-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { quantity: 3 },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.notificationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "admin-1",
            title: "Low Stock Alert",
          }),
        })
      );
    });
  });

  // ─── Bugs 59 & 60: Inventory List KPI Metrics & Filter ──────────────────
  describe("Bugs 59 & 60: GET /api/v1/admin/inventory", () => {
    it("Bug 59: returns totalItems, lowStockCount, and outOfStockCount", async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventory.count)
        .mockResolvedValueOnce(0) // where total
        .mockResolvedValueOnce(50) // totalItems
        .mockResolvedValueOnce(5) // lowStockCount
        .mockResolvedValueOnce(2); // outOfStockCount

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/inventory",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalItems).toBe(50);
      expect(body.lowStockCount).toBe(5);
      expect(body.outOfStockCount).toBe(2);
      expect(body.meta.totalItems).toBe(50);
    });

    it("Bug 60: lowStock filter queries quantity > 0 and <= threshold", async () => {
      vi.mocked(prisma.inventory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.inventory.count).mockResolvedValue(0);

      await app.inject({
        method: "GET",
        url: "/api/v1/admin/inventory?lowStock=true",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(prisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quantity: { gt: 0, lte: 10 },
          }),
        })
      );
    });
  });

  // ─── Bug 61: Customer Order Count ────────────────────────────────────────
  describe("Bug 61: GET /api/v1/admin/customers", () => {
    it("returns orderCount and excludes CANCELLED / PENDING orders", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: "cust-1",
          email: "cust@example.com",
          fullName: "Customer One",
          _count: { orders: 3 },
        } as any,
      ]);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/customers",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data[0].orderCount).toBe(3);
      expect(body.data[0]._count.orders).toBe(3);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: {
              select: {
                orders: {
                  where: {
                    deletedAt: null,
                    status: { notIn: ["CANCELLED", "PENDING"] },
                  },
                },
              },
            },
          }),
        })
      );
    });
  });

  // ─── Bug 62: Customer Details & Suspension Endpoints ─────────────────────
  describe("Bug 62: Admin Customer Management Details & Suspension", () => {
    it("GET /customers/:id returns profile, addresses, and lifetimeValue", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "cust-1",
        email: "cust@example.com",
        fullName: "Customer One",
        role: "CUSTOMER",
        addresses: [{ id: "addr-1", city: "Mumbai" }],
        orders: [
          { id: "ord-1", totalAmount: "1500.00", status: "DELIVERED" },
          { id: "ord-2", totalAmount: "500.00", status: "CANCELLED" },
        ],
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/customers/cust-1",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.id).toBe("cust-1");
      expect(data.addresses.length).toBe(1);
      expect(data.lifetimeValue).toBe(1500);
      expect(data.orderCount).toBe(1);
    });

    it("PATCH /customers/:id updates customer isActive to suspend account", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "cust-1",
        email: "cust@example.com",
        isActive: true,
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "cust-1",
        email: "cust@example.com",
        isActive: false,
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/customers/cust-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { isActive: false },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-1" },
          data: { isActive: false },
        })
      );
    });
  });

  // ─── Bug 63: Store Deletion Cascades to Products ─────────────────────────
  describe("Bug 63: Store Deletion Cascades to Products", () => {
    it("deactivates and soft-deletes child products when store is deleted", async () => {
      vi.mocked(prisma.store.findUnique).mockResolvedValue({
        id: validStoreId,
        name: "Test Store",
      } as any);

      await storeServiceActual.deleteStore(validStoreId, "admin-1");

      expect(prisma.store.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validStoreId },
          data: expect.objectContaining({ isActive: false }),
        })
      );
      expect(prisma.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: validStoreId, deletedAt: null },
          data: expect.objectContaining({ isActive: false }),
        })
      );
    });
  });

  // ─── Bug 64: Nested Store Routes ─────────────────────────────────────────
  describe("Bug 64: Nested Store Endpoints (/stores/:storeId/*)", () => {
    it("GET /stores/:storeId/categories returns categories for store", async () => {
      vi.mocked(prisma.store.findUnique).mockResolvedValue({
        id: validStoreId,
        name: "Test Store",
      } as any);

      vi.mocked(categoryService.listCategories).mockResolvedValue({
        categories: [{ id: "cat-1", name: "Electronics" }] as any,
        total: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/stores/${validStoreId}/categories`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(categoryService.listCategories).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: validStoreId })
      );
    });

    it("POST /stores/:storeId/categories associates created category with storeId", async () => {
      vi.mocked(prisma.store.findUnique).mockResolvedValue({
        id: validStoreId,
        name: "Test Store",
      } as any);

      vi.mocked(categoryService.createCategory).mockResolvedValue({
        id: "cat-1",
        name: "Root Category",
        storeId: validStoreId,
      } as any);

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/admin/stores/${validStoreId}/categories`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: "Root Category" },
      });

      expect(res.statusCode).toBe(201);
      expect(categoryService.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: validStoreId, name: "Root Category" }),
        "admin-1"
      );
    });
  });

  // ─── Bug 65: Variant deletion in order history ───────────────────────────
  describe("Bug 65: Product Update Variant Deletion in Order History", () => {
    it("rejects deleting a variant referenced in order history with 409 Conflict", async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue({
        id: "prod-1",
        name: "Product 1",
        slug: "product-1",
        storeId: validStoreId,
      } as any);

      vi.mocked(prisma.product.update).mockResolvedValue({
        id: "prod-1",
        name: "Product 1",
        slug: "product-1",
        storeId: validStoreId,
      } as any);

      vi.mocked(prisma.productVariant.findMany).mockResolvedValue([
        { id: "var-old-1", sku: "SKU-OLD-1" } as any,
      ]);

      vi.mocked(prisma.orderItem.findFirst).mockResolvedValue({
        id: "order-item-1",
        variantId: "var-old-1",
      } as any);

      await expect(
        productService.updateProduct("prod-1", {
          variants: [{ id: "var-keep-1", price: 100 } as any],
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "Cannot delete variant present in order history",
      });
    });
  });

  // ─── Bug 67: Duplicate SKUs within same request ──────────────────────────
  describe("Bug 67: Duplicate SKUs within same Product Creation request", () => {
    it("rejects duplicate explicit variant SKUs with 400 Bad Request", async () => {
      vi.mocked(prisma.store.findUnique).mockResolvedValue({ id: validStoreId, slug: "mystore" } as any);
      vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: "cat-1", storeId: validStoreId } as any);
      vi.mocked(prisma.product.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      await expect(
        productService.createProduct({
          storeId: validStoreId,
          categoryId: "cat-1",
          name: "New Product",
          variants: [
            { sku: "DUPLICATE-SKU", price: 100 },
            { sku: "DUPLICATE-SKU", price: 200 },
          ],
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Duplicate SKU values are not allowed",
      });
    });
  });

  // ─── Bug 68: Presigned Upload URL Validation ─────────────────────────────
  describe("Bug 68: POST /api/v1/upload/presigned-url", () => {
    it("rejects disguised double extensions (shell.php.jpg) with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/upload/presigned-url",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fileName: "shell.php.jpg",
          contentType: "image/jpeg",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/disguised or dangerous/i);
    });

    it("rejects mismatched extension (avatar.png with image/jpeg) with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/upload/presigned-url",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fileName: "avatar.png",
          contentType: "image/jpeg",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/does not match declared content type/i);
    });

    it("accepts valid image uploads with matching extensions", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/upload/presigned-url",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fileName: "banner.jpg",
          contentType: "image/jpeg",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(UploadService.getPresignedUrl).toHaveBeenCalledWith("banner.jpg", "image/jpeg");
    });
  });
});
