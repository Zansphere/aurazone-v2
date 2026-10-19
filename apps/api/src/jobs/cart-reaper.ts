import { prisma } from "@aurazone/database";

const REAPER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let reaperTimer: NodeJS.Timeout | null = null;

/**
 * Cart reaper — safely finds and releases expired InventoryReservation records.
 *
 * Concurrency & Integrity Invariants:
 * 1. Only reaps reservations in ACTIVE status.
 * 2. Never reaps reservations for carts that have already been converted to an order (status = ORDERED).
 * 3. Atomic state transition: ACTIVE → EXPIRED. If another replica processes it simultaneously,
 *    the update count is 0 and it skips safely.
 * 4. Records balanceAfter and reservedAfter in append-only InventoryLog.
 */
export async function runCartReaper() {
  try {
    const now = new Date();

    // Find all expired ACTIVE reservations for carts that are still ACTIVE
    const expiredReservations = await prisma.inventoryReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
        cartItem: {
          cart: {
            status: "ACTIVE",
          },
        },
      },
      include: {
        cartItem: { include: { cart: true } },
      },
    });

    if (expiredReservations.length === 0) return;

    console.log(`[CartReaper] Found ${expiredReservations.length} expired reservations to release.`);

    const affectedCartIds = new Set<string>();

    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Atomically claim the expired reservation: ACTIVE → EXPIRED
          const claimed = await tx.inventoryReservation.updateMany({
            where: {
              id: reservation.id,
              status: "ACTIVE",
            },
            data: {
              status: "EXPIRED",
            },
          });

          if (claimed.count === 0) return; // Already claimed/released by another worker

          // Release the reserved count
          const result: Array<{ quantity: number; reserved: number }> = await tx.$queryRaw`
            UPDATE "Inventory"
            SET reserved = GREATEST(reserved - ${reservation.quantity}, 0)
            WHERE variant_id = ${reservation.variantId}
            RETURNING quantity, reserved
          `;

          const currentInv = result[0] ?? { quantity: 0, reserved: 0 };

          await tx.inventoryLog.create({
            data: {
              variantId: reservation.variantId,
              quantity: -reservation.quantity,
              balanceAfter: currentInv.quantity,
              reservedAfter: currentInv.reserved,
              type: "RELEASE",
              note: `Cart reaper expired reservation for cart item ${reservation.cartItemId}`,
              correlationId: reservation.cartItemId,
            },
          });
        });

        affectedCartIds.add(reservation.cartItem.cartId);
      } catch (err) {
        console.error(`[CartReaper] Failed to release reservation ${reservation.id}:`, err);
      }
    }

    // Mark affected carts as ABANDONED if they have no remaining active reservations
    for (const cartId of affectedCartIds) {
      const remainingActive = await prisma.inventoryReservation.count({
        where: {
          cartItem: { cartId },
          status: "ACTIVE",
        },
      });

      if (remainingActive === 0) {
        await prisma.cart.updateMany({
          where: { id: cartId, status: "ACTIVE" },
          data: { status: "ABANDONED" },
        });
      }
    }

    console.log(`[CartReaper] Successfully processed ${expiredReservations.length} reservations.`);
  } catch (error) {
    console.error("[CartReaper] Error running cart reaper:", error);
  }
}

export function startCartReaper() {
  if (reaperTimer) return;
  runCartReaper();
  reaperTimer = setInterval(runCartReaper, REAPER_INTERVAL_MS);
  console.log(`[CartReaper] Started with interval ${REAPER_INTERVAL_MS}ms`);
}

export function stopCartReaper() {
  if (reaperTimer) {
    clearInterval(reaperTimer);
    reaperTimer = null;
    console.log("[CartReaper] Stopped");
  }
}
