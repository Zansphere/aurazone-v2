import { prisma, type Prisma } from "@aurazone/database";
import crypto from "crypto";

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const IN_FLIGHT_TIMEOUT_MS = 30 * 1000; // 30 seconds

export interface IdempotencyContext {
  key: string;
  scope: string;
  userId?: string;
  sessionId?: string;
  payload?: unknown;
}

export interface IdempotencyResult<T> {
  statusCode: number;
  body: T;
  isCached: boolean;
}

/**
 * Computes a deterministic SHA-256 hash of the request payload.
 */
export function hashPayload(payload: unknown): string {
  if (payload === undefined || payload === null) {
    return crypto.createHash("sha256").update("").digest("hex");
  }
  // Sort keys for deterministic JSON serialization
  const serialize = (obj: any): any => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(serialize);
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = serialize(obj[k]);
        return acc;
      }, {});
  };

  const canonicalJson = JSON.stringify(serialize(payload));
  return crypto.createHash("sha256").update(canonicalJson).digest("hex");
}

/**
 * Execute an operation with durable database idempotency.
 * Handles concurrency, duplicate detection, payload mismatch rejection, and safe replay.
 */
export async function withIdempotency<T>(
  context: IdempotencyContext,
  handler: () => Promise<{ statusCode?: number; body: T }>
): Promise<IdempotencyResult<T>> {
  const { key, scope, userId, sessionId, payload } = context;
  const compositeKey = `${scope}:${key}`;
  const requestHash = hashPayload(payload);
  const now = new Date();
  const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MS);

  // 1. Check existing record
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key: compositeKey },
  });

  if (existing) {
    // Enforce payload match invariant
    if (existing.requestHash !== requestHash) {
      throw Object.assign(
        new Error("Idempotency key reuse detected with mismatched payload"),
        { statusCode: 409 }
      );
    }

    if (existing.status === "COMPLETED") {
      return {
        statusCode: existing.responseCode ?? 200,
        body: existing.responseBody as T,
        isCached: true,
      };
    }

    if (existing.status === "PENDING") {
      const lockAge = now.getTime() - new Date(existing.lockedAt).getTime();
      if (lockAge < IN_FLIGHT_TIMEOUT_MS) {
        throw Object.assign(
          new Error("Operation currently in progress, please retry shortly"),
          { statusCode: 409 }
        );
      }
      // Re-claim stale lock
      await prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: { lockedAt: now },
      });
    }
  } else {
    // 2. Insert new PENDING record
    try {
      await prisma.idempotencyRecord.create({
        data: {
          key: compositeKey,
          scope,
          userId: userId ?? null,
          sessionId: sessionId ?? null,
          requestHash,
          status: "PENDING",
          lockedAt: now,
          expiresAt,
        },
      });
    } catch (err: any) {
      // Handle race condition: concurrent request inserted first (P2002 unique constraint)
      if (err.code === "P2002") {
        throw Object.assign(
          new Error("Concurrent operation in progress for this key, please retry"),
          { statusCode: 409 }
        );
      }
      throw err;
    }
  }

  // 3. Execute the operation
  try {
    const result = await handler();
    const statusCode = result.statusCode ?? 200;

    // 4. Save COMPLETED status with response body
    await prisma.idempotencyRecord.update({
      where: { key: compositeKey },
      data: {
        status: "COMPLETED",
        responseCode: statusCode,
        responseBody: (result.body as any) ?? {},
      },
    });

    return {
      statusCode,
      body: result.body,
      isCached: false,
    };
  } catch (executionError) {
    // 5. On failure, update to FAILED or delete so retry is permitted
    try {
      await prisma.idempotencyRecord.update({
        where: { key: compositeKey },
        data: { status: "FAILED" },
      });
    } catch {
      // Ignore cleanup error if record vanished
    }
    throw executionError;
  }
}
