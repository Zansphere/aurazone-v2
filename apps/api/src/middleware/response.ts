import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

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
 * - Prisma errors are mapped to safe, generic messages.
 * - Unknown 500-level errors are replaced with a generic message.
 */
export function sanitizeError(err: unknown): { message: string; statusCode: number } {
  const error = err as Error & { statusCode?: number; code?: string; meta?: any };

  // Business errors thrown with Object.assign(new Error(...), { statusCode })
  // are trusted — the message was crafted by our own service code.
  if (error.statusCode && error.statusCode < 500) {
    return { message: error.message, statusCode: error.statusCode };
  }

  // Prisma client known errors (PrismaClientKnownRequestError)
  if (error.code && PRISMA_ERROR_MAP[error.code]) {
    const mapped = PRISMA_ERROR_MAP[error.code];
    // Log the full Prisma error server-side for debugging
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
  reply.status(200).send({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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