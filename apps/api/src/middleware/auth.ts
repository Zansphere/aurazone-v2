import type { FastifyReply, FastifyRequest } from "fastify";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendError } from "./response.js";
import type { Role } from "@aurazone/database";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

/**
 * Extract and verify JWT from cookies or Authorization header.
 * Attaches `request.user` on success.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token =
    request.cookies?.access_token ??
    request.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return sendError(reply, "Authentication required", 401);
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? "Token expired"
        : "Invalid token";
    return sendError(reply, message, 401);
  }

  try {
    const { prisma } = await import("@aurazone/database");
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });
    if (!user || user.email?.startsWith("deleted_")) {
      return sendError(reply, "User account not found or deleted", 401);
    }
    request.user = payload;
  } catch {
    if (reply.sent) return;
    return sendError(reply, "Authentication failed", 401);
  }
}

/**
 * Factory: require one of the given roles.
 * Must be used AFTER `authenticate`.
 */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return sendError(reply, "Authentication required", 401);
    }
    if (!roles.includes(request.user.role)) {
      return sendError(reply, "Insufficient permissions", 403);
    }
  };
}

/**
 * Returns the list of storeIds a STORE_MANAGER is assigned to.
 * Returns null for SUPER_ADMIN (meaning "all stores").
 */
export async function getManagerStoreIds(userId: string, role: Role): Promise<string[] | null> {
  if (role === "SUPER_ADMIN") return null; // unrestricted
  const { prisma } = await import("@aurazone/database");
  const assignments = await prisma.storeManager.findMany({
    where: { userId },
    select: { storeId: true },
  });
  return assignments.map((a) => a.storeId);
}

/**
 * Middleware factory: verifies the requesting STORE_MANAGER is assigned
 * to the store identified by `storeId` in params, query, or body.
 * SUPER_ADMIN always passes.
 */
export function requireStoreAccess(storeIdSource: "params" | "query" | "body" = "params", paramName = "storeId") {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) return sendError(reply, "Authentication required", 401);
    if (request.user.role === "SUPER_ADMIN") return; // bypass

    const source =
      storeIdSource === "params" ? (request.params as any) :
        storeIdSource === "query" ? (request.query as any) :
          (request.body as any);

    const storeId = source?.[paramName];
    if (!storeId) return; // no storeId to check — downstream will handle

    const allowed = await getManagerStoreIds(request.user.userId, request.user.role);
    if (allowed && !allowed.includes(storeId)) {
      return sendError(reply, "You do not have access to this store", 403);
    }
  };
}

/**
 * Utility: assert that the given storeId is within the user's allowed stores.
 * Throws 403 if not. Returns immediately for SUPER_ADMIN.
 * Usage: `await assertStoreAccess(request.user!, storeId);`
 */
export async function assertStoreAccess(user: JwtPayload, storeId: string | null | undefined): Promise<void> {
  if (user.role === "SUPER_ADMIN") return;
  // STORE_MANAGER accessing a resource with no storeId should be blocked
  // (global resources are SUPER_ADMIN only)
  if (!storeId) {
    if (user.role === "STORE_MANAGER") {
      throw Object.assign(new Error("Store managers cannot access global resources"), { statusCode: 403 });
    }
    return;
  }
  const allowed = await getManagerStoreIds(user.userId, user.role);
  if (allowed && !allowed.includes(storeId)) {
    throw Object.assign(new Error("You do not have access to this store"), { statusCode: 403 });
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block.
 */
export async function optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies?.access_token ??
    request.headers.authorization?.replace("Bearer ", "");

  if (!token) return;

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (err) {
    const message = err instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token";
    return sendError(reply, message, 401);
  }

  try {
    const { prisma } = await import("@aurazone/database");
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });
    if (!user || user.email?.startsWith("deleted_")) {
      return sendError(reply, "User account not found or deleted", 401);
    }
    request.user = payload;
  } catch {
    if (reply.sent) return;
    return sendError(reply, "Authentication failed", 401);
  }
}

/**
 * Generate access + refresh tokens for a user.
 */
export function generateTokens(payload: Omit<JwtPayload, "iat" | "exp">) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: 900, // 15 minutes
  });

  const refreshToken = jwt.sign(
    { ...payload, type: "refresh" },
    env.JWT_SECRET,
    { expiresIn: 604800 } // 7 days
  );

  return { accessToken, refreshToken };
}

/**
 * Set auth cookies on a reply.
 */
export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
): void {
  const cookieDomain = env.COOKIE_DOMAIN === "localhost" ? undefined : env.COOKIE_DOMAIN;
  const sameSite = env.NODE_ENV === "production" ? "none" : "lax";

  reply.setCookie("access_token", accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: "/",
    domain: cookieDomain,
    maxAge: 15 * 60, // 15 minutes
  });

  reply.setCookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite,
    path: "/api/v1/auth",
    domain: cookieDomain,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/**
 * Clear auth cookies.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  const cookieDomain = env.COOKIE_DOMAIN === "localhost" ? undefined : env.COOKIE_DOMAIN;
  reply.clearCookie("access_token", { path: "/", domain: cookieDomain });
  reply.clearCookie("refresh_token", { path: "/api/v1/auth", domain: cookieDomain });
  // Also clear the old path so legacy cookies don't cause infinite 401 loops
  reply.clearCookie("refresh_token", { path: "/api/v1/auth/refresh", domain: cookieDomain });
}