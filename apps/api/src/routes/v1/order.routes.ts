import type { FastifyPluginAsync } from "fastify";
import { parsePagination, toPaise, toRupees, calcDiscountPaise } from "@aurazone/utils";
import { prisma } from "@aurazone/database";
import { addressSchema } from "@aurazone/validators";
import { optionalAuth, authenticate } from "../../middleware/auth.js";
import { sendSuccess, sendError, sendPaginated, handleRouteError } from "../../middleware/response.js";
import * as orderService from "../../services/order.service.js";
import { withIdempotency } from "../../services/idempotency.service.js";

const orderRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/coupons/storefront", async (request, reply) => {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: {
        showInStorefront: true,
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                brand: true,
                variants: {
                  where: { deletedAt: null },
                  select: { id: true, price: true, images: { take: 1, orderBy: { position: "asc" } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    return sendSuccess(reply, coupons);
  });

  fastify.get("/coupons/details/:code", async (request, reply) => {
    const { code } = request.params as { code: string };
    const now = new Date();
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                brand: true,
                variants: {
                  where: { deletedAt: null },
                  select: { id: true, price: true, images: { take: 1, orderBy: { position: "asc" } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!coupon) return sendError(reply, "Coupon not found or inactive", 404);
    return sendSuccess(reply, coupon);
  });

  fastify.post("/coupons/validate", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { code, subtotal, items, guestEmail } = (request.body as {
      code: string;
      subtotal: number;
      items?: Array<{ productId: string; variantId?: string; price: number; quantity: number }>;
      guestEmail?: string;
    }) || {};

    if (
      !code ||
      typeof code !== "string" ||
      !code.trim() ||
      subtotal === undefined ||
      typeof subtotal !== "number" ||
      isNaN(subtotal) ||
      subtotal < 0
    ) {
      return sendError(reply, "Valid coupon code and non-negative numeric subtotal are required", 400);
    }

    const subtotalPaise = toPaise(subtotal);
    const now = new Date();

    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
      },
      include: {
        products: {
          select: { productId: true },
        },
      },
    });

    if (!coupon) return sendError(reply, "Invalid coupon code", 400);
    if (!coupon.isActive) return sendError(reply, "This coupon is currently inactive", 400);
    if (coupon.startDate && coupon.startDate > now) {
      return sendError(
        reply,
        `This coupon will be active starting ${coupon.startDate.toLocaleDateString()}`,
        400
      );
    }
    if (coupon.endDate && coupon.endDate < now) return sendError(reply, "This coupon has expired", 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return sendError(reply, "This coupon has reached its maximum global usage limit", 400);
    }

    // ─── Requirement 2: Every coupon should be availed by a user once ───
    const userId = request.user?.userId;
    const emailCandidate = (guestEmail || request.user?.email)?.toLowerCase();

    if (userId) {
      const existingUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, userId },
      });
      if (existingUsage) {
        return sendError(
          reply,
          "You have already availed this coupon. Each coupon can only be used once per customer.",
          400
        );
      }
    } else if (emailCandidate) {
      const existingUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, email: emailCandidate },
      });
      if (existingUsage) {
        return sendError(
          reply,
          `This coupon has already been availed with email ${emailCandidate}.`,
          400
        );
      }
    }

    let discountPaise = 0;
    let applicableProductIds: string[] | null = null;

    // ─── Requirement 3: Product-specific coupon assignment ───
    if (coupon.isProductSpecific) {
      const assignedIds = new Set(coupon.products.map((p) => p.productId));
      applicableProductIds = Array.from(assignedIds);

      // If client supplied item details directly
      if (items && items.length > 0) {
        const eligibleItems = items.filter((it) => assignedIds.has(it.productId));
        if (eligibleItems.length === 0) {
          return sendError(
            reply,
            "This coupon is only valid for specific products not currently in your order.",
            400
          );
        }

        const eligiblePaise = eligibleItems.reduce(
          (sum, it) => sum + toPaise(it.price * it.quantity),
          0
        );

        if (coupon.minOrderValue && eligiblePaise < toPaise(coupon.minOrderValue)) {
          return sendError(
            reply,
            `Minimum purchase amount of ₹${coupon.minOrderValue} required on eligible products`,
            400
          );
        }

        discountPaise = calcDiscountPaise(
          eligiblePaise,
          coupon.discountType as any,
          coupon.discountValue,
          coupon.maxDiscount
        );
      } else {
        // Fallback: Check user's active cart in database
        const sessionId = request.headers["x-guest-session"] as string | undefined;
        const cartWhere = userId
          ? { userId, status: "ACTIVE" as const }
          : { sessionId, status: "ACTIVE" as const };

        const cart = await prisma.cart.findFirst({
          where: cartWhere,
          include: { items: { include: { variant: { include: { product: true } } } } },
        });

        if (cart) {
          const eligibleCartItems = cart.items.filter((it) => assignedIds.has(it.variant.product.id));
          if (eligibleCartItems.length === 0) {
            return sendError(
              reply,
              "This coupon is only valid for specific products not currently in your cart.",
              400
            );
          }

          let eligiblePaise = 0;
          for (const item of eligibleCartItems) {
            eligiblePaise += toPaise(Number(item.unitPrice) * item.quantity);
          }

          if (coupon.minOrderValue && eligiblePaise < toPaise(coupon.minOrderValue)) {
            return sendError(
              reply,
              `Minimum purchase amount of ₹${coupon.minOrderValue} required on eligible products`,
              400
            );
          }

          discountPaise = calcDiscountPaise(
            eligiblePaise,
            coupon.discountType as any,
            coupon.discountValue,
            coupon.maxDiscount
          );
        } else {
          // If no cart in DB and no items passed, check minOrderValue on subtotal
          if (coupon.minOrderValue && subtotalPaise < toPaise(coupon.minOrderValue)) {
            return sendError(
              reply,
              `Minimum purchase amount of ₹${coupon.minOrderValue} required`,
              400
            );
          }
          discountPaise = calcDiscountPaise(
            subtotalPaise,
            coupon.discountType as any,
            coupon.discountValue,
            coupon.maxDiscount
          );
        }
      }
    } else {
      // Store-wide or general coupon
      if (coupon.storeId) {
        const sessionId = request.headers["x-guest-session"] as string | undefined;
        const where = userId
          ? { userId, status: "ACTIVE" as const }
          : { sessionId, status: "ACTIVE" as const };

        const cart = await prisma.cart.findFirst({
          where,
          include: { items: { include: { variant: { include: { product: true } } } } },
        });

        if (cart) {
          const cartStoreIds = new Set(cart.items.map((i) => i.variant.product.storeId));
          if (cartStoreIds.size > 1 || !cartStoreIds.has(coupon.storeId)) {
            return sendError(reply, "This coupon is only valid for items from a specific store", 400);
          }
        }
      }

      if (coupon.minOrderValue && subtotalPaise < toPaise(coupon.minOrderValue)) {
        return sendError(
          reply,
          `Minimum purchase amount of ₹${coupon.minOrderValue} required`,
          400
        );
      }

      discountPaise = calcDiscountPaise(
        subtotalPaise,
        coupon.discountType as any,
        coupon.discountValue,
        coupon.maxDiscount
      );
    }

    const discountRupees = toRupees(discountPaise);
    const finalTotalRupees = toRupees(Math.max(0, subtotalPaise - discountPaise));

    return sendSuccess(reply, {
      code: coupon.code,
      description: coupon.description,
      discount: discountRupees,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxDiscount: coupon.maxDiscount ? Number(coupon.maxDiscount) : null,
      minOrderValue: coupon.minOrderValue ? Number(coupon.minOrderValue) : null,
      finalTotal: finalTotalRupees,
      endDate: coupon.endDate ? coupon.endDate.toISOString() : null,
      isProductSpecific: coupon.isProductSpecific,
      applicableProductIds,
    });
  });

  fastify.post("/", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { addressId, address, paymentMethod, couponCode, guestEmail } = (request.body as {
      addressId?: string;
      address?: {
        name: string; phone: string; addressLine1: string; addressLine2?: string;
        city: string; state: string; postalCode: string; country: string;
      };
      paymentMethod: "RAZORPAY" | "COD";
      couponCode?: string;
      guestEmail?: string;
    }) || {};

    if (!addressId && !address) return sendError(reply, "addressId or address is required", 400);
    if (address) {
      const parsed = addressSchema.safeParse(address);
      if (!parsed.success) {
        return sendError(reply, parsed.error.issues[0]?.message || "Invalid address format", 400);
      }
    }
    if (!paymentMethod || !["RAZORPAY", "COD"].includes(paymentMethod)) {
      return sendError(reply, "Valid paymentMethod ('RAZORPAY' or 'COD') is required", 400);
    }

    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;

    if (!userId && !sessionId) return sendError(reply, "Unauthorized", 401);

    const idempotencyKey = (request.headers["idempotency-key"] || request.headers["x-idempotency-key"]) as string | undefined;

    try {
      if (idempotencyKey) {
        const result = await withIdempotency(
          {
            key: idempotencyKey,
            scope: "CHECKOUT",
            userId,
            sessionId,
            payload: request.body,
          },
          async () => {
            const order = await orderService.createOrderFromCart(
              userId, sessionId, addressId ?? address!, paymentMethod, guestEmail, couponCode
            );
            return { statusCode: 201, body: order };
          }
        );
        return sendSuccess(reply, result.body, result.statusCode);
      }

      const order = await orderService.createOrderFromCart(
        userId, sessionId, addressId ?? address!, paymentMethod, guestEmail, couponCode
      );
      return sendSuccess(reply, order, 201);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post("/direct", { preHandler: [optionalAuth] }, async (request, reply) => {
    const body = (request.body as {
      variantId?: string;
      quantity?: number;
      addressId?: string;
      address?: {
        name: string; phone: string; addressLine1: string; addressLine2?: string;
        city: string; state: string; postalCode: string; country: string;
      };
      paymentMethod?: "RAZORPAY" | "COD";
      couponCode?: string;
      guestEmail?: string;
    }) || {};

    const { variantId, quantity = 1, addressId, address, paymentMethod, couponCode, guestEmail } = body;

    if (!variantId || typeof variantId !== "string") {
      return sendError(reply, "variantId is required", 400);
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return sendError(reply, "quantity must be a positive integer", 400);
    }
    if (!addressId && !address) {
      return sendError(reply, "addressId or address is required", 400);
    }
    if (address) {
      const parsedAddress = addressSchema.safeParse(address);
      if (!parsedAddress.success) {
        return sendError(reply, parsedAddress.error.issues[0]?.message || "Invalid address format", 400);
      }
    }
    if (!paymentMethod || !["RAZORPAY", "COD"].includes(paymentMethod)) {
      return sendError(reply, "Valid paymentMethod ('RAZORPAY' or 'COD') is required", 400);
    }

    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;

    if (!userId && !sessionId) return sendError(reply, "Unauthorized", 401);

    const idempotencyKey = (request.headers["idempotency-key"] || request.headers["x-idempotency-key"]) as string | undefined;

    try {
      if (idempotencyKey) {
        const result = await withIdempotency(
          {
            key: idempotencyKey,
            scope: "DIRECT_CHECKOUT",
            userId,
            sessionId,
            payload: request.body,
          },
          async () => {
            const order = await orderService.createDirectOrder(
              userId, sessionId, variantId, quantity, addressId ?? address!, paymentMethod, guestEmail, couponCode
            );
            return { statusCode: 201, body: order };
          }
        );
        return sendSuccess(reply, result.body, result.statusCode);
      }

      const order = await orderService.createDirectOrder(
        userId, sessionId, variantId, quantity, addressId ?? address!, paymentMethod, guestEmail, couponCode
      );
      return sendSuccess(reply, order, 201);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  fastify.get("/", { preHandler: [optionalAuth] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;

    if (!userId && !sessionId) {
      return sendPaginated(reply, [], 0, 1, take);
    }

    const { orders, total } = await orderService.getUserOrders({ userId, sessionId, skip, take });
    return sendPaginated(reply, orders, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/:id", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;
    const trackingToken = (request.query as { token?: string })?.token;

    try {
      const order = await orderService.getOrderById(id, { userId, sessionId, trackingToken });
      return sendSuccess(reply, order);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
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
      return handleRouteError(reply, err);
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
      return handleRouteError(reply, err);
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
        include: { user: true, orderAddress: true },
      });
      if (!order) return sendError(reply, "Order not found", 404);

      const orderEmail =
        order.user?.email ||
        order.orderAddress?.email ||
        order.notes?.match(/Guest Email: ([^\s]+)/)?.[1];
      if (!orderEmail || orderEmail.toLowerCase() !== query.email.toLowerCase()) {
        return sendError(reply, "Invalid email for this order", 403);
      }
      
      return sendSuccess(reply, { trackingToken: order.trackingToken });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  fastify.get("/track/:token", async (request, reply) => {
    const { token } = request.params as { token: string };
    try {
      const order = await orderService.getOrderByTrackingToken(token);
      return sendSuccess(reply, order);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });
};

export default orderRoutes;