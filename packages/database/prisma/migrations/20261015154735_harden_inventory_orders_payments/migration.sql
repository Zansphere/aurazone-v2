-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'VALIDATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REJECTED');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN     "balance_after" INTEGER,
ADD COLUMN     "correlation_id" TEXT,
ADD COLUMN     "reserved_after" INTEGER;

-- AlterTable
ALTER TABLE "InventoryReservation" ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" VARCHAR(50) NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "request_hash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "response_code" INTEGER,
    "response_body" JSONB,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentGateway" NOT NULL DEFAULT 'RAZORPAY',
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'RAZORPAY',
    "gateway_refund_id" TEXT,
    "idempotency_key" TEXT,
    "admin_id" TEXT,
    "metadata" JSONB,
    "failure_reason" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundLog" (
    "id" TEXT NOT NULL,
    "refund_id" TEXT NOT NULL,
    "from_status" "RefundStatus",
    "to_status" "RefundStatus" NOT NULL,
    "actor_id" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_key_idx" ON "IdempotencyRecord"("key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_scope_user_id_idx" ON "IdempotencyRecord"("scope", "user_id");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_scope_session_id_idx" ON "IdempotencyRecord"("scope", "session_id");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expires_at_idx" ON "IdempotencyRecord"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_event_id_key" ON "WebhookEvent"("event_id");

-- CreateIndex
CREATE INDEX "WebhookEvent_event_id_idx" ON "WebhookEvent"("event_id");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_status_idx" ON "WebhookEvent"("provider", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_created_at_idx" ON "WebhookEvent"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gateway_refund_id_key" ON "Refund"("gateway_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotency_key_key" ON "Refund"("idempotency_key");

-- CreateIndex
CREATE INDEX "Refund_order_id_idx" ON "Refund"("order_id");

-- CreateIndex
CREATE INDEX "Refund_payment_id_idx" ON "Refund"("payment_id");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_gateway_refund_id_idx" ON "Refund"("gateway_refund_id");

-- CreateIndex
CREATE INDEX "RefundLog_refund_id_idx" ON "RefundLog"("refund_id");

-- CreateIndex
CREATE INDEX "InventoryLog_correlation_id_idx" ON "InventoryLog"("correlation_id");

-- CreateIndex
CREATE INDEX "InventoryReservation_status_idx" ON "InventoryReservation"("status");

-- CreateIndex
CREATE INDEX "InventoryReservation_order_id_idx" ON "InventoryReservation"("order_id");

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLog" ADD CONSTRAINT "RefundLog_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Database-Enforced Check Constraints ─────────────────────────────────────────

-- 1. Prevent negative physical stock
ALTER TABLE "Inventory" ADD CONSTRAINT "chk_inventory_quantity_non_negative" CHECK ("quantity" >= 0);

-- 2. Prevent negative reserved stock
ALTER TABLE "Inventory" ADD CONSTRAINT "chk_inventory_reserved_non_negative" CHECK ("reserved" >= 0);

-- 3. Prevent over-reservation (sellable stock cannot be negative)
ALTER TABLE "Inventory" ADD CONSTRAINT "chk_inventory_sellable_non_negative" CHECK ("quantity" >= "reserved");

-- 4. Order Item quantities must be strictly positive
ALTER TABLE "OrderItem" ADD CONSTRAINT "chk_order_item_quantity_positive" CHECK ("quantity" > 0);

-- 5. Order monetary totals must be non-negative
ALTER TABLE "Order" ADD CONSTRAINT "chk_order_total_non_negative" CHECK ("total_amount" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "chk_order_discount_non_negative" CHECK ("discount_amount" >= 0);

-- 6. Payment amounts must be non-negative
ALTER TABLE "Payment" ADD CONSTRAINT "chk_payment_amount_non_negative" CHECK ("amount" >= 0);

-- 7. Refund amounts must be strictly positive
ALTER TABLE "Refund" ADD CONSTRAINT "chk_refund_amount_positive" CHECK ("amount" > 0);
