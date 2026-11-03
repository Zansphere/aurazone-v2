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
/**
 * Formats Zod validation errors into a clean, human-readable string.
 * Supports array indices for variants (e.g., "Variant #1 (price): Price is required").
 */
export function formatZodError(err: ZodError): string {
  if (!err?.errors?.length) return "Validation error";
  return err.errors
    .map((issue) => {
      const path = issue.path;
      if (path.length > 0) {
        if (path[0] === "variants" && typeof path[1] === "number") {
          const variantNum = path[1] + 1;
          const fieldName = path.slice(2).join(".") || "field";
          return `Variant #${variantNum} (${fieldName}): ${issue.message}`;
        }
        return `${path.join(".")}: ${issue.message}`;
      }
      return issue.message;
    })
    .join("; ");
}

export function sanitizeError(err: unknown): { message: string; statusCode: number } {
  if (!err) {
    return { message: "An unexpected error occurred", statusCode: 500 };
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    return { message: formatZodError(err), statusCode: 400 };
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
