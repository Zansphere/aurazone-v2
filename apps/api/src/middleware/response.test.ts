import { describe, it, expect, vi } from "vitest";
import { ZodError, z } from "zod";
import jwt from "jsonwebtoken";
import {
  sanitizeError,
  sendSuccess,
  sendError,
  sendPaginated,
  handleRouteError,
} from "./response.js";
import type { FastifyReply } from "fastify";

function createMockReply(): FastifyReply {
  const reply: any = {
    statusCode: 200,
    headers: {},
    sentData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(data: any) {
      this.sentData = data;
      return this;
    },
    header(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
  };
  return reply as FastifyReply;
}

describe("Response Middleware - sanitizeError", () => {
  it("formats Zod validation errors as 400 Bad Request with field-level details", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    const result = schema.safeParse({ email: "invalid-email", age: 10 });
    expect(result.success).toBe(false);

    if (!result.success) {
      const sanitized = sanitizeError(result.error);
      expect(sanitized.statusCode).toBe(400);
      expect(sanitized.message).toContain("email");
    }
  });

  it("formats TokenExpiredError as 401 with Token expired message", () => {
    const tokenError = new jwt.TokenExpiredError("jwt expired", new Date());
    const sanitized = sanitizeError(tokenError);
    expect(sanitized.statusCode).toBe(401);
    expect(sanitized.message).toBe("Token expired");
  });

  it("formats JsonWebTokenError as 401 with Invalid token message", () => {
    const tokenError = new jwt.JsonWebTokenError("invalid signature");
    const sanitized = sanitizeError(tokenError);
    expect(sanitized.statusCode).toBe(401);
    expect(sanitized.message).toBe("Invalid token");
  });

  it("formats SyntaxError / malformed JSON as 400 Bad Request", () => {
    const syntaxErr = new SyntaxError("Unexpected token in JSON at position 0");
    const sanitized = sanitizeError(syntaxErr);
    expect(sanitized.statusCode).toBe(400);
    expect(sanitized.message).toContain("Unexpected token");
  });

  it("formats Prisma P2002 unique constraint error as 409 Conflict", () => {
    const prismaErr = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["email"] },
    });
    const sanitized = sanitizeError(prismaErr);
    expect(sanitized.statusCode).toBe(409);
    expect(sanitized.message).toBe("A record with this value already exists");
  });

  it("formats Prisma P2025 record not found error as 404 Not Found", () => {
    const prismaErr = Object.assign(new Error("Record not found"), {
      code: "P2025",
    });
    const sanitized = sanitizeError(prismaErr);
    expect(sanitized.statusCode).toBe(404);
    expect(sanitized.message).toContain("not found");
  });

  it("preserves explicit 4xx statusCode from business service errors", () => {
    const businessErr = Object.assign(new Error("Insufficient stock available"), {
      statusCode: 422,
    });
    const sanitized = sanitizeError(businessErr);
    expect(sanitized.statusCode).toBe(422);
    expect(sanitized.message).toBe("Insufficient stock available");
  });

  it("shields internal errors as 500 without leaking stack traces", () => {
    const rawError = new Error("Database connection pool exhausted: secret_db_uri");
    const sanitized = sanitizeError(rawError);
    expect(sanitized.statusCode).toBe(500);
    expect(sanitized.message).not.toContain("secret_db_uri");
  });
});

describe("Response Middleware - Envelope Helpers", () => {
  it("sendSuccess sends { success: true, data } envelope with correct status code", () => {
    const reply = createMockReply();
    sendSuccess(reply, { id: "123", name: "Sample Product" }, 201);

    expect(reply.statusCode).toBe(201);
    expect((reply as any).sentData).toEqual({
      success: true,
      data: { id: "123", name: "Sample Product" },
    });
  });

  it("sendError sends { success: false, message, error } envelope", () => {
    const reply = createMockReply();
    sendError(reply, "Item not found in inventory", 404);

    expect(reply.statusCode).toBe(404);
    expect((reply as any).sentData).toEqual({
      success: false,
      message: "Item not found in inventory",
      error: "Item not found in inventory",
    });
  });

  it("sendPaginated sends data and pagination metadata with safe bounds", () => {
    const reply = createMockReply();
    const items = [{ id: 1 }, { id: 2 }];
    sendPaginated(reply, items, 50, 1, 10);

    expect(reply.statusCode).toBe(200);
    expect((reply as any).sentData).toEqual({
      success: true,
      data: items,
      meta: {
        total: 50,
        page: 1,
        limit: 10,
        totalPages: 5,
      },
    });
  });

  it("handleRouteError catches arbitrary error and formats safe response", () => {
    const reply = createMockReply();
    handleRouteError(reply, new Error("Something went wrong"));

    expect(reply.statusCode).toBe(500);
    expect((reply as any).sentData.success).toBe(false);
  });
});
