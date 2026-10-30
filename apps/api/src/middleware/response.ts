import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ─── Prisma error code → safe user message mapping ────────────────────────
const PRISMA_ERROR_MAP: Record<string, { message: string; status: number }> = {
  P2002: { message: "A record with this value already exists", status: 409 },
  P2003: { message: "Referenced record not found", status: 400 },
  P2025: { message: "Record not found", status: 404 },
  P2014: { message: "This operation would violate a required relation", status: 400 },
  P2016: { message: "Record not found", status: 404 },
  P2021: { message: "Resource not available", status: 500 },
  P2024: { message: "Request timed out, please try again", status: 503 },
};

/**
 * Sanitizes an error before it reaches the client.
 * - Business errors (errors with explicit statusCode) pass through unchanged.
 * - Zod validation errors return clean 400 with the specific issue.
 * - JWT auth errors return clean 401.
 * - Fastify bad request errors (like JSON parse errors) return 400.
 * - Prisma errors are mapped to safe, generic messages.
 * - Unknown 500-level errors are replaced with a generic message.
 */
export function sanitizeError(err: unknown): { message: string; statusCode: number } {
  if (!err) {
    return { message: "An unexpected error occurred", statusCode: 500 };
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const firstIssue = err.errors[0];
    const field = firstIssue?.path?.length ? `${firstIssue.path.join(".")}: ` : "";
    const message = firstIssue ? `${field}${firstIssue.message}` : "Validation error";
    return { message, statusCode: 400 };
  }

  // JWT errors
  if (err instanceof jwt.TokenExpiredError) {
    return { message: "Token expired", statusCode: 401 };
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return { message: "Invalid token", statusCode: 401 };
  }

  const error = err as Error & { statusCode?: number; code?: string; meta?: any };

  // Business errors thrown with Object.assign(new Error(...), { statusCode })
  if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
    return { message: error.message || "Bad request", statusCode: error.statusCode };
  }

  // Fastify body parse errors (e.g. FST_ERR_CTP_INVALID_MEDIA_TYPE, SyntaxError in JSON body)
  if (error.name === "SyntaxError" || error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return { message: error.message || "Invalid request body", statusCode: 400 };
  }

  // Prisma client known errors (PrismaClientKnownRequestError)
  if (error.code && PRISMA_ERROR_MAP[error.code]) {
    const mapped = PRISMA_ERROR_MAP[error.code];
    console.error(`[PRISMA ${error.code}]`, error.message, error.meta ?? "");
    return { message: mapped.message, statusCode: mapped.status };
  }

  // Prisma validation errors
  if (error.constructor?.name === "PrismaClientValidationError") {
    console.error("[PRISMA VALIDATION]", error.message);
    return { message: "Invalid request data", statusCode: 400 };
  }

  // Generic server errors — never leak internal details
  console.error("[SERVER ERROR]", error);
  return { message: "An internal server error occurred", statusCode: 500 };
}

/**
 * Convenience handler for route-level catch blocks.
 * Replaces the pattern: `catch (err) { sendError(reply, err.message, err.statusCode ?? 500) }`
 * with safe, sanitized error responses.
 */
export function handleRouteError(reply: FastifyReply, err: unknown): void {
  const { message, statusCode } = sanitizeError(err);
  sendError(reply, message, statusCode);
}

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200,
  meta?: ApiResponse["meta"]
): void {
  reply.status(statusCode).send({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  } satisfies ApiResponse<T>);
}

export function sendError(
  reply: FastifyReply,
  message: string,
  statusCode = 400,
  error?: string
): void {
  reply.status(statusCode).send({
    success: false,
    message,
    error: error ?? message,
  } satisfies ApiResponse);
}

export function sendPaginated<T>(
  reply: FastifyReply,
  data: T[],
  total: number,
  page: number,
  limit: number
): void {
  const safeLimit = Math.max(1, limit);
  reply.status(200).send({
    success: true,
    data,
    meta: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  } satisfies ApiResponse<T[]>);
}

export function globalErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
): void {
  const { message, statusCode } = sanitizeError(error);

  reply.status(statusCode).send({
    success: false,
    message,
    error: message,
  } satisfies ApiResponse);
}
