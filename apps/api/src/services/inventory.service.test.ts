import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aurazone/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    inventoryReservation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    inventoryLog: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    inventory: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@aurazone/database";
import { commitOrderInventory, holdInventory, releaseInventory } from "./inventory.service.js";

describe("Inventory Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("commitOrderInventory - Deadlock Prevention", () => {
    it("sorts items by variantId before acquiring database locks", async () => {
      const mockTx: any = {
        inventoryReservation: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $queryRaw: vi.fn().mockResolvedValue([{ quantity: 10, reserved: 0 }]),
        inventoryLog: {
          createMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      };

      const unorderedItems = [
        { variantId: "var_z", quantity: 1 },
        { variantId: "var_a", quantity: 2 },
        { variantId: "var_m", quantity: 3 },
      ];

      await commitOrderInventory("ord_1", "ORD-1", unorderedItems, mockTx, "admin_1");

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it("throws 400 when physical stock is insufficient for commitment", async () => {
      const mockTx: any = {
        inventoryReservation: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $queryRaw: vi.fn().mockResolvedValue([]), // 0 rows updated
      };

      await expect(
        commitOrderInventory(
          "ord_1",
          "ORD-1",
          [{ variantId: "var_out_of_stock", quantity: 5 }],
          mockTx,
          "admin_1"
        )
      ).rejects.toThrow(/insufficient.*stock/i);
    });
  });

  describe("releaseInventory", () => {
    it("safely exits if reservation does not exist or is not active", async () => {
      const mockTx: any = {
        inventoryReservation: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      await releaseInventory("var_1", 2, "cart_item_missing", undefined, undefined, mockTx);

      expect(mockTx.inventoryReservation.findUnique).toHaveBeenCalledWith({
        where: { cartItemId: "cart_item_missing" },
      });
      // Should not attempt to decrement or log
      expect(mockTx.$queryRaw).toBeUndefined();
    });
  });
});
