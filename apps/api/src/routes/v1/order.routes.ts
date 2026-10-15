import type { FastifyPluginAsync } from "fastify";
import { parsePagination } from "@aurazone/utils";
import { prisma } from "@aurazone/database";
import { optionalAuth, authenticate } from "../../middleware/auth.js";
import { sendSuccess, sendError, sendPaginated } from "../../middleware/response.js";
import * as orderService from "../../services/order.service.js";

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/coupons/validate", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { code, subtotal } = request.body as { code: string; subtotal: number };
    if (!code || subtotal === undefined) return sendError(reply, "code and subtotal are required", 400);

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } }
        ],
      }
    });

    if (!coupon) return sendError(reply, "Invalid or expired coupon", 400);
    if (coupon.endDate && coupon.endDate < new Date()) return sendError(reply, "Coupon has expired", 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return sendError(reply, "Coupon usage limit reached", 400);
    if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
      return sendError(reply, `Minimum purchase amount of ₹${coupon.minOrderValue} required`, 400);
    }

    if (coupon.storeId) {
      // Find active cart to verify items belong to the store
      const userId = request.user?.userId;
      const sessionId = request.headers["x-guest-session"] as string | undefined;
      const where = userId ? { userId, status: "ACTIVE" as const } : { sessionId, status: "ACTIVE" as const };
      
      const cart = await prisma.cart.findFirst({
        where,
        include: { items: { include: { variant: { include: { product: true } } } } }
      });

      if (cart) {
        const cartStoreIds = new Set(cart.items.map((i) => i.variant.product.storeId));
        if (cartStoreIds.size > 1 || !cartStoreIds.has(coupon.storeId)) {
          return sendError(reply, "This coupon is only valid for items from a specific store", 400);
        }
      }
    }

    let discount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discount = (subtotal * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }
    } else {
      discount = Number(coupon.discountValue);
    }

    return sendSuccess(reply, {
      code: coupon.code,
      discount,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      finalTotal: subtotal - discount,
    });
  });

  fastify.post("/", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { addressId, address, paymentMethod, couponCode, guestEmail } = request.body as {
      addressId?: string;
      address?: {
        name: string; phone: string; addressLine1: string; addressLine2?: string;
        city: string; state: string; postalCode: string; country: string;
      };
      paymentMethod: "RAZORPAY" | "COD";
      couponCode?: string;
      guestEmail?: string;
    };

    if (!addressId && !address) return sendError(reply, "addressId or address is required", 400);
    if (!paymentMethod) return sendError(reply, "paymentMethod is required", 400);

    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;

    if (!userId && !sessionId) return sendError(reply, "Unauthorized", 401);

    try {
      const order = await orderService.createOrderFromCart(
        userId, sessionId, addressId ?? address!, paymentMethod, guestEmail, couponCode
      );
      return sendSuccess(reply, order, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const { orders, total } = await orderService.getUserOrders(request.user!.userId, skip, take);
    return sendPaginated(reply, orders, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const order = await orderService.getOrderById(id, request.user!.userId);
      return sendSuccess(reply, order);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/:id/cancel", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { trackingToken?: string }) || {};
    const sessionId = request.headers["x-guest-session"] as string | undefined;
    const userId = request.user?.userId;

    try {
      await orderService.cancelOrder(id, { userId, sessionId, trackingToken: body.trackingToken });
      return sendSuccess(reply, { message: "Order cancelled successfully" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/:id/fail-payment", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return sendError(reply, "Order not found", 404);
    
    if (userId && order.userId !== userId) return sendError(reply, "Unauthorized", 401);
    if (!userId && order.sessionId !== sessionId) return sendError(reply, "Unauthorized", 401);

    try {
      await orderService.failOrder(id);
      return sendSuccess(reply, { message: "Order marked as failed" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.get("/track/lookup", async (request, reply) => {
    const query = request.query as { orderNumber: string; email: string };
    if (!query.orderNumber || !query.email) {
      return sendError(reply, "Order number and email are required", 400);
    }
    try {
      const order = await prisma.order.findFirst({
        where: { orderNumber: query.orderNumber },
        include: { user: true }
      });
      if (!order) return sendError(reply, "Order not found", 404);
      
      const orderEmail = order.user?.email || order.notes?.match(/Guest Email: ([^\s]+)/)?.[1];
      if (!orderEmail || orderEmail.toLowerCase() !== query.email.toLowerCase()) {
        return sendError(reply, "Invalid email for this order", 403);
      }
      
      return sendSuccess(reply, { trackingToken: order.trackingToken });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.get("/track/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      const order = await orderService.getOrderByTrackingToken(token);
      return sendSuccess(reply, order);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });
};

export default orderRoutes;