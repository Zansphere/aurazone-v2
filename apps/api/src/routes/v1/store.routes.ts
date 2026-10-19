import type { FastifyPluginAsync } from "fastify";
import { storeSchema } from "@aurazone/validators";
import { parsePagination } from "@aurazone/utils";
import { sendSuccess, sendError, sendPaginated, handleRouteError } from "../../middleware/response.js";
import { optionalAuth } from "../../middleware/auth.js";
import * as storeService from "../../services/store.service.js";

const storeRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET / — List all active stores (public) ──────────────────
  fastify.get("/", { preHandler: [optionalAuth] }, async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);

    const { stores, total } = await storeService.listStores({
      activeOnly: true,
      search: query.search,
      skip,
      take,
    });

    return sendPaginated(reply, stores, total, Math.floor(skip / take) + 1, take);
  });

  // ─── GET /:slug — Get store by slug (public) ──────────────────
  fastify.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    try {
      const store = await storeService.getStoreBySlug(slug);
      return sendSuccess(reply, store);
    } catch (err: unknown) {
      return handleRouteError(reply, err);
    }
  });
};

export default storeRoutes;