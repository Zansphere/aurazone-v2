import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@aurazone/database";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess, sendError, handleRouteError } from "../../middleware/response.js";
import { holdInventory } from "../../services/inventory.service.js";

const wishlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (request, reply) => {
    let wishlist = await prisma.wishlist.findFirst({
      where: { userId: request.user!.userId },
    });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId: request.user!.userId } });
    }

    const items = await prisma.wishlistItem.findMany({
      where: {
        wishlistId: wishlist.id,
        product: { deletedAt: null, isActive: true },
      },
      include: {
        product: {
          include: {
            store: { select: { id: true, name: true, slug: true } },
            variants: {
              where: { isAvailable: true, deletedAt: null }, take: 1, orderBy: { price: "asc" },
              select: {
                id: true, price: true, compareAtPrice: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    return sendSuccess(reply, items);
  });

  fastify.post("/", async (request, reply) => {
    const { productId } = request.body as { productId: string };
    if (!productId) return sendError(reply, "productId is required", 400);

    const product = await prisma.product.findUnique({
      where: { id: productId, deletedAt: null, isActive: true },
    });
    if (!product) return sendError(reply, "Product not found or unavailable", 404);

    let wishlist = await prisma.wishlist.findFirst({ where: { userId: request.user!.userId } });
    if (!wishlist) {
      wishlist = await prisma.wishlist.create({ data: { userId: request.user!.userId } });
    }

    const existing = await prisma.wishlistItem.findFirst({
      where: { wishlistId: wishlist.id, productId },
    });
    if (existing) return sendSuccess(reply, { message: "Already in wishlist" });

    const item = await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
    });
    return sendSuccess(reply, item, 201);
  });

  fastify.delete("/:itemId", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId }, include: { wishlist: true },
    });
    if (!item || item.wishlist.userId !== request.user!.userId) {
      return sendError(reply, "Wishlist item not found", 404);
    }
    await prisma.wishlistItem.delete({ where: { id: itemId } });
    return sendSuccess(reply, { message: "Removed from wishlist" });
  });

  fastify.post("/:itemId/move-to-cart", async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    try {
      const wishlistItem = await prisma.wishlistItem.findUnique({
        where: { id: itemId },
        include: {
          wishlist: true,
          product: {
            include: {
              variants: {
                where: { isAvailable: true, deletedAt: null },
                take: 1,
                orderBy: { price: "asc" },
                include: { inventory: true },
              },
            },
          },
        },
      });

      if (!wishlistItem || wishlistItem.wishlist.userId !== request.user!.userId) {
        return sendError(reply, "Wishlist item not found", 404);
      }

      if (!wishlistItem.product || wishlistItem.product.deletedAt !== null || !wishlistItem.product.isActive) {
        return sendError(reply, "Product is no longer available", 400);
      }

      const variant = wishlistItem.product.variants[0];
      if (!variant) return sendError(reply, "No available variant for this product", 400);

      const availableStock = (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0);
      if (availableStock < 1) {
        return sendError(reply, "Product variant is currently out of stock", 400);
      }

      let cart = await prisma.cart.findFirst({
        where: { userId: request.user!.userId, status: "ACTIVE" },
      });
      if (!cart) {
        cart = await prisma.cart.create({ data: { userId: request.user!.userId } });
      }

      const existingCartItem = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, variantId: variant.id },
      });

      if (existingCartItem) {
        await prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: { quantity: { increment: 1 } },
        });
        await holdInventory(variant.id, 1, existingCartItem.id, `Wishlist move hold for ${cart.id}`);
      } else {
        const newCartItem = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: wishlistItem.productId,
            variantId: variant.id,
            quantity: 1,
            unitPrice: variant.price,
          },
        });
        await holdInventory(variant.id, 1, newCartItem.id, `Wishlist move hold for ${cart.id}`);
      }

      await prisma.wishlistItem.delete({ where: { id: itemId } });
      return sendSuccess(reply, { message: "Moved to cart" });
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });
};

export default wishlistRoutes;