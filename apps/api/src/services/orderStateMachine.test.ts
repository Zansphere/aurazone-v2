import { describe, it, expect } from "vitest";
import {
  ALLOWED_ORDER_TRANSITIONS,
  isValidOrderTransition,
  getAvailableNextStatuses,
  OrderTransitionError,
} from "./orderStateMachine.js";
import type { OrderStatus } from "@aurazone/database";

describe("Order State Machine - Transition Legality", () => {
  it("allows legal forward transitions for normal fulfillment flow", () => {
    // PENDING -> RECEIVED
    expect(isValidOrderTransition("PENDING", "RECEIVED")).toBe(true);
    // RECEIVED -> SHIPPED
    expect(isValidOrderTransition("RECEIVED", "SHIPPED")).toBe(true);
    // SHIPPED -> DELIVERED
    expect(isValidOrderTransition("SHIPPED", "DELIVERED")).toBe(true);
    // DELIVERED -> SUCCESS
    expect(isValidOrderTransition("DELIVERED", "SUCCESS")).toBe(true);
  });

  it("allows legal cancellation and failure from PENDING", () => {
    expect(isValidOrderTransition("PENDING", "CANCELLED")).toBe(true);
    expect(isValidOrderTransition("PENDING", "FAILED")).toBe(true);
  });

  it("allows cancellation from RECEIVED and SHIPPED", () => {
    expect(isValidOrderTransition("RECEIVED", "CANCELLED")).toBe(true);
    expect(isValidOrderTransition("SHIPPED", "CANCELLED")).toBe(true);
  });

  it("is idempotent when transitioning from a state to itself", () => {
    const allStatuses: OrderStatus[] = [
      "PENDING",
      "RECEIVED",
      "SHIPPED",
      "DELIVERED",
      "SUCCESS",
      "CANCELLED",
      "FAILED",
    ];
    for (const status of allStatuses) {
      expect(isValidOrderTransition(status, status)).toBe(true);
    }
  });

  it("strictly forbids backwards or invalid skipping transitions", () => {
    // Cannot skip RECEIVED
    expect(isValidOrderTransition("PENDING", "SHIPPED")).toBe(false);
    expect(isValidOrderTransition("PENDING", "DELIVERED")).toBe(false);
    expect(isValidOrderTransition("PENDING", "SUCCESS")).toBe(false);

    // Cannot regress backward
    expect(isValidOrderTransition("RECEIVED", "PENDING")).toBe(false);
    expect(isValidOrderTransition("SHIPPED", "RECEIVED")).toBe(false);
    expect(isValidOrderTransition("DELIVERED", "SHIPPED")).toBe(false);
  });

  it("strictly forbids transitions from terminal states", () => {
    // SUCCESS is terminal
    expect(isValidOrderTransition("SUCCESS", "PENDING")).toBe(false);
    expect(isValidOrderTransition("SUCCESS", "CANCELLED")).toBe(false);
    expect(getAvailableNextStatuses("SUCCESS")).toEqual([]);

    // CANCELLED is terminal
    expect(isValidOrderTransition("CANCELLED", "PENDING")).toBe(false);
    expect(isValidOrderTransition("CANCELLED", "RECEIVED")).toBe(false);
    expect(getAvailableNextStatuses("CANCELLED")).toEqual([]);

    // FAILED is terminal
    expect(isValidOrderTransition("FAILED", "PENDING")).toBe(false);
    expect(isValidOrderTransition("FAILED", "RECEIVED")).toBe(false);
    expect(getAvailableNextStatuses("FAILED")).toEqual([]);
  });

  it("OrderTransitionError contains correct status codes and transition details", () => {
    const error = new OrderTransitionError("Cannot ship unpaid order", "PENDING", "SHIPPED", 400);
    expect(error.statusCode).toBe(400);
    expect(error.fromStatus).toBe("PENDING");
    expect(error.toStatus).toBe("SHIPPED");
    expect(error.name).toBe("OrderTransitionError");
  });
});

