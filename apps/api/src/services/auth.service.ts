import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma, type User } from "@aurazone/database";
import { generateTokens } from "../middleware/auth.js";

const SALT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function mergeGuestCart(userId: string, guestSessionId?: string) {
  if (!guestSessionId) return;

  const guestCart = await prisma.cart.findFirst({
    where: { sessionId: guestSessionId, status: "ACTIVE" },
    include: { items: true }
  });

  if (!guestCart || guestCart.items.length === 0) return;

  let userCart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" }
  });

  if (!userCart) {
    userCart = await prisma.cart.create({ data: { userId } });
  }

  // Merge items
  for (const item of guestCart.items) {
    const existing = await prisma.cartItem.findFirst({
      where: { cartId: userCart.id, variantId: item.variantId }
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity }
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: userCart.id,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }
      });
    }
  }

  // Clean up guest cart
  await prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } });
  await prisma.cart.delete({ where: { id: guestCart.id } });
}

async function mergeGuestOrders(userId: string, guestSessionId?: string) {
  if (!guestSessionId) return;
  await prisma.order.updateMany({
    where: { sessionId: guestSessionId, userId: null },
    data: { userId }
  });
}

export async function signupWithEmail(
  email: string,
  password: string,
  fullName?: string,
  guestSessionId?: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<{ user: User; accessToken: string; refreshToken: string; verificationToken: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { statusCode: 409 });
  }

  const rawVerificationToken = crypto.randomBytes(32).toString("hex");
  const hashedVerificationToken = hashToken(rawVerificationToken);

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      fullName: fullName ?? null,
      role: "CUSTOMER",
      isEmailVerified: null,
      emailVerificationToken: hashedVerificationToken,
    },
  });

  await prisma.cart.create({ data: { userId: user.id } });
  await prisma.wishlist.create({ data: { userId: user.id } });

  await mergeGuestCart(user.id, guestSessionId);
  await mergeGuestOrders(user.id, guestSessionId);

  const tokens = generateTokens({ userId: user.id, email: user.email!, role: user.role });

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(tokens.refreshToken),
      deviceInfo: deviceInfo ?? "web",
      ipAddress: ipAddress ?? "0.0.0.0",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { user, ...tokens, verificationToken: rawVerificationToken };
}

export async function loginWithEmail(
  email: string,
  password: string,
  guestSessionId?: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  await mergeGuestCart(user.id, guestSessionId);
  await mergeGuestOrders(user.id, guestSessionId);

  const tokens = generateTokens({ userId: user.id, email: user.email!, role: user.role });

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashToken(tokens.refreshToken),
      deviceInfo: deviceInfo ?? "web",
      ipAddress: ipAddress ?? "0.0.0.0",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { user, ...tokens };
}

export async function verifyEmail(token: string): Promise<User> {
  const hashedToken = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashedToken },
  });

  if (!user) {
    throw Object.assign(new Error("Invalid or expired verification token"), { statusCode: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: new Date(),
      emailVerificationToken: null,
    },
  });

  return updatedUser;
}

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
  if (user.isEmailVerified) throw Object.assign(new Error("Email already verified"), { statusCode: 400 });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerificationToken: hashToken(rawToken) },
  });

  return rawToken;
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, phone: true, fullName: true,
      avatar: true, role: true, createdAt: true,
    },
  });
  if (!user) throw Object.assign(new Error("User not found"), { statusCode: 404 });
  return user;
}

export async function refreshAccessToken(refreshToken: string) {
  const hash = hashToken(refreshToken);
  const session = await prisma.userSession.findFirst({
    where: { refreshTokenHash: hash, expiresAt: { gt: new Date() } },
  });

  if (!session) {
    throw Object.assign(new Error("Invalid or expired refresh token"), { statusCode: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw Object.assign(new Error("User not found"), { statusCode: 401 });

  const tokens = generateTokens({ userId: user.id, email: user.email!, role: user.role });

  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return tokens;
}

export async function logout(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await prisma.userSession.deleteMany({ where: { refreshTokenHash: hash } });
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return "";
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashToken(token),
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const hashedToken = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } },
  });
  if (!user) throw Object.assign(new Error("Invalid or expired reset token"), { statusCode: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(newPassword, SALT_ROUNDS),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
  await prisma.userSession.deleteMany({ where: { userId: user.id } });
}