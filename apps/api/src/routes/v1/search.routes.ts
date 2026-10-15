import type { FastifyPluginAsync } from "fastify";
import { SearchService } from "../../services/search.service.js";
import { sendSuccess, sendError } from "../../middleware/response.js";

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET /suggestions — Live autocomplete (Elasticsearch-like) ─
  fastify.get("/suggestions", async (request, reply) => {
    const query = request.query as { q?: string; limit?: string };
    const q = (query.q ?? "").trim();

    try {
      const suggestions = await SearchService.getLiveSuggestions(
        q,
        fastify.redis,
        query.limit ? Number(query.limit) : 6
      );
      return sendSuccess(reply, suggestions);
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error);
      return sendError(reply, error.message, 500);
    }
  });

  // ─── GET / — Comprehensive search with facets & relevance ranking ───
  fastify.get("/", async (request, reply) => {
    const query = request.query as {
      q?: string;
      search?: string;
      storeId?: string;
      storeSlug?: string;
      categoryId?: string;
      categorySlug?: string;
      brand?: string;
      minPrice?: string;
      maxPrice?: string;
      inStock?: string;
      sortBy?: "relevance" | "price_asc" | "price_desc" | "newest" | "oldest" | "name_asc" | "name_desc";
      skip?: string;
      take?: string;
    };

    try {
      const results = await SearchService.search({
        q: query.q ?? query.search,
        storeId: query.storeId,
        storeSlug: query.storeSlug,
        categoryId: query.categoryId,
        categorySlug: query.categorySlug,
        brand: query.brand,
        minPrice: query.minPrice ? Number(query.minPrice) : undefined,
        maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
        inStock: query.inStock === "true" || query.inStock === "1",
        sortBy: query.sortBy,
        skip: query.skip ? Number(query.skip) : 0,
        take: query.take ? Number(query.take) : 24,
        redis: fastify.redis,
      });

      return sendSuccess(reply, results);
    } catch (err: unknown) {
      const error = err as Error;
      fastify.log.error(error);
      return sendError(reply, error.message, 500);
    }
  });

  // ─── GET /popular — Trending searches and categories ──────────
  fastify.get("/popular", async (_request, reply) => {
    const popularTerms = [
      "White T-Shirt",
      "Running Shoes",
      "Denim Jeans",
      "Leather Jacket",
      "Face Serum",
      "Wireless Earbuds",
      "Smartwatch",
      "Table Lamp",
    ];
    return sendSuccess(reply, {
      trendingKeywords: popularTerms,
    });
  });
};

export default searchRoutes;
