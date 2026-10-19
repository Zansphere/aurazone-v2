import { prisma, type InventoryLogType, type Prisma, type ReservationStatus } from "@aurazone/database";

const RESERVATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Hold inventory for a cart item.
 * Uses atomic conditional update `quantity - reserved >= qty` and verifies row count.
 * Records state in InventoryReservation (status: ACTIVE) and append-only InventoryLog.
 */
export async function holdInventory(
  variantId: string,
  quantity: string | number,
  cartItemId: string,
  note?: string,
  actorId?: string,
  externalTx?: Prisma.TransactionClient
) {
  const qty = Math.max(1, Math.floor(Number(quantity)));
  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

  const run = async (tx: Prisma.TransactionClient) => {
    // 1. Check existing reservation for this cart item
    const existing = await tx.inventoryReservation.findUnique({
      where: { cartItemId },
    });

    let currentInv: { quantity: number; reserved: number } | null = null;

    if (existing && existing.status === "ACTIVE") {
      // Extending an existing active reservation (additional quantity delta)
      const delta = qty;
      const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
        UPDATE "Inventory"
        SET reserved = reserved + ${delta}
        WHERE variant_id = ${variantId} AND (quantity - reserved) >= ${delta}
        RETURNING quantity, reserved
      `;

      if (!result || result.length === 0) {
        throw Object.assign(new Error("Insufficient stock available for hold"), { statusCode: 400 });
      }
      currentInv = result[0];

      await tx.inventoryReservation.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + delta,
          expiresAt,
        },
      });
    } else {
      // New reservation or re-activating previous
      const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
        UPDATE "Inventory"
        SET reserved = reserved + ${qty}
        WHERE variant_id = ${variantId} AND (quantity - reserved) >= ${qty}
        RETURNING quantity, reserved
      `;

      if (!result || result.length === 0) {
        throw Object.assign(new Error("Insufficient stock available for hold"), { statusCode: 400 });
      }
      currentInv = result[0];

      if (existing) {
        await tx.inventoryReservation.update({
          where: { id: existing.id },
          data: {
            variantId,
            quantity: qty,
            status: "ACTIVE",
            expiresAt,
          },
        });
      } else {
        await tx.inventoryReservation.create({
          data: {
            variantId,
            cartItemId,
            quantity: qty,
            status: "ACTIVE",
            expiresAt,
          },
        });
      }
    }

    // 2. Append-only movement ledger
    await tx.inventoryLog.create({
      data: {
        variantId,
        quantity: qty,
        balanceAfter: currentInv.quantity,
        reservedAfter: currentInv.reserved,
        type: "HOLD",
        performedBy: actorId ?? null,
        note: note ?? `Cart reservation for item ${cartItemId}`,
        correlationId: cartItemId,
      },
    });

    return currentInv;
  };

  return externalTx ? run(externalTx) : prisma.$transaction(run);
}

/**
 * Release a specific cart item's reservation.
 * Idempotent: safe against duplicate release requests.
 */
export async function releaseInventory(
  variantId: string,
  quantity: string | number,
  cartItemId: string,
  note?: string,
  actorId?: string,
  externalTx?: Prisma.TransactionClient
) {
  const qty = Math.max(1, Math.floor(Number(quantity)));

  const run = async (tx: Prisma.TransactionClient) => {
    const reservation = await tx.inventoryReservation.findUnique({
      where: { cartItemId },
    });

    // If reservation doesn't exist or is not active, nothing to release
    if (!reservation || reservation.status !== "ACTIVE") {
      return;
    }

    const releaseQty = Math.min(qty, reservation.quantity);
    if (releaseQty <= 0) return;

    const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
      UPDATE "Inventory"
      SET reserved = GREATEST(reserved - ${releaseQty}, 0)
      WHERE variant_id = ${variantId}
      RETURNING quantity, reserved
    `;

    const remainingQty = reservation.quantity - releaseQty;
    if (remainingQty <= 0) {
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { quantity: 0, status: "RELEASED" },
      });
    } else {
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { quantity: remainingQty },
      });
    }

    const currentInv = result[0] ?? { quantity: 0, reserved: 0 };

    await tx.inventoryLog.create({
      data: {
        variantId,
        quantity: -releaseQty,
        balanceAfter: currentInv.quantity,
        reservedAfter: currentInv.reserved,
        type: "RELEASE",
        performedBy: actorId ?? null,
        note: note ?? `Released hold for cart item ${cartItemId}`,
        correlationId: cartItemId,
      },
    });
  };

  return externalTx ? run(externalTx) : prisma.$transaction(run);
}

/**
 * Commit inventory for an order: converts soft holds into hard sales.
 * Enforces DETERMINISTIC LOCKING ORDER (sorted by variantId) to prevent deadlocks across concurrent multi-item checkouts.
 */
export async function commitOrderInventory(
  orderId: string,
  orderNumber: string,
  items: Array<{ variantId: string; quantity: number; cartItemId?: string }>,
  tx: Prisma.TransactionClient,
  actorId?: string
) {
  // CRITICAL: Sort items by variantId to prevent database deadlock
  const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));

  for (const item of sortedItems) {
    const qty = item.quantity;

    // Check if an active reservation exists for this cart item
    let reservedRelease = 0;
    let reservation = null;

    if (item.cartItemId) {
      reservation = await tx.inventoryReservation.findUnique({
        where: { cartItemId: item.cartItemId },
      });
      if (reservation && reservation.status === "ACTIVE") {
        reservedRelease = Math.min(qty, reservation.quantity);
      }
    }

    // Atomic conditional decrement of physical quantity and reserved counter
    const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
      UPDATE "Inventory"
      SET quantity = quantity - ${qty},
          reserved = GREATEST(reserved - ${reservedRelease}, 0)
      WHERE variant_id = ${item.variantId} AND quantity >= ${qty}
      RETURNING quantity, reserved
    `;

    if (!result || result.length === 0) {
      throw Object.assign(
        new Error(`Insufficient physical stock to fulfill item variant ${item.variantId}`),
        { statusCode: 409 }
      );
    }

    const currentInv = result[0];

    // Transition reservation state to CONSUMED
    if (reservation) {
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          status: "CONSUMED",
          orderId,
        },
      });
    }

    // Append-only movement ledger
    await tx.inventoryLog.create({
      data: {
        variantId: item.variantId,
        orderId,
        quantity: -qty,
        balanceAfter: currentInv.quantity,
        reservedAfter: currentInv.reserved,
        type: "SOLD",
        performedBy: actorId ?? null,
        note: `Committed for order ${orderNumber}`,
        correlationId: orderId,
      },
    });
  }
}

/**
 * Restocks inventory with full movement ledger logging.
 */
export async function restockInventory(
  variantId: string,
  quantity: string | number,
  orderId?: string,
  note?: string,
  actorId?: string,
  externalTx?: Prisma.TransactionClient
) {
  const qty = Math.max(1, Math.floor(Number(quantity)));

  const run = async (tx: Prisma.TransactionClient) => {
    const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
      UPDATE "Inventory"
      SET quantity = quantity + ${qty}
      WHERE variant_id = ${variantId}
      RETURNING quantity, reserved
    `;

    if (!result || result.length === 0) return null;
    const currentInv = result[0];

    await tx.inventoryLog.create({
      data: {
        variantId,
        orderId: orderId ?? null,
        quantity: qty,
        balanceAfter: currentInv.quantity,
        reservedAfter: currentInv.reserved,
        type: "RESTOCK",
        performedBy: actorId ?? null,
        note: note ?? `Stock restored`,
        correlationId: orderId ?? undefined,
      },
    });

    return currentInv;
  };

  return externalTx ? run(externalTx) : prisma.$transaction(run);
}
