import type { FastifyPluginAsync } from "fastify";
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "@aurazone/validators";
import { authenticate, setAuthCookies, clearAuthCookies } from "../../middleware/auth.js";
import { sendSuccess, sendError, handleRouteError } from "../../middleware/response.js";
import * as authService from "../../services/auth.service.js";
import { EmailService } from "../../services/email.service.js";
import { env } from "../../config/env.js";

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to extract device and IP
  const getClientMetadata = (request: any) => {
    const userAgent = request.headers["user-agent"] ?? "web";
    const forwarded = request.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : request.ip || "0.0.0.0";
    return { deviceInfo: userAgent.slice(0, 200), ipAddress: ip };
  };

  // ─── POST /signup ─────────────────────────────────────────────
  fastify.post("/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, parsed.error.errors[0].message, 400);
    }

    try {
      const guestSession = request.headers["x-guest-session"] as string | undefined;
      const { deviceInfo, ipAddress } = getClientMetadata(request);

      const { user, accessToken, refreshToken, verificationToken } = await authService.signupWithEmail(
        parsed.data.email,
        parsed.data.password,
        parsed.data.fullName,
        guestSession,
        deviceInfo,
        ipAddress
      );

      setAuthCookies(reply, accessToken, refreshToken);

      // Send verification email in background
      if (verificationToken) {
        const verifyUrl = `${env.CUSTOMER_URL}/verify-email?token=${verificationToken}`;
        EmailService.sendEmailVerification(user.email!, verifyUrl).catch((err) => {
          fastify.log.error(err, "Failed to send verification email");
        });
      }

      return sendSuccess(reply, {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken,
        refreshToken,
      }, 201);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /login ──────────────────────────────────────────────
  fastify.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, parsed.error.errors[0].message, 400);
    }

    try {
      const guestSession = request.headers["x-guest-session"] as string | undefined;
      const { deviceInfo, ipAddress } = getClientMetadata(request);

      const { user, accessToken, refreshToken } = await authService.loginWithEmail(
        parsed.data.email,
        parsed.data.password,
        guestSession,
        deviceInfo,
        ipAddress
      );

      setAuthCookies(reply, accessToken, refreshToken);

      return sendSuccess(reply, {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken,
        refreshToken,
      });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── GET /me ──────────────────────────────────────────────────
  fastify.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const user = await authService.getCurrentUser(request.user!.userId);
      return sendSuccess(reply, { user });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /verify-email ───────────────────────────────────────
  fastify.post("/verify-email", async (request, reply) => {
    const { token } = request.body as { token?: string };
    if (!token) return sendError(reply, "Verification token is required", 400);

    try {
      const user = await authService.verifyEmail(token);
      return sendSuccess(reply, {
        message: "Email verified successfully",
        user: { id: user.id, email: user.email, isEmailVerified: user.isEmailVerified },
      });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /resend-verification ────────────────────────────────
  fastify.post("/resend-verification", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const rawToken = await authService.createEmailVerificationToken(request.user!.userId);
      const verifyUrl = `${env.CUSTOMER_URL}/verify-email?token=${rawToken}`;
      await EmailService.sendEmailVerification(request.user!.email, verifyUrl);
      return sendSuccess(reply, { message: "Verification email sent" });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /refresh ────────────────────────────────────────────
  fastify.post("/refresh", async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token || (request.body as any)?.refreshToken;
    if (!refreshToken) {
      return sendError(reply, "Refresh token required", 401);
    }

    try {
      const tokens = await authService.refreshAccessToken(refreshToken);
      setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
      return sendSuccess(reply, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    } catch (err: unknown) {
      clearAuthCookies(reply);
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /logout ─────────────────────────────────────────────
  fastify.post("/logout", async (request, reply) => {
    const refreshToken = request.cookies?.refresh_token;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    clearAuthCookies(reply);
    return sendSuccess(reply, { message: "Logged out" });
  });

  // ─── POST /forgot-password ────────────────────────────────────
  fastify.post(
    "/forgot-password",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsed = forgotPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, parsed.error.errors[0].message, 400);
      }

      const token = await authService.createPasswordResetToken(parsed.data.email);

      if (token) {
        const resetUrl = `${env.CUSTOMER_URL}/reset-password?token=${token}`;
        // Send reset email via BullMQ Queue
        EmailService.sendPasswordResetEmail(parsed.data.email, resetUrl).catch((err) => {
          fastify.log.error(err, "Failed to queue password reset email");
        });

        if (process.env.NODE_ENV === "development") {
          fastify.log.info(`Password reset link for ${parsed.data.email}: ${resetUrl}`);
        }
      }

      // Always return success to prevent email enumeration
      return sendSuccess(reply, {
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }
  );

  // ─── POST /reset-password ────────────────────────────────────
  fastify.post("/reset-password", async (request, reply) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, parsed.error.errors[0].message, 400);
    }

    try {
      await authService.resetPassword(parsed.data.token, parsed.data.password);
      return sendSuccess(reply, { message: "Password reset successfully" });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });
};

export default authRoutes;