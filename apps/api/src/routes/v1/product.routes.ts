import type { FastifyPluginAsync } from "fastify";
import { parsePagination } from "@aurazone/utils";
import { sendSuccess, sendError, sendPaginated, handleRouteError } from "../../middleware/response.js";
import { authenticate } from "../../middleware/auth.js";
import * as productService from "../../services/product.service.js";
import { SearchService } from "../../services/search.service.js";

const productRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /search — Elasticsearch-like dedicated search endpoint ──
  fastify.get("/search", async (request, reply) => {
    const query = request.query as Record<string, string>;
    try {
      const results = await SearchService.search({
        q: query.q ?? query.search,
        storeId: query.storeId,
        storeSlug: query.storeSlug,
        categoryId: query.categoryId,
        categorySlug: query.categorySlug,
        brand: query.brand,
        couponCode: query.coupon ?? query.couponCode,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        inStock: query.inStock === "true" || query.inStock === "1",
        sortBy: query.sortBy as any,
        skip: query.skip ? Number(query.skip) : 0,
        take: query.take ? Number(query.take) : 24,
        redis: fastify.redis,
      });
      return sendSuccess(reply, results);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── GET / — List products (public) ───────────────────────────
  fastify.get("/", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);

    const { products, total } = await productService.listProducts({
      storeId: query.storeId,
      categoryId: query.categoryId,
      brand: query.brand,
      couponCode: query.coupon ?? query.couponCode,
      search: query.search ?? query.q,
      minPrice: query.minPrice ? Number(query.minPrice) : undefined,
      maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
      inStock: query.inStock === "true" || query.inStock === "1",
      isActive: true,
      sortBy: query.sortBy,
      skip,
      take,
      redis: fastify.redis,
    });

    return sendPaginated(reply, products, total, Math.floor(skip / take) + 1, take);
  });

  // ─── GET /:slug — Get product by slug (public) ────────────────
  fastify.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    try {
      const product = await productService.getProductBySlug(slug, fastify.redis);
      return sendSuccess(reply, product);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── GET /:slug/reviews — Get reviews for a product (public) ──
  fastify.get("/:slug/reviews", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    try {
      const reviews = await productService.getProductReviews(slug);
      return sendSuccess(reply, reviews);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── POST /:slug/reviews — Add a review for a product ─────────
  fastify.post("/:slug/reviews", { preHandler: [authenticate] }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = (request.body as { rating?: number; body?: string }) || {};

    if (typeof body.rating !== "number" || isNaN(body.rating) || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      return sendError(reply, "Rating must be an integer between 1 and 5", 400);
    }
    
    try {
      const review = await productService.addProductReview(slug, request.user!.userId, {
        rating: body.rating,
        body: body.body,
      });
      return sendSuccess(reply, review, 201);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });

  // ─── GET /:slug/related — Get related products (public) ──────
  fastify.get("/:slug/related", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const query = request.query as { limit?: string };
    try {
      const limit = query.limit ? Number(query.limit) : 6;
      const related = await productService.getRelatedProducts(slug, limit);
      return sendSuccess(reply, related);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });
};

export default productRoutes;