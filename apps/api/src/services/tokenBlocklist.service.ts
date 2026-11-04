import type { Redis } from "ioredis";

// In-memory fallback map: token -> expiration timestamp (ms)
const inMemoryRevokedTokens = new Map<string, number>();

// Clean up expired tokens every minute to prevent memory leak
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of inMemoryRevokedTokens.entries()) {
    if (expiry <= now) {
      inMemoryRevokedTokens.delete(token);
    }
  }
}, 60000);

// Don't keep Node process alive just for the cleanup interval in tests
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Revoke an access token until its natural expiration.
 */
export async function revokeToken(
  token: string,
  expiresInSeconds = 900,
  redis?: Redis | null
): Promise<void> {
  if (!token) return;

  const expiryTimestamp = Date.now() + Math.max(1, expiresInSeconds) * 1000;
  inMemoryRevokedTokens.set(token, expiryTimestamp);

  if (redis && redis.status === "ready") {
    try {
      await redis.set(`revoked_token:${token}`, "1", "EX", Math.max(1, expiresInSeconds));
    } catch {
      // Non-critical: in-memory revocation still active
    }
  }
}

/**
 * Check if a token has been revoked.
 */
export async function isTokenRevoked(
  token: string,
  redis?: Redis | null
): Promise<boolean> {
  if (!token) return false;

  // 1. Check in-memory store
  const expiry = inMemoryRevokedTokens.get(token);
  if (expiry) {
    if (expiry > Date.now()) {
      return true;
    }
    inMemoryRevokedTokens.delete(token);
  }

  // 2. Check Redis store
  if (redis && redis.status === "ready") {
    try {
      const exists = await redis.get(`revoked_token:${token}`);
      return Boolean(exists);
    } catch {
      return false;
    }
  }

  return false;
}

