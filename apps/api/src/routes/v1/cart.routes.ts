import type { FastifyPluginAsync } from "fastify";
import crypto from "crypto";
import { addToCartSchema, updateCartItemSchema } from "@aurazone/validators";
import { toRupees, calcItemSubtotalPaise } from "@aurazone/utils";
import { prisma } from "@aurazone/database";
import { optionalAuth } from "../../middleware/auth.js";
import { sendSuccess, sendError, handleRouteError } from "../../middleware/response.js";
import { holdInventory, releaseInventory } from "../../services/inventory.service.js";

const cartRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", optionalAuth);

  const resolveGuestSession = async (request: any, reply?: any) => {
    const rawSessionId = request.headers["x-guest-session"] as string | undefined;

    if (rawSessionId) {
      // 1. Check if GuestSession exists by ID (UUID) or sessionId (token)
      const existing = await prisma.guestSession.findFirst({
        where: {
          OR: [{ id: rawSessionId }, { sessionId: rawSessionId }],
        },
      });

      if (existing) {
        return existing;
      }

      // 2. If valid UUID, preserve it so client-cached localStorage guest_session_id remains valid
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawSessionId);
      const newSession = await prisma.guestSession.create({
        data: {
          ...(isUuid ? { id: rawSessionId } : {}),
          sessionId: crypto.randomBytes(32).toString("hex"),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });

      if (reply) {
        reply.header("x-guest-session", newSession.id);
      }
      return newSession;
    }

    // 3. No session provided: create fresh session
    const newSession = await prisma.guestSession.create({
      data: {
        sessionId: crypto.randomBytes(32).toString("hex"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    if (reply) {
      reply.header("x-guest-session", newSession.id);
    }
    return newSession;
  };

  const getOrCreateActiveCart = async (request: any, reply?: any) => {
    const userId = request.user?.userId;
    if (userId) {
      let cart = await prisma.cart.findFirst({
        where: { userId, status: "ACTIVE" },
      });
      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId },
        });
      }
      return cart;
    }

    const session = await resolveGuestSession(request, reply);
    let cart = await prisma.cart.findFirst({
      where: { sessionId: session.id, status: "ACTIVE" },
    });
    if (!cart) {
      cart = await prisma.cart.create({
        data: { sessionId: session.id },
      });
    }
    return cart;
  };

  const getEnrichedCart = async (cartId: string) => {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive: true,
                    deletedAt: true,
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
      return {
        items: [],
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        hasUnavailableItems: false,
        canCheckout: false,
      };
    }

    // Check for deleted or inactive products/variants and prune them
    const validItems: typeof cart.items = [];
    const staleItemIds: string[] = [];

    for (const item of cart.items) {
      const isDeleted =
        !item.variant ||
        item.variant.deletedAt !== null ||
        !item.variant.product ||
        item.variant.product.deletedAt !== null;
      const isInactive = !item.variant?.isAvailable || !item.variant?.product?.isActive;

      if (isDeleted || isInactive) {
        staleItemIds.push(item.id);
        try {
          await releaseInventory(item.variantId, item.quantity, item.id, "Auto-pruned deleted/inactive cart item");
        } catch {
          // Ignore release failure for orphaned variants
        }
      } else {
        validItems.push(item);
      }
    }

    if (staleItemIds.length > 0) {
      await prisma.cartItem.deleteMany({
        where: { id: { in: staleItemIds } },
      });
    }

    // Enrich items with live stock availability
    const enrichedItems = validItems.map((item) => {
      const availableStock = item.variant?.inventory?.quantity ?? 0;
      const isStockSufficient = availableStock >= item.quantity;
      return {
        ...item,
        isAvailable: isStockSufficient,
        availableStock,
        unavailableReason: !isStockSufficient
          ? `Only ${availableStock} in stock (requested ${item.quantity})`
          : null,
      };
    });

    const subtotalPaise = enrichedItems
      .filter((item) => item.isAvailable)
      .reduce((sum, item) => sum + calcItemSubtotalPaise(item.unitPrice, item.quantity), 0);
    const subtotal = toRupees(subtotalPaise);

    const uniqueProductIds = new Set(enrichedItems.map((item) => item.productId));
    const hasUnavailableItems = enrichedItems.some((item) => !item.isAvailable);
    const canCheckout = enrichedItems.length > 0 && !hasUnavailableItems;

    return {
      ...cart,
      items: enrichedItems,
      itemCount: uniqueProductIds.size,
      totalQuantity: enrichedItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      hasUnavailableItems,
      canCheckout,
    };
  };

  fastify.get("/", async (request, reply) => {
    try {
      const userId = request.user?.userId;
      const rawSessionId = request.headers["x-guest-session"] as string | undefined;

      if (!userId && !rawSessionId) {
        return sendSuccess(reply, {
          items: [],
          itemCount: 0,
          totalQuantity: 0,
          subtotal: 0,
          hasUnavailableItems: false,
          canCheckout: false,
        });
      }

      const activeCart = await getOrCreateActiveCart(request, reply);
      const enriched = await getEnrichedCart(activeCart.id);
      return sendSuccess(reply, enriched);
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.post("/", async (request, reply) => {
    try {
      const parsed = addToCartSchema.safeParse(request.body);
      if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);

      const variant = await prisma.productVariant.findUnique({
        where: { id: parsed.data.variantId },
        include: {
          product: { select: { id: true, isActive: true, deletedAt: true } },
          inventory: true,
        },
      });

      if (
        !variant ||
        variant.deletedAt !== null ||
        !variant.isAvailable ||
        !variant.product ||
        variant.product.deletedAt !== null ||
        !variant.product.isActive
      ) {
        return sendError(reply, "Product variant is no longer available", 400);
      }

      const cart = await getOrCreateActiveCart(request, reply);

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

      const enriched = await getEnrichedCart(cart.id);
      return sendSuccess(reply, enriched, 201);
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
        include: {
          cart: true,
          variant: {
            include: {
              inventory: true,
              product: { select: { id: true, isActive: true, deletedAt: true } },
            },
          },
        },
      });

      const userId = request.user?.userId;
      const rawSessionId = request.headers["x-guest-session"] as string | undefined;

      let isOwner = false;
      if (userId) {
        isOwner = item?.cart.userId === userId;
      } else if (rawSessionId && item) {
        if (item.cart.sessionId === rawSessionId) {
          isOwner = true;
        } else {
          const guestSession = await prisma.guestSession.findFirst({
            where: { OR: [{ id: rawSessionId }, { sessionId: rawSessionId }] },
          });
          isOwner = Boolean(guestSession && item.cart.sessionId === guestSession.id);
        }
      }

      if (!item || !isOwner) {
        return sendError(reply, "Cart item not found", 404);
      }

      if (
        item.variant.deletedAt !== null ||
        !item.variant.isAvailable ||
        !item.variant.product ||
        item.variant.product.deletedAt !== null ||
        !item.variant.product.isActive
      ) {
        return sendError(reply, "Product variant is no longer available", 400);
      }

      const stock = (item.variant.inventory?.quantity ?? 0) - (item.variant.inventory?.reserved ?? 0);
      const diff = parsed.data.quantity - item.quantity;

      if (diff > 0) {
        if (diff > stock) return sendError(reply, `Only ${stock} more available in stock`, 400);
        await holdInventory(item.variantId, diff, item.id, `Cart hold for ${item.cartId}`);
      } else if (diff < 0) {
        await releaseInventory(item.variantId, Math.abs(diff), item.id, `Cart release for ${item.cartId}`);
      }

      await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: parsed.data.quantity },
      });

      const enriched = await getEnrichedCart(item.cartId);
      return sendSuccess(reply, enriched);
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
      const rawSessionId = request.headers["x-guest-session"] as string | undefined;

      let isOwner = false;
      if (userId) {
        isOwner = item?.cart.userId === userId;
      } else if (rawSessionId && item) {
        if (item.cart.sessionId === rawSessionId) {
          isOwner = true;
        } else {
          const guestSession = await prisma.guestSession.findFirst({
            where: { OR: [{ id: rawSessionId }, { sessionId: rawSessionId }] },
          });
          isOwner = Boolean(guestSession && item.cart.sessionId === guestSession.id);
        }
      }

      if (!item || !isOwner) {
        return sendError(reply, "Cart item not found", 404);
      }
      
      await releaseInventory(item.variantId, item.quantity, item.id, `Cart release for ${item.cartId}`);
      await prisma.cartItem.delete({ where: { id: itemId } });

      const enriched = await getEnrichedCart(item.cartId);
      return sendSuccess(reply, enriched);
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });

  fastify.delete("/", async (request, reply) => {
    try {
      const userId = request.user?.userId;
      const rawSessionId = request.headers["x-guest-session"] as string | undefined;
      if (!userId && !rawSessionId) {
        return sendSuccess(reply, {
          items: [],
          itemCount: 0,
          totalQuantity: 0,
          subtotal: 0,
          hasUnavailableItems: false,
          canCheckout: false,
          message: "Cart cleared",
        });
      }

      const activeCart = await getOrCreateActiveCart(request, reply);
      const cart = await prisma.cart.findUnique({ where: { id: activeCart.id }, include: { items: true } });
      if (cart) {
        for (const item of cart.items) {
          await releaseInventory(item.variantId, item.quantity, item.id, `Cart cleared for ${cart.id}`);
        }
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return sendSuccess(reply, {
        items: [],
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        hasUnavailableItems: false,
        canCheckout: false,
        message: "Cart cleared",
      });
    } catch (e: unknown) {
      return handleRouteError(reply, e);
    }
  });
};

export default cartRoutes;
