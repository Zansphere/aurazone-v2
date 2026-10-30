import { describe, it, expect } from "vitest";
import { hashPayload } from "./idempotency.service.js";

describe("Idempotency Service - hashPayload", () => {
  it("produces identical hashes regardless of object key insertion order", () => {
    const payloadA = {
      variantId: "var_123",
      quantity: 2,
      address: {
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
      },
    };

    const payloadB = {
      address: {
        postalCode: "400001",
        city: "Mumbai",
        state: "Maharashtra",
      },
      quantity: 2,
      variantId: "var_123",
    };

    const hashA = hashPayload(payloadA);
    const hashB = hashPayload(payloadB);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64); // SHA-256 hex string
  });

  it("produces different hashes for different payloads", () => {
    const hashA = hashPayload({ quantity: 1, variantId: "var_123" });
    const hashB = hashPayload({ quantity: 2, variantId: "var_123" });
    const hashC = hashPayload({ quantity: 1, variantId: "var_456" });

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it("handles null and undefined payloads deterministically", () => {
    const hashNull = hashPayload(null);
    const hashUndefined = hashPayload(undefined);

    expect(hashNull).toBe(hashUndefined);
    expect(hashNull).toHaveLength(64);
  });

  it("preserves array ordering while sorting object keys inside arrays", () => {
    const payload1 = {
      items: [
        { b: 2, a: 1 },
        { d: 4, c: 3 },
      ],
    };
    const payload2 = {
      items: [
        { a: 1, b: 2 },
        { c: 3, d: 4 },
      ],
    };

    expect(hashPayload(payload1)).toBe(hashPayload(payload2));

    // But swapping array positions should produce different hashes
    const payloadReversed = {
      items: [
        { c: 3, d: 4 },
        { a: 1, b: 2 },
      ],
    };
    expect(hashPayload(payload1)).not.toBe(hashPayload(payloadReversed));
  });
});

