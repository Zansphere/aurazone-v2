import type { FastifyPluginAsync } from "fastify";
import { addressSchema } from "@aurazone/validators";
import { prisma } from "@aurazone/database";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess, sendError } from "../../middleware/response.js";

import bcrypt from "bcryptjs";

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/profile", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: {
        id: true, email: true, phone: true, fullName: true,
        avatar: true, role: true, isEmailVerified: true, createdAt: true,
        _count: { select: { orders: true } },
      },
    });
    if (!user) return sendError(reply, "User not found", 404);
    return sendSuccess(reply, user);
  });

  fastify.put("/profile", async (request, reply) => {
    const body = request.body as { fullName?: string; avatar?: string; phone?: string };
    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName }),
        ...(body.avatar !== undefined && { avatar: body.avatar }),
        ...(body.phone !== undefined && { phone: body.phone }),
      },
      select: { id: true, email: true, phone: true, fullName: true, avatar: true, role: true, isEmailVerified: true },
    });
    return sendSuccess(reply, user);
  });

  fastify.put("/change-password", async (request, reply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return sendError(reply, "Current password and new password are required", 400);
    }
    if (newPassword.length < 6) {
      return sendError(reply, "New password must be at least 6 characters", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: request.user!.userId } });
    if (!user || !user.password) {
      return sendError(reply, "User not found", 404);
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return sendError(reply, "Incorrect current password", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return sendSuccess(reply, { message: "Password updated successfully" });
  });

  fastify.delete("/account", async (request, reply) => {
    const userId = request.user!.userId;
    // Anonymize/soft delete user and remove sessions
    await prisma.userSession.deleteMany({ where: { userId } });
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}_${Date.now()}@deleted.aurazone.internal`,
        fullName: "Deleted User",
        phone: null,
        avatar: null,
        password: null,
      },
    });
    return sendSuccess(reply, { message: "Account deleted successfully" });
  });

  fastify.get("/addresses", async (request, reply) => {
    const addresses = await prisma.address.findMany({
      where: { userId: request.user!.userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return sendSuccess(reply, addresses);
  });

  fastify.post("/addresses", async (request, reply) => {
    const parsed = addressSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, parsed.error.issues[0]?.message || "Invalid address format", 400);
    }

    const existingCount = await prisma.address.count({ where: { userId: request.user!.userId } });
    const isDefault = parsed.data.isDefault || existingCount === 0;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: request.user!.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: { userId: request.user!.userId, ...parsed.data, isDefault },
    });
    return sendSuccess(reply, address, 201);
  });

  fastify.put("/addresses/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addressSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, parsed.error.issues[0]?.message || "Invalid address format", 400);
    }

    const address = await prisma.address.findFirst({ where: { id, userId: request.user!.userId } });
    if (!address) return sendError(reply, "Address not found", 404);

    if (parsed.data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: request.user!.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({ where: { id }, data: parsed.data });
    return sendSuccess(reply, updated);
  });

  fastify.delete("/addresses/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const address = await prisma.address.findFirst({ where: { id, userId: request.user!.userId } });
    if (!address) return sendError(reply, "Address not found", 404);
    await prisma.address.delete({ where: { id } });
    return sendSuccess(reply, { message: "Address deleted" });
  });
};

export default userRoutes;