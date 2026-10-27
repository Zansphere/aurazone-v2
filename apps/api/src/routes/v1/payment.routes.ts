import type { FastifyPluginAsync } from "fastify";
import { prisma, type PaymentStatus } from "@aurazone/database";
import crypto from "crypto";
import { optionalAuth } from "../../middleware/auth.js";
import { sendSuccess, sendError } from "../../middleware/response.js";
import { env } from "../../config/env.js";
import * as orderService from "../../services/order.service.js";
import { transitionOrderStatus } from "../../services/orderStateMachine.js";
import { EmailService } from "../../services/email.service.js";
import { toPaise, toRupees } from "@aurazone/utils";

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Create Razorpay order ──────────────────────────────────────────────────
  fastify.post("/create", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { orderId } = request.body as { orderId: string };
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) return sendError(reply, "Order not found", 404);

    // Verify ownership
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"] as string | undefined;
    if (userId && order.userId !== userId) return sendError(reply, "Order not found", 404);
    if (!userId && order.sessionId !== sessionId) return sendError(reply, "Order not found", 404);

    if (order.status !== "PENDING") {
      return sendError(reply, `Order cannot be paid in current status: ${order.status}`, 400);
    }
    if (order.paymentMethod !== "RAZORPAY") {
      return sendError(reply, "Order payment method is not online gateway", 400);
    }

    const amountInPaise = toPaise(order.totalAmount);

    // Idempotency: if an active PENDING payment already exists for this order, reuse it
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order.id, gateway: "RAZORPAY", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (existingPayment && existingPayment.gatewayOrderId) {
      return sendSuccess(reply, {
        razorpayOrderId: existingPayment.gatewayOrderId,
        amount: amountInPaise,
        currency: "INR",
        keyId: env.RAZORPAY_KEY_ID,
        orderNumber: order.orderNumber,
      });
    }

    // Create actual Razorpay order via API
    let gatewayOrderId: string;

    try {
      const razorpayAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
      const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${razorpayAuth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: order.orderNumber,
          notes: {
            orderId: order.id,
            orderNumber: order.orderNumber,
          },
        }),
      });

      if (!rzpResponse.ok) {
        const errorBody = await rzpResponse.text();
        console.error("[PaymentService] Razorpay order creation failed:", errorBody);
        return sendError(reply, "Failed to create payment order with gateway", 502);
      }

      const rzpOrder = (await rzpResponse.json()) as { id: string };
      gatewayOrderId = rzpOrder.id;
    } catch (err) {
      console.error("[PaymentService] Razorpay API unreachable:", err);
      return sendError(reply, "Payment gateway unavailable", 503);
    }

    // Persist discrete payment attempt in database
    await prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: "RAZORPAY",
        gatewayOrderId,
        amount: order.totalAmount,
        status: "PENDING",
      },
    });

    return sendSuccess(reply, {
      razorpayOrderId: gatewayOrderId,
      amount: amountInPaise,
      currency: "INR",
      keyId: env.RAZORPAY_KEY_ID,
      orderNumber: order.orderNumber,
    });
  });

  // ─── Client-side signature verification ─────────────────────────────────────
  fastify.post("/verify", { preHandler: [optionalAuth] }, async (request, reply) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      request.body as {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      };

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return sendError(reply, "Missing payment verification fields", 400);
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return sendError(reply, "Invalid payment signature", 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { gatewayOrderId: razorpayOrderId },
      include: { order: true },
    });
    if (!payment) return sendError(reply, "Payment record not found", 404);

    // Idempotent duplicate check: if already confirmed, return success without duplicate processing
    if (payment.status === "SUCCESS") {
      return sendSuccess(reply, { message: "Payment already verified", orderId: payment.orderId });
    }

    // Atomic confirmation transaction
    await prisma.$transaction(
      async (tx) => {
        // 1. Update Payment attempt
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            gatewayPaymentId: razorpayPaymentId,
            status: "SUCCESS",
            paidAt: new Date(),
          },
        });

        // 2. Transition Order to RECEIVED status via State Machine
        const trackingToken = payment.order.trackingToken || crypto.randomBytes(16).toString("hex");
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: "RECEIVED",
            paymentStatus: "SUCCESS",
            razorpayPaymentId,
            razorpayOrderId,
            trackingToken,
          },
        });

        // 3. Log confirmation
        await tx.paymentLog.create({
          data: {
            orderId: payment.orderId,
            paymentId: payment.id,
            orderNumberSnapshot: payment.order.orderNumber,
            action: "PAYMENT_CAPTURED",
            fromStatus: payment.status,
            toStatus: "SUCCESS",
            amount: payment.amount,
            note: `Payment verified via signature for Razorpay Payment ID ${razorpayPaymentId}`,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    // Send order confirmation / RECEIVED status update
    try {
      const email = payment.order.userId
        ? (await prisma.user.findUnique({ where: { id: payment.order.userId } }))?.email
        : payment.order.notes?.match(/Guest Email: ([^\s]+)/)?.[1];

      if (email) {
        EmailService.sendOrderStatusUpdate(email, payment.order.orderNumber, "RECEIVED").catch((e) => {
          console.error("[PaymentRoutes] Failed to send order status update email:", e);
        });
      }
    } catch (e) {
      console.error("[PaymentRoutes] Non-blocking payment email error:", e);
    }

    return sendSuccess(reply, { message: "Payment verified successfully", orderId: payment.orderId });
  });

  // ─── Razorpay Webhook (Durable Deduplication & Server-to-Server Processing) ──
  fastify.post("/webhook", {
    config: { rawBody: true },
  }, async (request, reply) => {
    const signature = request.headers["x-razorpay-signature"] as string;
    if (!signature) return sendError(reply, "Missing signature", 400);

    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      console.error("[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
      return reply.status(500).send({ status: "error", message: "Webhook secret not configured" });
    }

    // 1. Verify webhook signature using the raw body bytes
    const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
      .update(typeof rawBody === "string" ? rawBody : Buffer.from(rawBody))
      .digest("hex");

    if (expectedSignature !== signature) {
      return sendError(reply, "Invalid webhook signature", 400);
    }

    const event = request.body as {
      event: string;
      id?: string;
      payload: {
        payment?: { entity: { id: string; order_id: string; status: string; amount: number; currency: string } };
        refund?: { entity: { id: string; payment_id: string; amount: number; status: string; currency: string } };
      };
    };

    // 2. Durable deduplication: Enforce unique event ID in database
    const eventId =
      (request.headers["x-razorpay-event-id"] as string) ||
      event.id ||
      crypto.createHash("sha256").update(typeof rawBody === "string" ? rawBody : Buffer.from(rawBody)).digest("hex");

    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent && existingEvent.status === "PROCESSED") {
      // Idempotently acknowledge duplicate delivery
      return reply.status(200).send({ status: "ok", message: "Event already processed" });
    }

    // Atomically claim event record
    if (!existingEvent) {
      try {
        await prisma.webhookEvent.create({
          data: {
            provider: "RAZORPAY",
            eventId,
            eventType: event.event,
            payload: event as any,
            status: "PROCESSING",
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          return reply.status(200).send({ status: "ok", message: "Concurrent webhook in progress" });
        }
        throw err;
      }
    }

    // 3. Process the event with business integrity invariants
    try {
      switch (event.event) {
        case "payment.captured": {
          const paymentEntity = event.payload.payment?.entity;
          if (!paymentEntity) break;

          const payment = await prisma.payment.findFirst({
            where: { gatewayOrderId: paymentEntity.order_id },
            include: { order: true },
          });

          if (!payment) {
            console.warn(`[Webhook] No payment found for gateway order: ${paymentEntity.order_id}`);
            break;
          }

          // Financial Invariant: Verify amount matches order total in paise
          const orderTotalPaise = toPaise(payment.order.totalAmount);
          if (paymentEntity.amount !== orderTotalPaise) {
            console.error(
              `[Webhook] Amount mismatch! Expected ₹${toRupees(orderTotalPaise)} (${orderTotalPaise} paise), received ${paymentEntity.amount} paise.`
            );
            break;
          }

          // Financial Invariant: Handle payment success arriving after order was already CANCELLED
          if (payment.order.status === "CANCELLED") {
            console.warn(
              `[Webhook] Payment ${paymentEntity.id} captured for CANCELLED order ${payment.order.orderNumber}. Preserving payment and initiating refund.`
            );
            await prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  gatewayPaymentId: paymentEntity.id,
                  status: "SUCCESS",
                  paidAt: new Date(),
                  note: "Payment received after order cancellation. Auto-refund initiated.",
                },
              });
              await tx.paymentLog.create({
                data: {
                  orderId: payment.orderId,
                  paymentId: payment.id,
                  orderNumberSnapshot: payment.order.orderNumber,
                  action: "LATE_PAYMENT_CAPTURED",
                  fromStatus: payment.status,
                  toStatus: "SUCCESS",
                  amount: payment.amount,
                  note: "Payment succeeded after order was cancelled. Requires refund.",
                },
              });
            });

            // Automatically queue refund so customer is not charged for cancelled goods
            try {
              await orderService.initiateRefund({
                orderId: payment.orderId,
                amount: toRupees(paymentEntity.amount),
                reason: "Automatic refund: Payment captured after order cancellation",
              });
            } catch (refundErr) {
              console.error("[Webhook] Failed to auto-refund late captured payment:", refundErr);
            }
            break;
          }

          // Normal payment confirmation
          if (payment.status !== "SUCCESS") {
            await prisma.$transaction(
              async (tx) => {
                await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    gatewayPaymentId: paymentEntity.id,
                    status: "SUCCESS",
                    paidAt: new Date(),
                  },
                });

                const trackingToken = payment.order.trackingToken || crypto.randomBytes(16).toString("hex");
                await tx.order.update({
                  where: { id: payment.orderId },
                  data: {
                    status: "RECEIVED",
                    paymentStatus: "SUCCESS",
                    razorpayPaymentId: paymentEntity.id,
                    razorpayOrderId: paymentEntity.order_id,
                    trackingToken,
                  },
                });

                await tx.paymentLog.create({
                  data: {
                    orderId: payment.orderId,
                    paymentId: payment.id,
                    orderNumberSnapshot: payment.order.orderNumber,
                    action: "WEBHOOK_PAYMENT_CAPTURED",
                    fromStatus: payment.status,
                    toStatus: "SUCCESS",
                    amount: payment.amount,
                    note: `Confirmed via Razorpay webhook (Payment ID: ${paymentEntity.id})`,
                  },
                });
              },
              {
                maxWait: 10000,
                timeout: 30000,
              }
            );

            // Send order confirmation / RECEIVED status update
            try {
              const email = payment.order.userId
                ? (await prisma.user.findUnique({ where: { id: payment.order.userId } }))?.email
                : payment.order.notes?.match(/Guest Email: ([^\s]+)/)?.[1];

              if (email) {
                EmailService.sendOrderStatusUpdate(email, payment.order.orderNumber, "RECEIVED").catch((e) => {
                  console.error("[Webhook] Failed to send order status update email:", e);
                });
              }
            } catch (e) {
              console.error("[Webhook] Non-blocking payment email error:", e);
            }
          }
          break;
        }

        case "payment.failed": {
          const paymentEntity = event.payload.payment?.entity;
          if (!paymentEntity) break;

          const payment = await prisma.payment.findFirst({
            where: { gatewayOrderId: paymentEntity.order_id },
          });

          if (!payment || payment.status !== "PENDING") break;

          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              gatewayPaymentId: paymentEntity.id,
              status: "FAILED",
            },
          });

          // Trigger safe order failure and inventory recovery
          try {
            await orderService.failOrder(payment.orderId);
          } catch (e) {
            console.error("[Webhook] Failed to process failOrder:", e);
          }
          break;
        }

        case "refund.created":
        case "refund.processed": {
          const refundEntity = event.payload.refund?.entity;
          if (!refundEntity) break;

          const payment = await prisma.payment.findFirst({
            where: { gatewayPaymentId: refundEntity.payment_id },
            include: { order: true },
          });

          if (!payment) break;

          // Check if Refund record already exists by gatewayRefundId
          const existingRefund = await prisma.refund.findUnique({
            where: { gatewayRefundId: refundEntity.id },
          });

          const refundStatus = refundEntity.status === "processed" ? "SUCCEEDED" : "PENDING";
          const refundAmount = toRupees(refundEntity.amount);

          if (!existingRefund) {
            await prisma.$transaction(async (tx) => {
              const newRef = await tx.refund.create({
                data: {
                  orderId: payment.orderId,
                  paymentId: payment.id,
                  amount: refundAmount,
                  currency: refundEntity.currency || "INR",
                  status: refundStatus,
                  gatewayRefundId: refundEntity.id,
                  reason: `Provider webhook ${event.event}`,
                  processedAt: refundEntity.status === "processed" ? new Date() : null,
                },
              });

              await tx.refundLog.create({
                data: {
                  refundId: newRef.id,
                  toStatus: refundStatus,
                  actorId: "RAZORPAY_WEBHOOK",
                  note: `Webhook received: ${event.event}`,
                },
              });

              await tx.order.update({
                where: { id: payment.orderId },
                data: { paymentStatus: "REFUNDED" },
              });
            });
          } else if (existingRefund.status !== "SUCCEEDED" && refundStatus === "SUCCEEDED") {
            await prisma.refund.update({
              where: { id: existingRefund.id },
              data: { status: "SUCCEEDED", processedAt: new Date() },
            });
          }
          break;
        }
      }

      // Mark webhook event as durably PROCESSED
      await prisma.webhookEvent.update({
        where: { eventId },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
    } catch (err: any) {
      console.error(`[Webhook] Error processing event ${eventId}:`, err);
      await prisma.webhookEvent.update({
        where: { eventId },
        data: {
          status: "FAILED",
          lastError: err?.message || String(err),
        },
      });
    }

    // Always return 200 to Razorpay to prevent unnecessary retry floods
    return reply.status(200).send({ status: "ok" });
  });
};

export default paymentRoutes;