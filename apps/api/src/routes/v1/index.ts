import type { FastifyPluginAsync } from "fastify";
import authRoutes from "./auth.routes.js";
import storeRoutes from "./store.routes.js";
import categoryRoutes from "./category.routes.js";
import productRoutes from "./product.routes.js";
import cartRoutes from "./cart.routes.js";
import wishlistRoutes from "./wishlist.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import userRoutes from "./user.routes.js";
import storefrontRoutes from "./storefront.routes.js";
import sessionRoutes from "./session.routes.js";
import uploadRoutes from "./upload.routes.js";
import adminRoutes from "./admin/index.js";
import searchRoutes from "./search.routes.js";

export const v1Routes: FastifyPluginAsync = async (fastify) => {
  // Health ping for v1
  fastify.get("/ping", async () => ({ ok: true, version: "v1" }));

  // Public routes
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(storeRoutes, { prefix: "/stores" });
  await fastify.register(categoryRoutes, { prefix: "/categories" });
  await fastify.register(productRoutes, { prefix: "/products" });
  await fastify.register(searchRoutes, { prefix: "/search" });
  await fastify.register(storefrontRoutes, { prefix: "/storefront" });
  await fastify.register(sessionRoutes, { prefix: "/sessions" });

  // Auth-required routes
  await fastify.register(cartRoutes, { prefix: "/cart" });
  await fastify.register(wishlistRoutes, { prefix: "/wishlist" });
  await fastify.register(orderRoutes, { prefix: "/orders" });
  await fastify.register(paymentRoutes, { prefix: "/payments" });
  await fastify.register(userRoutes, { prefix: "/users" });

  // Admin routes
  await fastify.register(adminRoutes, { prefix: "/admin" });
  await fastify.register(uploadRoutes, { prefix: "/upload" });
};