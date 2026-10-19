import { prisma, type OrderStatus, type PaymentStatus, type Prisma } from "@aurazone/database";
import crypto from "crypto";
import { EmailService } from "./email.service.js";

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["RECEIVED", "CANCELLED", "FAILED"],
  RECEIVED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["SUCCESS"],
  SUCCESS: [],
  CANCELLED: [],
  FAILED: [],
};

export interface TransitionOrderOptions {
  orderId: string;
  toStatus: OrderStatus;
  actorId?: string; // adminId or userId or "SYSTEM"
  reason?: string;
  metadata?: Record<string, any>;
  tx?: Prisma.TransactionClient;
}

export class OrderTransitionError extends Error {
  statusCode: number;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;

  constructor(message: string, fromStatus: OrderStatus, toStatus: OrderStatus, statusCode = 400) {
    super(message);
    this.name = "OrderTransitionError";
    this.statusCode = statusCode;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
  }
}

/**
 * Checks if a transition from fromStatus to toStatus is valid according to business rules.
 */
export function isValidOrderTransition(fromStatus: OrderStatus, toStatus: OrderStatus): boolean {
  if (fromStatus === toStatus) return true; // Idempotent
  const allowed = ALLOWED_ORDER_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Get list of valid next statuses for an order.
 */
export function getAvailableNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];
}

/**
 * Transitions an order to a new status with complete database integrity,
 * row-level locking, compensating transactions (restock on cancellation),
 * and immutable audit logging.
 */
export async function transitionOrderStatus(options: TransitionOrderOptions) {
  const { orderId, toStatus, actorId, reason, metadata } = options;

  const executeTransition = async (tx: Prisma.TransactionClient) => {
    // 1. Fetch current order with row-level lock (or fresh read inside transaction)
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: true,
        payments: true,
      },
    });

    if (!order) {
      throw Object.assign(new Error("Order not found"), { statusCode: 404 });
    }

    const fromStatus = order.status;

    // 2. Idempotency check: if already in the target status, return cleanly without duplicating side effects
    if (fromStatus === toStatus) {
      return { order, transitioned: false };
    }

    // 3. Central validation of transition legality
    if (!isValidOrderTransition(fromStatus, toStatus)) {
      throw new OrderTransitionError(
        `Illegal order status transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${ALLOWED_ORDER_TRANSITIONS[fromStatus]?.join(", ") || "none (terminal state)"}`,
        fromStatus,
        toStatus,
        400
      );
    }

    // 4. Invariant checks for specific target states
    if (toStatus === "SHIPPED") {
      if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "SUCCESS") {
        throw new OrderTransitionError(
          "Cannot ship an online order that has not been successfully paid",
          fromStatus,
          toStatus,
          400
        );
      }
    }

    // 5. Compensating actions for CANCELLED
    if (toStatus === "CANCELLED") {
      // Restock inventory for all items
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
              orderId: order.id,
              quantity: item.quantity,
              balanceAfter: updated.quantity,
              reservedAfter: updated.reserved,
              type: "RESTOCK",
              performedBy: actorId,
              note: `Restocked on order ${order.orderNumber} cancellation: ${reason ?? "No reason specified"}`,
              correlationId: order.id,
            },
          });
        }
      }

      // Restore coupon usage count
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }
    }

    // 6. Update order status in DB (and assign tracking token upon entering RECEIVED if not already set)
    const updateData: Prisma.OrderUpdateInput = { status: toStatus };
    if (toStatus === "RECEIVED" && !order.trackingToken) {
      updateData.trackingToken = crypto.randomBytes(16).toString("hex");
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: updateData,
      include: { user: true, items: true, payments: true, orderAddress: true },
    });

    // 7. Write immutable audit log in OrderLog
    await tx.orderLog.create({
      data: {
        orderId: order.id,
        orderNumberSnapshot: order.orderNumber,
        adminId: actorId && actorId !== "SYSTEM" ? actorId : null,
        action: "STATUS_TRANSITION",
        fromStatus,
        toStatus,
        note: reason ?? `Status changed from ${fromStatus} to ${toStatus}`,
        metadata: {
          ...metadata,
          transitionTimestamp: new Date().toISOString(),
          actor: actorId ?? "SYSTEM",
        },
      },
    });

    return { order: updatedOrder, transitioned: true, previousStatus: fromStatus };
  };

  // Run in provided transaction or create new atomic transaction
  const result = options.tx
    ? await executeTransition(options.tx)
    : await prisma.$transaction(executeTransition);

  // 8. External side effects OUTSIDE the database transaction (as per Principle 1)
  if (result.transitioned) {
    const email = result.order.user?.email ?? 
      result.order.notes?.match(/Guest Email: ([^\s]+)/)?.[1] ?? 
      null;

    if (email) {
      try {
        await EmailService.sendOrderStatusUpdate(email, result.order.orderNumber, toStatus);
      } catch (err) {
        console.error(`[OrderStateMachine] Non-blocking email error for order ${result.order.orderNumber}:`, err);
      }
    }
  }

  return result.order;
}
