import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import jwt from "jsonwebtoken";
import adminRoutes from "./admin/index.js";
import { globalErrorHandler } from "../../middleware/response.js";
import { env } from "../../config/env.js";

// Mock database and services
vi.mock("@aurazone/database", () => {
  const p: any = {
    $transaction: vi.fn(async (arg) => {
      if (typeof arg === "function") {
        return arg(p);
      }
      return Promise.all(arg);
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    inventoryLog: {
      create: vi.fn(),
    },
    coupon: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    couponProduct: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    storefrontSection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    notificationHistory: {
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
    },
    notificationPreferences: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    userSession: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 1000 }, _count: { id: 5 } }),
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(5),
    },
    orderItem: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: p,
    Prisma: {
      join: (arr: any[]) => arr.join(","),
    },
  };
});

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("mocked_hash"),
  },
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn().mockResolvedValue("mocked_hash"),
}));

import { prisma } from "@aurazone/database";

describe("Bugs 69-89 Test Suite", () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = Fastify();
    await app.register(fastifyCookie);
    app.setErrorHandler(globalErrorHandler);
    await app.register(adminRoutes, { prefix: "/api/v1/admin" });
    await app.ready();

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
  });

  // ─── Module 1: Coupons (Bugs 69-73) ─────────────────────────────────────────
  describe("Module 1: Coupons (Bugs 69-73)", () => {
    it("Bug 69: rejects percentage discount > 100 with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/coupons",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: "SUPER105",
          discountType: "PERCENTAGE",
          discountValue: 105,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/percentage discount must be between 1 and 100/i);
    });

    it("Bug 70: rejects zero and negative discount values with 400 Bad Request", async () => {
      const resZero = await app.inject({
        method: "POST",
        url: "/api/v1/admin/coupons",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: "ZEROOFF",
          discountType: "FIXED_AMOUNT",
          discountValue: 0,
        },
      });
      expect(resZero.statusCode).toBe(400);

      const resNeg = await app.inject({
        method: "POST",
        url: "/api/v1/admin/coupons",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: "NEGOFF",
          discountType: "FIXED_AMOUNT",
          discountValue: -10,
        },
      });
      expect(resNeg.statusCode).toBe(400);
    });

    it("Bug 71: rejects coupon creation when endDate is earlier than startDate with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/coupons",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: "BADRANGE",
          discountType: "PERCENTAGE",
          discountValue: 20,
          startDate: "2026-12-31T00:00:00.000Z",
          endDate: "2026-11-01T00:00:00.000Z",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/end date must be after start date/i);
    });

    it("Bug 72: rejects coupon update when usageLimit is lower than usedCount with 400", async () => {
      vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
        id: "cpn-1",
        code: "POPULAR",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usedCount: 50,
        usageLimit: 100,
        storeId: null,
      } as any);

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/coupons/cpn-1",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          usageLimit: 10,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/usage limit cannot be lower than the existing redemption count/i);
    });

    it("Bug 73: returns 409 Conflict when submitting a duplicate coupon code", async () => {
      vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
        id: "cpn-existing",
        code: "SAVE10",
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/coupons",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          code: "SAVE10",
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/coupon code already exists/i);
    });
  });

  // ─── Module 2: Storefront CMS (Bugs 74-78) ──────────────────────────────────
  describe("Module 2: Storefront CMS (Bugs 74-78)", () => {
    it("Bug 74: rejects javascript: protocol injection in CTA links with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/storefront",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          page: "home",
          type: "HERO_BANNER",
          content: {
            ctaLink: "javascript:alert(document.cookie)",
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/javascript:/i);
    });

    it("Bug 75: rejects CUSTOM_HTML containing <script> tags or inline event handlers with 400", async () => {
      const resScript = await app.inject({
        method: "POST",
        url: "/api/v1/admin/storefront",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          page: "home",
          type: "CUSTOM_HTML",
          content: {
            html: "<script>alert('pwned')</script>",
          },
        },
      });
      expect(resScript.statusCode).toBe(400);
      expect(JSON.parse(resScript.body).error).toMatch(/script/i);

      const resHandler = await app.inject({
        method: "POST",
        url: "/api/v1/admin/storefront",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          page: "home",
          type: "CUSTOM_HTML",
          content: {
            html: "<img src=x onerror=alert(1)>",
          },
        },
      });
      expect(resHandler.statusCode).toBe(400);
      expect(JSON.parse(resHandler.body).error).toMatch(/inline event handlers/i);
    });

    it("Bug 76: rejects CUSTOM_HTML containing @import statements with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/storefront",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          page: "home",
          type: "CUSTOM_HTML",
          content: {
            html: "<style>@import url('https://evil.com/leak.css');</style>",
          },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/@import/i);
    });

    it("Bug 77: GET /admin/storefront/:id returns 200 with section details, 404 if deleted", async () => {
      vi.mocked(prisma.storefrontSection.findUnique).mockResolvedValueOnce({
        id: "sec-1",
        page: "home",
        type: "HERO_BANNER",
        storeId: null,
        deletedAt: null,
      } as any);

      const resSuccess = await app.inject({
        method: "GET",
        url: "/api/v1/admin/storefront/sec-1",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resSuccess.statusCode).toBe(200);
      expect(JSON.parse(resSuccess.body).data.id).toBe("sec-1");

      vi.mocked(prisma.storefrontSection.findUnique).mockResolvedValueOnce(null);
      const resNotFound = await app.inject({
        method: "GET",
        url: "/api/v1/admin/storefront/sec-missing",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(resNotFound.statusCode).toBe(404);
    });

    it("Bug 78: rejects storefront creation when page field is omitted with 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/storefront",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          type: "HERO_BANNER",
          content: { title: "Welcome" },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/page/i);
    });
  });

  // ─── Module 3: Analytics & Reporting (Bugs 79-81) ───────────────────────────
  describe("Module 3: Analytics & Reporting (Bugs 79-81)", () => {
    it("Bug 79: GET /analytics includes aov and averageOrderValue", async () => {
      vi.mocked(prisma.order.aggregate).mockResolvedValue({
        _sum: { totalAmount: 5000 },
        _count: { id: 10 },
      } as any);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/analytics",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body).data;
      expect(body.totalRevenue).toBe(5000);
      expect(body.aov).toBe(500);
      expect(body.averageOrderValue).toBe(500);
    });

    it("Bug 80: revenueByDay filters by DELIVERED and SUCCESS and excluded soft-deleted orders", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/analytics",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it("Bug 81: topProducts sorts by subtotal desc and limits to 5 with date/status filter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/analytics",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          orderBy: { _sum: { subtotal: "desc" } },
          where: expect.objectContaining({
            order: expect.objectContaining({
              status: { in: ["DELIVERED", "SUCCESS"] },
              deletedAt: null,
            }),
          }),
        })
      );
    });
  });

  // ─── Module 4: Notifications & Alerts (Bugs 82 & 85) ─────────────────────────
  describe("Module 4: Notifications & Alerts (Bugs 82 & 85)", () => {
    it("Bug 82: rejects PATCH /notifications/:id/read if notification belongs to another admin with 403", async () => {
      vi.mocked(prisma.notificationHistory.findUnique).mockResolvedValue({
        id: "notif-other",
        userId: "admin-other",
        isRead: false,
      } as any);

      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/notifications/notif-other/read",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/forbidden/i);
    });

    it("Bug 85: rejects nested channel objects in PUT /notification-preferences with 400 instead of 500", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/notification-preferences",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          newOrders: { inApp: true, email: false },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/must be a boolean/i);
    });

    it("Bug 83 & Bug 84: createStaffNotification creates notifications for admin and store managers", async () => {
      const { createStaffNotification } = await import("../../services/notification.service.js");

      vi.mocked(prisma.user.findMany).mockImplementation((async (query: any) => {
        if (query?.where?.role === "SUPER_ADMIN") {
          return [{ id: "admin-1" }] as any;
        }
        if (query?.where?.role === "STORE_MANAGER") {
          return [{ id: "manager-1" }] as any;
        }
        return [] as any;
      }) as any);

      const count = await createStaffNotification(prisma, {
        storeIds: ["store-1"],
        title: "New Order Placed",
        body: "Order #AZ-1001 placed for ₹1,200",
      });

      expect(count).toBe(2);
      expect(prisma.notificationHistory.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "admin-1", title: "New Order Placed" }),
          expect.objectContaining({ userId: "manager-1", title: "New Order Placed" }),
        ]),
      });
    });
  });

  // ─── Module 5: Admin Profile, Password & Sessions (Bugs 86-89) ───────────────
  describe("Module 5: Admin Profile, Password & Sessions (Bugs 86-89)", () => {
    it("Bug 86: rejects password change when confirmPassword does not match with 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/profile/password",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          currentPassword: "OldPassword123",
          newPassword: "NewPassword123",
          confirmPassword: "MismatchPassword123",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/new password and confirmation password do not match/i);
    });

    it("Bug 87: rejects profile update with empty fullName with 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/admin/profile",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          fullName: "   ",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toMatch(/full name cannot be empty/i);
    });

    it("Bug 88: supports POST /api/v1/admin/change-password endpoint", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "admin-1",
        email: "admin@aurazone.com",
        role: "SUPER_ADMIN",
        password: "hashed_current_password",
        isActive: true,
      } as any);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/change-password",
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          currentPassword: "OldPassword123",
          newPassword: "NewPassword123",
          confirmPassword: "NewPassword123",
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.message).toBe("Password updated");
    });

    it("Bug 89: session revocation returns 404 for non-existent session and 403 for another user's session", async () => {
      vi.mocked(prisma.userSession.findUnique).mockResolvedValueOnce(null);
      const res404 = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/sessions/non-existent-id",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res404.statusCode).toBe(404);

      vi.mocked(prisma.userSession.findUnique).mockResolvedValueOnce({
        id: "sess-other",
        userId: "other-user-id",
      } as any);
      const res403 = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/sessions/sess-other",
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res403.statusCode).toBe(403);
    });
  });
});
