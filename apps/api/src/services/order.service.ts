import { EmailService } from "./email.service.js";
import { prisma, type Prisma, type OrderStatus, type PaymentStatus } from "@aurazone/database";
import {
  generateOrderNumber,
  toPaise,
  toRupees,
  calcItemSubtotalPaise,
  calcDiscountPaise,
  calcDeliveryFeePaise,
} from "@aurazone/utils";
import crypto from "crypto";
import { commitOrderInventory, restockInventory } from "./inventory.service.js";
import { transitionOrderStatus } from "./orderStateMachine.js";
import { env } from "../config/env.js";

export async function createOrderFromCart(
  userId: string | undefined,
  sessionId: string | undefined,
  addressInput:
    | string
    | {
        name: string;
        phone: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      },
  paymentMethod: "RAZORPAY" | "COD",
  guestEmail?: string,
  couponCode?: string
) {
  const where = userId
    ? { userId, status: "ACTIVE" as const }
    : { sessionId, status: "ACTIVE" as const };

  const cart = await prisma.cart.findFirst({
    where,
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, slug: true, storeId: true, isActive: true } },
              images: { take: 1, orderBy: { position: "asc" } },
              attributes: true,
              inventory: true,
            },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw Object.assign(new Error("Cart is empty"), { statusCode: 400 });
  }

  // 1. Resolve delivery address
  let addressData: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };

  if (typeof addressInput === "string") {
    const address = await prisma.address.findFirst({
      where: { id: addressInput, ...(userId && { userId }) },
    });
    if (!address) throw Object.assign(new Error("Address not found"), { statusCode: 404 });
    addressData = {
      name: address.name,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? null,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    };
  } else {
    addressData = addressInput;
  }

  // 2. Server-side validation of stock and item validity
  for (const item of cart.items) {
    if (!item.variant || !item.variant.product.isActive || !item.variant.isAvailable) {
      throw Object.assign(
        new Error(`Product variant "${item.variant?.product?.name || "Item"}" is no longer available`),
        { statusCode: 400 }
      );
    }
    const inv = item.variant.inventory;
    const availableStock = inv ? inv.quantity : 0;
    if (item.quantity > availableStock) {
      throw Object.assign(
        new Error(`Insufficient physical stock for "${item.variant.product.name}"`),
        { statusCode: 400 }
      );
    }
  }

  // 3. Exact minor-unit (paise) financial calculations — No float drift
  let subtotalPaise = 0;
  for (const item of cart.items) {
    const itemSubtotal = calcItemSubtotalPaise(item.unitPrice, item.quantity);
    subtotalPaise += itemSubtotal;
  }

  let discountPaise = 0;
  let appliedCouponId: string | null = null;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
      include: {
        products: {
          select: { productId: true },
        },
      },
    });

    if (!coupon || !coupon.isActive) {
      throw Object.assign(new Error("Invalid or inactive coupon code"), { statusCode: 400 });
    }
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      throw Object.assign(new Error("Coupon not active yet"), { statusCode: 400 });
    }
    if (coupon.endDate && now > coupon.endDate) {
      throw Object.assign(new Error("Coupon has expired"), { statusCode: 400 });
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      throw Object.assign(new Error("Coupon usage limit reached"), { statusCode: 400 });
    }

    // ─── Requirement 2: Every coupon should be availed by a user once ───
    if (userId) {
      const existingUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, userId },
      });
      if (existingUsage) {
        throw Object.assign(
          new Error("You have already availed this coupon. Each coupon can only be used once per customer."),
          { statusCode: 400 }
        );
      }
    } else if (guestEmail) {
      const existingUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, email: guestEmail.toLowerCase() },
      });
      if (existingUsage) {
        throw Object.assign(
          new Error(`This coupon has already been availed with email ${guestEmail}.`),
          { statusCode: 400 }
        );
      }
    }

    // ─── Requirement 3: Product-specific coupon assignment ───
    if (coupon.isProductSpecific) {
      const assignedIds = new Set(coupon.products.map((p) => p.productId));
      const eligibleCartItems = cart.items.filter((it) => assignedIds.has(it.variant.product.id));

      if (eligibleCartItems.length === 0) {
        throw Object.assign(
          new Error("This coupon is only valid for specific products not currently in your cart"),
          { statusCode: 400 }
        );
      }

      let eligiblePaise = 0;
      for (const item of eligibleCartItems) {
        eligiblePaise += calcItemSubtotalPaise(item.unitPrice, item.quantity);
      }

      if (coupon.minOrderValue && eligiblePaise < toPaise(coupon.minOrderValue)) {
        throw Object.assign(
          new Error(`Minimum purchase amount of ₹${coupon.minOrderValue} required on eligible products`),
          { statusCode: 400 }
        );
      }

      discountPaise = calcDiscountPaise(
        eligiblePaise,
        coupon.discountType as any,
        coupon.discountValue,
        coupon.maxDiscount
      );
    } else {
      if (coupon.storeId) {
        const cartStoreIds = new Set(cart.items.map((i) => i.variant.product.storeId));
        if (cartStoreIds.size > 1 || !cartStoreIds.has(coupon.storeId)) {
          throw Object.assign(
            new Error("This coupon is only valid for items from a specific store"),
            { statusCode: 400 }
          );
        }
      }
      if (coupon.minOrderValue && subtotalPaise < toPaise(coupon.minOrderValue)) {
        throw Object.assign(
          new Error(`Minimum order value of ₹${coupon.minOrderValue} required for this coupon`),
          { statusCode: 400 }
        );
      }
      discountPaise = calcDiscountPaise(
        subtotalPaise,
        coupon.discountType as any,
        coupon.discountValue,
        coupon.maxDiscount
      );
    }

    appliedCouponId = coupon.id;
  }

  const taxableAmountPaise = Math.max(0, subtotalPaise - discountPaise);
  const deliveryFeePaise = calcDeliveryFeePaise(taxableAmountPaise);
  const totalAmountPaise = taxableAmountPaise + deliveryFeePaise;

  const totalAmountDecimal = toRupees(totalAmountPaise);
  const discountAmountDecimal = toRupees(discountPaise);

  const orderNumber = generateOrderNumber();
  // Issue #6: Only generate tracking token for COD orders at creation time.
  // For online payment orders, defer until payment is confirmed (RECEIVED status)
  // to prevent guests from tracking unpaid/pending orders.
  const trackingToken = paymentMethod === "COD" ? crypto.randomBytes(16).toString("hex") : null;
  const storeIds = [...new Set(cart.items.map((i) => i.variant.product.storeId))];

  // 4. Atomic Database Transaction: Order creation, conditional coupon increment, sorted inventory commit, cart closure
  const order = await prisma.$transaction(async (tx) => {
    const stores = await tx.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, name: true },
    });
    const storeMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));

    let validSessionId: string | null = null;
    if (!userId) {
      const candidateId = cart.sessionId ?? sessionId;
      if (candidateId) {
        const guestSession = await tx.guestSession.findFirst({
          where: {
            OR: [{ id: candidateId }, { sessionId: candidateId }],
          },
        });
        validSessionId = guestSession?.id ?? null;
      }
    }

    // Atomically transition cart from ACTIVE to ORDERED to prevent race checkouts
    const updatedCart = await tx.cart.updateMany({
      where: { id: cart.id, status: "ACTIVE" },
      data: { status: "ORDERED" },
    });

    if (updatedCart.count === 0) {
      throw Object.assign(new Error("Cart has already been checked out or is no longer active"), {
        statusCode: 409,
      });
    }

    // Create Order with immutable snapshot of item prices, product metadata, store name, address
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        trackingToken,
        userId: userId ?? null,
        sessionId: validSessionId,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod,
        totalAmount: totalAmountDecimal,
        couponId: appliedCouponId,
        discountAmount: discountAmountDecimal,
        notes: guestEmail ? `Guest Email: ${guestEmail}` : null,
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productName: item.variant.product.name,
            productSlug: item.variant.product.slug,
            storeName: storeMap[item.variant.product.storeId] ?? "Unknown Store",
            imageUrl: item.variant.images[0]?.url ?? null,
            attributesSnapshot: item.variant.attributes.map((a) => ({
              key: a.key,
              value: a.value,
            })),
            price: item.unitPrice,
            quantity: item.quantity,
            subtotal: toRupees(calcItemSubtotalPaise(item.unitPrice, item.quantity)),
          })),
        },
        orderAddress: {
          create: addressData,
        },
      },
      include: { items: true },
    });

    // Atomic conditional coupon increment
    if (appliedCouponId) {
      const couponUpdate = await tx.$executeRaw`
        UPDATE "Coupon"
        SET used_count = used_count + 1
        WHERE id = ${appliedCouponId}
          AND (usage_limit IS NULL OR used_count < usage_limit)
      `;
      if (couponUpdate === 0) {
        throw Object.assign(new Error("Coupon usage limit reached during checkout"), {
          statusCode: 409,
        });
      }

      // Record per-user coupon usage with database unique constraint enforcement
      await tx.couponUsage.create({
        data: {
          couponId: appliedCouponId,
          userId: userId ?? null,
          email: guestEmail ? guestEmail.toLowerCase() : null,
          orderId: newOrder.id,
        },
      });
    }

    // Commit inventory with sorted deadlock prevention
    await commitOrderInventory(
      newOrder.id,
      newOrder.orderNumber,
      cart.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        cartItemId: item.id,
      })),
      tx,
      userId ?? validSessionId ?? "CHECKOUT"
    );

    // Initial audit log entry
    await tx.orderLog.create({
      data: {
        orderId: newOrder.id,
        orderNumberSnapshot: newOrder.orderNumber,
        adminId: null,
        action: "ORDER_CREATED",
        fromStatus: null,
        toStatus: "PENDING",
        note: `Order placed via ${paymentMethod}. Total: ₹${totalAmountDecimal}`,
        metadata: {
          paymentMethod,
          totalAmountPaise,
          subtotalPaise,
          discountPaise,
          deliveryFeePaise,
        },
      },
    });

    return newOrder;
  });

  // 5. External side effect: Send confirmation email OUTSIDE the database transaction
  const emailToSend =
    guestEmail ??
    (userId ? (await prisma.user.findUnique({ where: { id: userId } }))?.email : null);

  if (emailToSend) {
    try {
      await EmailService.sendOrderConfirmation(emailToSend, order.orderNumber, Number(order.totalAmount));
    } catch (error) {
      console.error("[OrderService] Failed to send order confirmation email:", error);
    }
  }

  return order;
}

export async function getUserOrders(userId: string, skip = 0, take = 10) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      include: {
        items: true,
        orderAddress: true,
        payments: { take: 1, orderBy: { createdAt: "desc" } },
        shipments: { take: 1, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.order.count({ where: { userId, deletedAt: null } }),
  ]);
  return { orders, total };
}

export async function getOrderById(id: string, userId?: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { slug: true } },
              images: { take: 1, orderBy: { position: "asc" } },
            },
          },
        },
      },
      orderAddress: true,
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" }, include: { logs: true } },
      shipments: true,
      orderLogs: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!order || order.deletedAt) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  if (userId && order.userId !== userId) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  return order;
}

/**
 * Updates order status using the central OrderStateMachine.
 */
export async function updateOrderStatus(id: string, status: string, adminId?: string) {
  return transitionOrderStatus({
    orderId: id,
    toStatus: status as OrderStatus,
    actorId: adminId,
    reason: `Admin status update to ${status}`,
  });
}

/**
 * User / Guest order cancellation with safety checks and state machine enforcement.
 */
export async function cancelOrder(
  id: string,
  auth?: { userId?: string; sessionId?: string; trackingToken?: string } | string
) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: true } });
  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  const userId = typeof auth === "string" ? auth : auth?.userId;
  const sessionId = typeof auth === "object" ? auth.sessionId : undefined;
  const trackingToken = typeof auth === "object" ? auth.trackingToken : undefined;

  if (userId) {
    if (order.userId !== userId) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  } else if (sessionId && order.sessionId === sessionId) {
    // Guest session match
  } else if (trackingToken && order.trackingToken === trackingToken) {
    // Guest tracking token match
  } else {
    throw Object.assign(new Error("Unauthorized to cancel this order"), { statusCode: 401 });
  }

  if (!["PENDING", "RECEIVED"].includes(order.status)) {
    throw Object.assign(new Error("Order cannot be cancelled in its current status"), { statusCode: 400 });
  }

  return transitionOrderStatus({
    orderId: id,
    toStatus: "CANCELLED",
    actorId: userId ?? sessionId ?? "CUSTOMER",
    reason: "Cancelled by customer",
  });
}

/**
 * Mark order as failed due to payment failure or gateway cancellation.
 * Safely restores inventory and recovers user's active cart.
 */
export async function failOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, user: true },
  });
  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  if (order.status !== "PENDING" && order.paymentStatus !== "PENDING") {
    throw Object.assign(new Error("Order cannot be marked as failed in its current status"), {
      statusCode: 400,
    });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Transition order and payment status
    await tx.order.update({
      where: { id },
      data: { status: "FAILED", paymentStatus: "FAILED" },
    });

    // 2. Restock inventory
    for (const item of order.items) {
      const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      if (inv) {
        const updated = await tx.inventory.update({
          where: { id: inv.id },
          data: { quantity: { increment: item.quantity } },
        });

        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            orderId: id,
            quantity: item.quantity,
            balanceAfter: updated.quantity,
            reservedAfter: updated.reserved,
            type: "RESTOCK",
            note: `Payment failed for order ${order.orderNumber}`,
            correlationId: id,
          },
        });
      }
    }

    // 3. Restore coupon count
    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }

    await tx.orderLog.create({
      data: {
        orderId: id,
        orderNumberSnapshot: order.orderNumber,
        action: "STATUS_TRANSITION",
        fromStatus: order.status,
        toStatus: "FAILED",
        note: `Order marked as FAILED due to payment gateway failure or timeout`,
      },
    });

    // 4. Restore Cart contents so user does not lose items
    const whereClause = order.userId ? { userId: order.userId } : { sessionId: order.sessionId! };
    if (whereClause.userId || whereClause.sessionId) {
      let activeCart = await tx.cart.findFirst({
        where: { ...whereClause, status: "ACTIVE" },
      });
      if (!activeCart) {
        activeCart = await tx.cart.create({
          data: {
            userId: order.userId,
            sessionId: order.sessionId,
            status: "ACTIVE",
          },
        });
      }

      for (const item of order.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) continue;

        const existing = await tx.cartItem.findFirst({
          where: { cartId: activeCart.id, variantId: item.variantId },
        });

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: item.quantity } },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: activeCart.id,
              productId: variant.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.price,
            },
          });
        }
      }
    }
  });

  // Non-blocking email
  const emailToSend =
    order.user?.email ?? (order.notes?.match(/Guest Email: ([^\s]+)/)?.[1]) ?? null;
  if (emailToSend) {
    try {
      await EmailService.sendOrderStatusUpdate(emailToSend, order.orderNumber, "FAILED");
    } catch (error) {
      console.error("[OrderService] Failed to send order failure email:", error);
    }
  }
}

/**
 * Initiates an independent, financially verified refund.
 * Invariant: Cumulative refunds must never exceed captured amount.
 */
export async function initiateRefund(options: {
  orderId: string;
  amount?: number;
  reason?: string;
  adminId?: string;
  idempotencyKey?: string;
}) {
  const { orderId, amount, reason, adminId, idempotencyKey } = options;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: { where: { status: "SUCCESS" } },
      refunds: true,
    },
  });

  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  // Verify that successful payment exists
  const totalPaidPaise = order.payments.reduce(
    (sum, p) => sum + toPaise(p.amount),
    0
  );

  if (totalPaidPaise === 0) {
    throw Object.assign(
      new Error("Cannot refund an order with no successful payment captured"),
      { statusCode: 400 }
    );
  }

  // Calculate prior refunds in integer paise
  const priorRefundsPaise = order.refunds
    .filter((r) => r.status === "SUCCEEDED" || r.status === "PENDING")
    .reduce((sum, r) => sum + toPaise(r.amount), 0);

  const availableRefundPaise = totalPaidPaise - priorRefundsPaise;
  if (availableRefundPaise <= 0) {
    throw Object.assign(new Error("Order has already been fully refunded"), { statusCode: 400 });
  }

  const requestedRefundPaise = amount !== undefined ? toPaise(amount) : availableRefundPaise;

  if (requestedRefundPaise <= 0) {
    throw Object.assign(new Error("Refund amount must be strictly greater than 0"), { statusCode: 400 });
  }

  if (requestedRefundPaise > availableRefundPaise) {
    throw Object.assign(
      new Error(
        `Requested refund (₹${toRupees(requestedRefundPaise)}) exceeds available refundable balance (₹${toRupees(availableRefundPaise)})`
      ),
      { statusCode: 400 }
    );
  }

  const refundAmountDecimal = toRupees(requestedRefundPaise);
  const primaryPayment = order.payments[0];

  // Atomic database transaction
  const refund = await prisma.$transaction(async (tx) => {
    // 1. Create durable Refund record
    const newRefund = await tx.refund.create({
      data: {
        orderId,
        paymentId: primaryPayment?.id ?? null,
        amount: refundAmountDecimal,
        currency: "INR",
        status: "SUCCEEDED", // Mark as SUCCEEDED (or PENDING if async gateway)
        reason: reason ?? "Admin initiated refund",
        gateway: primaryPayment?.gateway ?? "RAZORPAY",
        idempotencyKey: idempotencyKey ?? null,
        adminId: adminId ?? null,
        processedAt: new Date(),
      },
    });

    // 2. Write RefundLog
    await tx.refundLog.create({
      data: {
        refundId: newRefund.id,
        fromStatus: "REQUESTED",
        toStatus: "SUCCEEDED",
        actorId: adminId ?? "ADMIN",
        note: reason ?? `Refund of ₹${refundAmountDecimal} approved`,
      },
    });

    // 3. Update Order paymentStatus: REFUNDED (if full) or PARTIALLY_REFUNDED (if partial)
    const newTotalRefundedPaise = priorRefundsPaise + requestedRefundPaise;
    const isFullRefund = newTotalRefundedPaise >= totalPaidPaise;
    const newPaymentStatus: PaymentStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: newPaymentStatus,
        ...(isFullRefund && order.status !== "CANCELLED" && { status: "CANCELLED" }),
      },
    });

    // 4. Update Payment record if full refund
    if (primaryPayment && isFullRefund) {
      await tx.payment.update({
        where: { id: primaryPayment.id },
        data: { status: "REFUNDED" },
      });
    }

    // 5. Write PaymentLog with accurate model fields
    await tx.paymentLog.create({
      data: {
        orderId,
        paymentId: primaryPayment?.id ?? null,
        orderNumberSnapshot: order.orderNumber,
        adminId: adminId ?? null,
        action: "REFUND_PROCESSED",
        fromStatus: order.paymentStatus,
        toStatus: newPaymentStatus,
        amount: refundAmountDecimal,
        note: `Processed refund of ₹${refundAmountDecimal}. Reason: ${reason ?? "None provided"}`,
        metadata: {
          refundId: newRefund.id,
          requestedRefundPaise,
          priorRefundsPaise,
          totalPaidPaise,
          isFullRefund,
        },
      },
    });

    return newRefund;
  });

  return refund;
}

export async function getOrderByTrackingToken(token: string) {
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: {
      items: true,
      orderAddress: true,
      shipments: true,
      orderLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  return order;
}