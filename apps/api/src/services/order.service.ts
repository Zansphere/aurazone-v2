import { EmailService } from './email.service.js';
import { prisma, type Prisma } from "@aurazone/database";
import { generateOrderNumber } from "@aurazone/utils";
import crypto from "crypto";

export async function createOrderFromCart(
  userId: string | undefined,
  sessionId: string | undefined,
  addressInput: string | {
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
  const where = userId ? { userId, status: "ACTIVE" as const } : { sessionId, status: "ACTIVE" as const };
  const cart = await prisma.cart.findFirst({
    where,
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { name: true, slug: true, storeId: true } },
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

  let addressData;
  if (typeof addressInput === "string") {
    const address = await prisma.address.findFirst({ where: { id: addressInput, userId } });
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

  for (const item of cart.items) {
    const stock = item.variant.inventory?.quantity ?? 0;
    if (item.quantity > stock) {
      throw Object.assign(
        new Error(`Insufficient stock for "${item.variant.product.name}"`),
        { statusCode: 400 }
      );
    }
  }

  let totalAmount = 0;
  for (const item of cart.items) {
    totalAmount += item.unitPrice.toNumber() * item.quantity;
  }

  let discountAmount = 0;
  let appliedCouponId = null;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (!coupon || !coupon.isActive) {
      throw Object.assign(new Error("Invalid or inactive coupon code"), { statusCode: 400 });
    }
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) throw Object.assign(new Error("Coupon not active yet"), { statusCode: 400 });
    if (coupon.endDate && now > coupon.endDate) throw Object.assign(new Error("Coupon expired"), { statusCode: 400 });
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw Object.assign(new Error("Coupon limit reached"), { statusCode: 400 });
    if (coupon.minOrderValue && totalAmount < coupon.minOrderValue.toNumber()) throw Object.assign(new Error(`Minimum order value of ${coupon.minOrderValue} required`), { statusCode: 400 });

    if (coupon.storeId) {
      // Ensure all items in the cart belong to the store this coupon is for
      const cartStoreIds = new Set(cart.items.map((i) => i.variant.product.storeId));
      if (cartStoreIds.size > 1 || !cartStoreIds.has(coupon.storeId)) {
        throw Object.assign(new Error("This coupon is only valid for items from a specific store"), { statusCode: 400 });
      }
    }

    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = totalAmount * (coupon.discountValue.toNumber() / 100);
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount.toNumber());
      }
    } else {
      discountAmount = coupon.discountValue.toNumber();
    }
    
    // Cap discount at total amount
    discountAmount = Math.min(discountAmount, totalAmount);
    totalAmount -= discountAmount;
    appliedCouponId = coupon.id;
  }

  const deliveryFee = totalAmount >= 499 ? 0 : 49;
  totalAmount += deliveryFee;

  const orderNumber = generateOrderNumber();
  const trackingToken = crypto.randomBytes(16).toString("hex");

  const storeIds = [...new Set(cart.items.map((i) => i.variant.product.storeId))];

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

    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        trackingToken,
        userId: userId ?? null,
        sessionId: validSessionId,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod,
        totalAmount,
        couponId: appliedCouponId,
        discountAmount,
        notes: guestEmail ? `Guest Email: ${guestEmail}` : null,
        items: {
          create: cart.items.map((item) => ({
            variantId: item.variantId,
            productName: item.variant.product.name,
            productSlug: item.variant.product.slug,
            storeName: storeMap[item.variant.product.storeId] ?? "Unknown",
            imageUrl: item.variant.images[0]?.url ?? null,
            attributesSnapshot: item.variant.attributes.map((a) => ({
              key: a.key,
              value: a.value,
            })),
            price: item.unitPrice,
            quantity: item.quantity,
            subtotal: item.unitPrice.toNumber() * item.quantity,
          })),
        },
        orderAddress: {
          create: addressData,
        },
      },
      include: { items: true },
    });

    if (appliedCouponId) {
      // Atomic conditional increment: only succeeds if usedCount < usageLimit
      // This prevents concurrent checkouts from exceeding the limit
      const couponUpdate = await tx.$executeRaw`
        UPDATE "Coupon"
        SET used_count = used_count + 1
        WHERE id = ${appliedCouponId}
          AND (usage_limit IS NULL OR used_count < usage_limit)
      `;
      if (couponUpdate === 0) {
        throw Object.assign(new Error("Coupon usage limit reached"), { statusCode: 409 });
      }
    }

    // Commit inventory (transform soft hold to hard sale)
    for (const item of cart.items) {
      if (item.variant.inventory) {
        // Delete the reservation record for this cart item
        const reservation = await tx.inventoryReservation.findUnique({
          where: { cartItemId: item.id },
        });
        const reservedRelease = reservation 
          ? Math.min(item.quantity, reservation.quantity) 
          : Math.min(item.quantity, item.variant.inventory.reserved);
        
        await tx.inventory.update({
          where: { id: item.variant.inventory.id },
          data: { 
            quantity: { decrement: item.quantity },
            reserved: { decrement: reservedRelease } 
          },
        });

        if (reservation) {
          await tx.inventoryReservation.delete({ where: { id: reservation.id } });
        }
      }
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          orderId: newOrder.id,
          quantity: -item.quantity,
          type: "SOLD",
          note: `Order ${orderNumber}`,
        },
      });
    }

    // Verify cart is still active and atomically mark as ORDERED
    const updatedCart = await tx.cart.updateMany({
      where: { id: cart.id, status: "ACTIVE" },
      data: { status: "ORDERED" }
    });
    
    if (updatedCart.count === 0) {
      throw Object.assign(new Error("Cart has already been checked out"), { statusCode: 409 });
    }

    return newOrder;
  });

  const emailToSend = guestEmail ?? (userId ? (await prisma.user.findUnique({ where: { id: userId } }))?.email : null);
  
  if (emailToSend) {
    try {
      await EmailService.sendOrderConfirmation(emailToSend, order.orderNumber, Number(order.totalAmount));
    } catch (error) {
      console.error("Failed to queue order confirmation email", error);
    }
  }

  return order;
}

export async function getUserOrders(userId: string, skip = 0, take = 10) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip, take,
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
      payments: true,
      shipments: true,
      orderLogs: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!order || order.deletedAt) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  if (userId && order.userId !== userId) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  return order;
}

export async function updateOrderStatus(id: string, status: string, adminId?: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { user: true, items: true } });
  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  if (order.status === status) return order;

  if (order.status === "DELIVERED" || order.status === "SUCCESS") {
    throw Object.assign(new Error("Cannot change status of an already delivered order"), { statusCode: 400 });
  }

  if (order.status === "CANCELLED") {
    throw Object.assign(new Error("Cannot change status of a cancelled order"), { statusCode: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({ where: { id }, data: { status: status as any }, include: { user: true } });
    
    // Admin Cancelled Order -> Restock Inventory
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      for (const item of order.items) {
        const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
        if (inv) {
          await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: item.quantity } } });
        }
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            orderId: id,
            quantity: item.quantity,
            type: "RESTOCK",
            note: `Admin cancelled order ${order.orderNumber}`,
          },
        });
      }
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }
    
    if (adminId) {
      await tx.orderLog.create({
        data: {
          orderId: id,
          adminId,
          action: "STATUS_UPDATE",
          fromStatus: order.status,
          toStatus: status as any,
          note: `Status changed from ${order.status} to ${status}`,
        },
      });
    }

    return updatedOrder;
  });

  const emailToSend = order.user?.email ?? 
    (order.notes?.match(/Guest Email: ([^\s]+)/)?.[1]) ?? 
    null;

  if (emailToSend) {
    try {
      await EmailService.sendOrderStatusUpdate(emailToSend, order.orderNumber, status);
    } catch (error) {
      console.error("Failed to queue order status update email", error);
    }
  }

  return updated;
}

export async function cancelOrder(id: string, userId: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: true } });
  if (!order || order.userId !== userId) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  if (!["PENDING", "RECEIVED"].includes(order.status)) {
    throw Object.assign(new Error("Order cannot be cancelled in its current status"), { statusCode: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });

    for (const item of order.items) {
      const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      if (inv) {
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: item.quantity } } });
      }
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          orderId: id,
          quantity: item.quantity,
          type: "RESTOCK",
          note: `Order ${order.orderNumber} cancelled`,
        },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }
  });

  const emailToSend = order.user?.email ?? 
    (order.notes?.match(/Guest Email: ([^\s]+)/)?.[1]) ?? 
    null;

  if (emailToSend) {
    try {
      await EmailService.sendOrderStatusUpdate(emailToSend, order.orderNumber, "CANCELLED");
    } catch (error) {
      console.error("Failed to queue order cancellation email", error);
    }
  }
}

export async function failOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true, user: true } });
  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  if (order.status !== "PENDING" && order.paymentStatus !== "PENDING") {
    throw Object.assign(new Error("Order cannot be marked as failed in its current status"), { statusCode: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: "FAILED", paymentStatus: "FAILED" } });

    // Restock Inventory
    for (const item of order.items) {
      const inv = await tx.inventory.findUnique({ where: { variantId: item.variantId } });
      if (inv) {
        await tx.inventory.update({ where: { id: inv.id }, data: { quantity: { increment: item.quantity } } });
      }
      await tx.inventoryLog.create({
        data: {
          variantId: item.variantId,
          orderId: id,
          quantity: item.quantity,
          type: "RESTOCK",
          note: `Payment failed for order ${order.orderNumber}`,
        },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { decrement: 1 } },
      });
    }
    
    await tx.orderLog.create({
      data: {
        orderId: id,
        action: "STATUS_UPDATE",
        toStatus: "FAILED",
        note: `Order marked as FAILED due to payment or system failure`,
      },
    });

    // RESTORE CART
    const whereClause = order.userId ? { userId: order.userId } : { sessionId: order.sessionId! };
    if (whereClause.userId || whereClause.sessionId) {
      let activeCart = await tx.cart.findFirst({
        where: { ...whereClause, status: "ACTIVE" }
      });
      if (!activeCart) {
        activeCart = await tx.cart.create({
          data: {
            userId: order.userId,
            sessionId: order.sessionId,
            status: "ACTIVE"
          }
        });
      }

      for (const item of order.items) {
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        if (!variant) continue;
        
        const existing = await tx.cartItem.findFirst({
          where: { cartId: activeCart.id, variantId: item.variantId }
        });
        
        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity }
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: activeCart.id,
              productId: variant.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.price
            }
          });
        }
      }
    }
  });

  const emailToSend = order.user?.email ?? 
    (order.notes?.match(/Guest Email: ([^\s]+)/)?.[1]) ?? 
    null;

  if (emailToSend) {
    try {
      await EmailService.sendOrderStatusUpdate(emailToSend, order.orderNumber, "FAILED");
    } catch (error) {
      console.error("Failed to queue order failure email", error);
    }
  }
}

export async function getOrderByTrackingToken(token: string) {
  const order = await prisma.order.findUnique({
    where: { trackingToken: token },
    include: {
      items: true,
      orderAddress: true,
      shipments: true,
      orderLogs: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!order) {
    throw Object.assign(new Error("Order not found"), { statusCode: 404 });
  }

  return order;
}