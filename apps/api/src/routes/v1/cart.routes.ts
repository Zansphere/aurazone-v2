import type { FastifyPluginAsync } from "fastify";
import { addToCartSchema, updateCartItemSchema } from "@aurazone/validators";
import { toRupees, calcItemSubtotalPaise } from "@aurazone/utils";
import { prisma } from "@aurazone/database";
import { optionalAuth } from "../../middleware/auth.js";
import { sendSuccess, sendError, handleRouteError } from "../../middleware/response.js";
import { holdInventory, releaseInventory } from "../../services/inventory.service.js";

const cartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", optionalAuth);

  const getCartWhere = (request: any) => {
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"];
    if (!userId && !sessionId) return null;
    
    return userId 
      ? { userId, status: "ACTIVE" as const }
      : { sessionId, status: "ACTIVE" as const };
  };

  const getCartCreateData = (request: any) => {
    const userId = request.user?.userId;
    const sessionId = request.headers["x-guest-session"];
    if (!userId && !sessionId) return null;
    
    return userId ? { userId } : { sessionId };
  };

  fastify.get("/", async (request, reply) => {
    try {
      const where = getCartWhere(request);
      if (!where) {
        return sendSuccess(reply, { items: [], itemCount: 0, subtotal: 0 });
      }

      let cart = await prisma.cart.findFirst({
        where,
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    select: {
                      id: true, name: true, slug: true,
                      store: { select: { id: true, name: true, slug: true } },
                    },
                  },
                  images: { take: 1, orderBy: { position: "asc" } },
                  attributes: true,
                  inventory: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!cart) {
        const createData = getCartCreateData(request);
        if (!createData) {
          return sendSuccess(reply, { items: [], itemCount: 0, subtotal: 0 });
        }
        cart = await prisma.cart.create({
          data: createData,
          include: { items: { include: { variant: true } } },
        }) as unknown as typeof cart;
      }

      if (!cart) {
        return sendSuccess(reply, { items: [], itemCount: 0, subtotal: 0 });
      }

      const subtotalPaise = cart.items.reduce(
        (sum, item) => sum + calcItemSubtotalPaise(item.unitPrice, item.quantity),
        0
      );
      const subtotal = toRupees(subtotalPaise);

      return sendSuccess(reply, {
        ...cart!,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
      });
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.post("/", async (request, reply) => {
    try {
      const parsed = addToCartSchema.safeParse(request.body);
      if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);

      const where = getCartWhere(request);
      const createData = getCartCreateData(request);
      if (!where || !createData) {
        return sendError(reply, "Please create a session first or log in", 400);
      }

      const variant = await prisma.productVariant.findUnique({
        where: { id: parsed.data.variantId },
        include: { product: { select: { id: true, isActive: true } }, inventory: true },
      });

      if (!variant || !variant.isAvailable || !variant.product.isActive) {
        return sendError(reply, "Product variant not available", 400);
      }

      let cart = await prisma.cart.findFirst({ where });
      if (!cart) {
        cart = await prisma.cart.create({ data: createData });
      }

      const stock = (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0);
      const existing = await prisma.cartItem.findFirst({
        where: { cartId: cart.id, variantId: parsed.data.variantId },
      });

      const qtyToAdd = parsed.data.quantity ?? 1;
      if (qtyToAdd > stock) return sendError(reply, `Only ${stock} available in stock`, 400);

      if (existing) {
        // Atomic increment prevents lost updates under concurrent requests
        await prisma.cartItem.update({ 
          where: { id: existing.id }, 
          data: { quantity: { increment: qtyToAdd } } 
        });
        await holdInventory(parsed.data.variantId, qtyToAdd, existing.id, `Cart hold for ${cart.id}`);
      } else {
        // Create the cart item first to get its ID, then hold
        const newItem = await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: variant.product.id,
            variantId: parsed.data.variantId,
            quantity: qtyToAdd,
            unitPrice: variant.price,
          },
        });
        await holdInventory(parsed.data.variantId, qtyToAdd, newItem.id, `Cart hold for ${cart.id}`);
      }

      return sendSuccess(reply, { message: "Item added to cart" }, 201);
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.patch("/:itemId", async (request, reply) => {
    try {
      const { itemId } = request.params as { itemId: string };
      const parsed = updateCartItemSchema.safeParse(request.body);
      if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);

      const item = await prisma.cartItem.findUnique({
        where: { id: itemId },
        include: { cart: true, variant: { include: { inventory: true } } },
      });

      const userId = request.user?.userId;
      const sessionId = request.headers["x-guest-session"];
      
      const isOwner = userId 
        ? item?.cart.userId === userId
        : item?.cart.sessionId === sessionId;

      if (!item || !isOwner) {
        return sendError(reply, "Cart item not found", 404);
      }

      const stock = (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reserved ?? 0);
      const diff = parsed.data.quantity - item.quantity;

      if (diff > 0) {
        if (diff > stock) return sendError(reply, `Only ${stock} more available in stock`, 400);
        await holdInventory(item.variantId, diff, item.id, `Cart hold for ${item.cartId}`);
      } else if (diff < 0) {
        await releaseInventory(item.variantId, Math.abs(diff), item.id, `Cart release for ${item.cartId}`);
      }

      const updated = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: parsed.data.quantity },
      });
      return sendSuccess(reply, updated);
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.delete("/:itemId", async (request, reply) => {
    try {
      const { itemId } = request.params as { itemId: string };
      const item = await prisma.cartItem.findUnique({
        where: { id: itemId }, include: { cart: true },
      });
      
      const userId = request.user?.userId;
      const sessionId = request.headers["x-guest-session"];
      
      const isOwner = userId 
        ? item?.cart.userId === userId
        : item?.cart.sessionId === sessionId;

      if (!item || !isOwner) {
        return sendError(reply, "Cart item not found", 404);
      }
      
      await releaseInventory(item.variantId, item.quantity, item.id, `Cart release for ${item.cartId}`);
      await prisma.cartItem.delete({ where: { id: itemId } });
      return sendSuccess(reply, { message: "Item removed from cart" });
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.delete("/", async (request, reply) => {
    try {
      const where = getCartWhere(request);
      if (!where) {
        return sendSuccess(reply, { message: "Cart cleared" });
      }
      const cart = await prisma.cart.findFirst({ where, include: { items: true } });
      if (cart) {
        for (const item of cart.items) {
          await releaseInventory(item.variantId, item.quantity, item.id, `Cart cleared for ${cart.id}`);
        }
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return sendSuccess(reply, { message: "Cart cleared" });
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });
};

export default cartRoutes;