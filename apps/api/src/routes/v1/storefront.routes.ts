import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@aurazone/database";
import { sendSuccess, sendError } from "../../middleware/response.js";

const storefrontRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── GET / — Get active storefront sections (with scheduling & tenancy) ────
  fastify.get("/", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const now = new Date();

    const where: any = {
      isActive: true,
      deletedAt: null,
      AND: [
        {
          OR: [
            { startDate: null, endDate: null },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: null },
            { startDate: { lte: now }, endDate: { gte: now } },
          ],
        },
      ],
    };

    // Page filtering
    if (query.page) where.page = query.page;

    // Store tenancy filtering
    if (query.storeId) {
      where.AND.push({
        OR: [
          { storeId: null }, // global sections
          { storeId: query.storeId }, // store-specific sections
        ],
      });
    }

    const sections = await prisma.storefrontSection.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return sendSuccess(reply, sections);
  });

  // ─── GET /:id — Get single section ────────────────────────────
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const section = await prisma.storefrontSection.findUnique({
      where: { id },
    });

    if (!section || section.deletedAt) {
      return sendError(reply, "Section not found", 404);
    }

    return sendSuccess(reply, section);
  });
};

export default storefrontRoutes;