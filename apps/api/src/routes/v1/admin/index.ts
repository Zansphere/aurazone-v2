import type { FastifyPluginAsync } from "fastify";
import { storeSchema, categorySchema, productSchema, attributeTemplateSchema, storefrontSectionSchema } from "@aurazone/validators";
import { parsePagination } from "@aurazone/utils";
import { authenticate, requireRole, getManagerStoreIds, assertStoreAccess } from "../../../middleware/auth.js";
import { sendSuccess, sendError, sendPaginated } from "../../../middleware/response.js";
import * as storeService from "../../../services/store.service.js";
import * as categoryService from "../../../services/category.service.js";
import * as productService from "../../../services/product.service.js";
import * as orderService from "../../../services/order.service.js";
import * as attrTemplateService from "../../../services/attributeTemplate.service.js";
import * as auditLogService from "../../../services/auditLog.service.js";
import { prisma, Prisma } from "@aurazone/database";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // All admin routes require authentication + admin role
  fastify.addHook("preHandler", authenticate);
  // fastify.addHook("preHandler", requireRole("SUPER_ADMIN", "STORE_MANAGER"));
  fastify.addHook("preHandler", requireRole("SUPER_ADMIN"));

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  STORES                                                       ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/stores", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const { stores, total } = await storeService.listStores({
      activeOnly: false, search: query.search, skip, take,
      storeIds: allowedStoreIds ?? undefined,
    });
    return sendPaginated(reply, stores, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/stores/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
      if (allowedStoreIds && !allowedStoreIds.includes(id)) {
        return sendError(reply, "You do not have access to this store", 403);
      }
      const store = await storeService.getStoreById(id);
      return sendSuccess(reply, store);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/stores", async (request, reply) => {
    const parsed = storeSchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      const store = await storeService.createStore(parsed.data, request.user!.userId);
      return sendSuccess(reply, store, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.put("/stores/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    if (allowedStoreIds && !allowedStoreIds.includes(id)) {
      return sendError(reply, "You do not have access to this store", 403);
    }
    const parsed = storeSchema.partial().safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      const store = await storeService.updateStore(id, parsed.data, request.user!.userId);
      return sendSuccess(reply, store);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.delete("/stores/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await storeService.deleteStore(id, request.user!.userId);
      return sendSuccess(reply, { message: "Store deleted" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/stores/:id/restore", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const store = await storeService.restoreStore(id, request.user!.userId);
      return sendSuccess(reply, store);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  CATEGORIES                                                   ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/categories", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const storeIdFilter = query.storeId ?? (allowedStoreIds?.length === 1 ? allowedStoreIds[0] : undefined);
    if (allowedStoreIds && storeIdFilter && !allowedStoreIds.includes(storeIdFilter)) {
      return sendError(reply, "You do not have access to this store", 403);
    }
    const { categories, total } = await categoryService.listCategories({
      storeId: storeIdFilter, storeIds: allowedStoreIds ?? undefined, activeOnly: false, search: query.search, skip, take,
    });
    return sendPaginated(reply, categories, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const category = await categoryService.getCategoryById(id);
      await assertStoreAccess(request.user!, category.store?.id);
      return sendSuccess(reply, category);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/categories", async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      await assertStoreAccess(request.user!, parsed.data.storeId);
      const category = await categoryService.createCategory(parsed.data, request.user!.userId);
      return sendSuccess(reply, category, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.put("/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = categorySchema.partial().safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      const existing = await categoryService.getCategoryById(id);
      await assertStoreAccess(request.user!, existing.store?.id);
      const category = await categoryService.updateCategory(id, parsed.data, request.user!.userId);
      return sendSuccess(reply, category);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.delete("/categories/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const existing = await categoryService.getCategoryById(id);
      await assertStoreAccess(request.user!, existing.store?.id);
      await categoryService.deleteCategory(id, request.user!.userId);
      return sendSuccess(reply, { message: "Category deleted" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  PRODUCTS                                                     ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/products", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const storeIdFilter = query.storeId ?? (allowedStoreIds?.length === 1 ? allowedStoreIds[0] : undefined);
    if (allowedStoreIds && storeIdFilter && !allowedStoreIds.includes(storeIdFilter)) {
      return sendError(reply, "You do not have access to this store", 403);
    }
    const { products, total } = await productService.listProducts({
      storeId: storeIdFilter, storeIds: allowedStoreIds ?? undefined,
      categoryId: query.categoryId,
      search: query.search, isActive: undefined, skip, take,
    });
    return sendPaginated(reply, products, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const product = await productService.getProductById(id);
      await assertStoreAccess(request.user!, (product as any).storeId ?? (product as any).store?.id);
      return sendSuccess(reply, product);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/products", async (request, reply) => {
    const parsed = productSchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      await assertStoreAccess(request.user!, parsed.data.storeId);
      const productData = {
          ...parsed.data,
          variants: parsed.data.variants.map((v) => ({
            ...v,
            compareAtPrice: v.compareAtPrice ?? undefined,
          })),
        };
        const product = await productService.createProduct(productData, request.user!.userId);
      return sendSuccess(reply, product, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.put("/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const existing = await productService.getProductById(id);
      await assertStoreAccess(request.user!, (existing as any).storeId ?? (existing as any).store?.id);
      const product = await productService.updateProduct(id, request.body as any, request.user!.userId);
      return sendSuccess(reply, product);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.delete("/products/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const existing = await productService.getProductById(id);
      await assertStoreAccess(request.user!, (existing as any).storeId ?? (existing as any).store?.id);
      await productService.deleteProduct(id, request.user!.userId);
      return sendSuccess(reply, { message: "Product deleted" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  PRODUCT IMAGES                                               ║
  // ╚═══════════════════════════════════════════════════════════════╝

  // Add images to a variant
  fastify.post("/products/:productId/variants/:variantId/images", async (request, reply) => {
    const { productId, variantId } = request.params as { productId: string; variantId: string };
    const { urls } = request.body as { urls: Array<{ url: string; altText?: string; position?: number }> };

    try {
      const product = await productService.getProductById(productId);
      await assertStoreAccess(request.user!, (product as any).storeId ?? (product as any).store?.id);

      // Verify variant belongs to product
      const variant = (product as any).variants?.find((v: any) => v.id === variantId);
      if (!variant) return sendError(reply, "Variant not found", 404);

      // Get current max position
      const existingImages = await prisma.productImage.findMany({
        where: { variantId },
        orderBy: { position: "desc" },
        take: 1,
      });
      let nextPos = existingImages.length > 0 ? existingImages[0].position + 1 : 0;

      const created = await prisma.productImage.createMany({
        data: urls.map((img, i) => ({
          variantId,
          url: img.url,
          altText: img.altText ?? "",
          position: img.position ?? nextPos + i,
        })),
      });

      return sendSuccess(reply, { count: created.count }, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // Delete a variant image
  fastify.delete("/products/:productId/images/:imageId", async (request, reply) => {
    const { productId, imageId } = request.params as { productId: string; imageId: string };

    try {
      const product = await productService.getProductById(productId);
      await assertStoreAccess(request.user!, (product as any).storeId ?? (product as any).store?.id);

      await prisma.productImage.delete({ where: { id: imageId } });
      return sendSuccess(reply, { message: "Image deleted" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  COUPONS                                                      ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/coupons", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    
    const where: any = {};
    if (allowedStoreIds) {
      where.storeId = query.storeId && allowedStoreIds.includes(query.storeId) 
        ? query.storeId 
        : { in: allowedStoreIds };
    } else if (query.storeId) {
      where.storeId = query.storeId;
    }
    
    if (query.search) {
      where.code = { contains: query.search, mode: "insensitive" };
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.coupon.count({ where })
    ]);
    
    return sendPaginated(reply, coupons, total, Math.floor(skip / take) + 1, take);
  });

  fastify.post("/coupons", async (request, reply) => {
    const body = request.body as any;
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    if (allowedStoreIds && body.storeId && !allowedStoreIds.includes(body.storeId)) {
      return sendError(reply, "You do not have access to this store", 403);
    }

    const existing = await prisma.coupon.findUnique({ where: { code: body.code } });
    if (existing) return sendError(reply, "Coupon code already exists", 400);

    const coupon = await prisma.coupon.create({
      data: {
        code: body.code.toUpperCase(),
        description: body.description,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderValue: body.minOrderValue,
        maxDiscount: body.maxDiscount,
        usageLimit: body.usageLimit,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive ?? true,
        storeId: body.storeId || null,
      }
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "CREATE",
      entity: "COUPON",
      entityId: coupon.id,
      entityName: coupon.code,
    });

    return sendSuccess(reply, coupon, 201);
  });

  fastify.put("/coupons/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return sendError(reply, "Coupon not found", 404);

    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    if (allowedStoreIds && existing.storeId && !allowedStoreIds.includes(existing.storeId)) {
      return sendError(reply, "You do not have access to this store", 403);
    }
    if (allowedStoreIds && body.storeId && !allowedStoreIds.includes(body.storeId)) {
      return sendError(reply, "You cannot reassign to this store", 403);
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: body.code?.toUpperCase(),
        description: body.description,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderValue: body.minOrderValue,
        maxDiscount: body.maxDiscount,
        usageLimit: body.usageLimit,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
        isActive: body.isActive,
        storeId: body.storeId !== undefined ? body.storeId : undefined,
      }
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "UPDATE",
      entity: "COUPON",
      entityId: coupon.id,
      entityName: coupon.code,
    });

    return sendSuccess(reply, coupon);
  });

  fastify.delete("/coupons/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return sendError(reply, "Coupon not found", 404);

    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    if (allowedStoreIds && existing.storeId && !allowedStoreIds.includes(existing.storeId)) {
      return sendError(reply, "You do not have access to this store", 403);
    }

    await prisma.coupon.delete({ where: { id } });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "DELETE",
      entity: "COUPON",
      entityId: id,
      entityName: existing.code,
    });

    return sendSuccess(reply, { message: "Coupon deleted" });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  ATTRIBUTE TEMPLATES                                          ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/attribute-templates", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const { templates, total } = await attrTemplateService.listAttributeTemplates({
      storeId: query.storeId, categoryId: query.categoryId, skip, take,
    });
    return sendPaginated(reply, templates, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/attribute-templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const template = await attrTemplateService.getAttributeTemplateById(id);
      return sendSuccess(reply, template);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/attribute-templates", async (request, reply) => {
    const parsed = attributeTemplateSchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      const template = await attrTemplateService.createAttributeTemplate(parsed.data);
      return sendSuccess(reply, template, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.put("/attribute-templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = attributeTemplateSchema.partial().safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);
    try {
      const template = await attrTemplateService.updateAttributeTemplate(id, parsed.data);
      return sendSuccess(reply, template);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.delete("/attribute-templates/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await attrTemplateService.deleteAttributeTemplate(id);
      return sendSuccess(reply, { message: "Attribute template deleted" });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  AUDIT LOGS                                                   ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/audit-logs", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const { logs, total } = await auditLogService.getAuditLogs({
      entity: query.entity,
      entityId: query.entityId,
      adminId: query.adminId,
      skip,
      take,
    });
    return sendPaginated(reply, logs, total, Math.floor(skip / take) + 1, take);
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  ORDERS                                                       ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/orders", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: "insensitive" } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
      ];
    }
    // Scope to orders containing items from the manager's stores
    if (allowedStoreIds) {
      where.items = { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take,
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          items: { 
            include: { 
              variant: { 
                include: { 
                  product: { select: { name: true } },
                  images: { take: 1, orderBy: { position: 'asc' } }
                }
              }
            } 
          },
          orderAddress: true,
          payments: { select: { status: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return sendPaginated(reply, orders, total, Math.floor(skip / take) + 1, take);
  });

  fastify.get("/orders/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const order = await orderService.getOrderById(id);
      const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
      if (allowedStoreIds) {
        const orderStoreIds = (order.items as any[]).map((i: any) => i.variant?.product?.storeId).filter(Boolean);
        if (!orderStoreIds.some((sid: string) => allowedStoreIds.includes(sid))) {
          return sendError(reply, "You do not have access to this order", 403);
        }
        // Filter items to only those belonging to the manager's stores
        const filteredItems = (order.items as any[]).filter((i: any) => {
          const storeId = i.variant?.product?.storeId;
          return storeId && allowedStoreIds.includes(storeId);
        });
        return sendSuccess(reply, { ...order, items: filteredItems });
      }
      return sendSuccess(reply, order);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.patch("/orders/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    if (!status) return sendError(reply, "status is required", 400);

    try {
      const order = await orderService.getOrderById(id);
      const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);

      if (allowedStoreIds) {
        const orderStoreIds = (order.items as any[]).map((i: any) => i.variant?.product?.storeId).filter(Boolean);
        
        // A manager must have access to ALL stores represented in the order to change its global status
        const hasAccessToAll = orderStoreIds.every((sid: string) => allowedStoreIds.includes(sid));
        if (!hasAccessToAll) {
          return sendError(reply, "You can only update status for orders containing exclusively your store's items", 403);
        }
      }

      const updatedOrder = await orderService.updateOrderStatus(id, status, request.user!.userId);
      return sendSuccess(reply, updatedOrder);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  STOREFRONT CMS                                               ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/storefront", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const where: any = { deletedAt: null };
    if (query.page) where.page = query.page;
    if (query.storeId) {
      if (allowedStoreIds && !allowedStoreIds.includes(query.storeId)) {
        return sendError(reply, "You do not have access to this store", 403);
      }
      where.storeId = query.storeId;
    } else if (allowedStoreIds) {
      where.storeId = { in: allowedStoreIds };
    }

    const sections = await prisma.storefrontSection.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });
    return sendSuccess(reply, sections);
  });

  fastify.post("/storefront", async (request, reply) => {
    const parsed = storefrontSectionSchema.safeParse(request.body);
    if (!parsed.success) return sendError(reply, parsed.error.errors[0].message, 400);

    await assertStoreAccess(request.user!, parsed.data.storeId);

    // STORE_MANAGER must specify a storeId — they cannot create global content
    if (request.user!.role === "STORE_MANAGER" && !parsed.data.storeId) {
      return sendError(reply, "Store managers must specify a storeId for storefront content", 400);
    }

    const section = await prisma.storefrontSection.create({
      data: {
        storeId: parsed.data.storeId ?? null,
        page: parsed.data.page ?? "home",
        type: parsed.data.type as any,
        title: parsed.data.title ?? null,
        subtitle: parsed.data.subtitle ?? null,
        content: (parsed.data.content ?? {}) as any,
        sortOrder: parsed.data.sortOrder ?? 0,
        isActive: parsed.data.isActive ?? true,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "CREATE",
      entity: "STOREFRONT_SECTION",
      entityId: section.id,
      entityName: section.title ?? section.type,
    });

    return sendSuccess(reply, section, 201);
  });

  fastify.put("/storefront/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await prisma.storefrontSection.findUnique({ where: { id } });
    if (!existing) return sendError(reply, "Section not found", 404);
    await assertStoreAccess(request.user!, existing.storeId);
    const section = await prisma.storefrontSection.update({
      where: { id },
      data: {
        ...(body.type !== undefined && { type: body.type as any }),
        ...(body.title !== undefined && { title: body.title as string }),
        ...(body.subtitle !== undefined && { subtitle: body.subtitle as string }),
        ...(body.content !== undefined && { content: body.content as any }),
        ...(body.config !== undefined && { content: body.config as any }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder as number }),
        ...(body.isActive !== undefined && { isActive: body.isActive as boolean }),
        ...(body.page !== undefined && { page: body.page as string }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate as string) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate as string) : null }),
      },
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "UPDATE",
      entity: "STOREFRONT_SECTION",
      entityId: section.id,
      entityName: section.title ?? section.type,
    });

    return sendSuccess(reply, section);
  });

  // Batch reorder sections
  fastify.patch("/storefront/reorder", async (request, reply) => {
    const { items } = request.body as { items: Array<{ id: string; sortOrder: number }> };
    if (!items || !Array.isArray(items)) return sendError(reply, "items array required", 400);

    await Promise.all(
      items.map((item) =>
        prisma.storefrontSection.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return sendSuccess(reply, { message: "Reorder complete" });
  });

  // Duplicate a section
  fastify.post("/storefront/:id/duplicate", async (request, reply) => {
    const { id } = request.params as { id: string };
    const original = await prisma.storefrontSection.findUnique({ where: { id } });
    if (!original) return sendError(reply, "Section not found", 404);

    const duplicate = await prisma.storefrontSection.create({
      data: {
        storeId: original.storeId,
        page: original.page,
        type: original.type,
        title: original.title ? `${original.title} (Copy)` : null,
        subtitle: original.subtitle,
        content: original.content as any,
        sortOrder: original.sortOrder + 1,
        isActive: false,
        startDate: original.startDate,
        endDate: original.endDate,
      },
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "CREATE",
      entity: "STOREFRONT_SECTION",
      entityId: duplicate.id,
      entityName: `Duplicated: ${original.title ?? original.type}`,
    });

    return sendSuccess(reply, duplicate, 201);
  });

  fastify.delete("/storefront/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const section = await prisma.storefrontSection.findUnique({ where: { id } });
    if (!section) return sendError(reply, "Section not found", 404);

    await assertStoreAccess(request.user!, section.storeId);

    // Soft delete
    await prisma.storefrontSection.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: request.user!.userId, isActive: false },
    });

    await auditLogService.logAction({
      adminId: request.user!.userId,
      action: "DELETE",
      entity: "STOREFRONT_SECTION",
      entityId: id,
      entityName: section.title ?? section.type,
    });

    return sendSuccess(reply, { message: "Section deleted" });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  DASHBOARD STATS                                              ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/dashboard", async (request, reply) => {
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const storeWhere = allowedStoreIds ? { id: { in: allowedStoreIds } } : {};
    const productWhere = allowedStoreIds ? { storeId: { in: allowedStoreIds } } : {};
    const orderWhere = allowedStoreIds ? { items: { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } } } : {};

    const [
      totalStores, totalProducts, totalOrders, totalUsers,
      recentOrders, ordersByStatus,
    ] = await Promise.all([
      prisma.store.count({ where: { isActive: true, deletedAt: null, ...storeWhere } }),
      prisma.product.count({ where: { isActive: true, deletedAt: null, ...productWhere } }),
      prisma.order.count({ where: orderWhere }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.findMany({
        where: orderWhere,
        take: 10, orderBy: { createdAt: "desc" },
        include: {
          user: { select: { fullName: true, email: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: orderWhere,
        _count: { id: true },
      }),
    ]);

    return sendSuccess(reply, {
      stats: { totalStores, totalProducts, totalOrders, totalUsers },
      recentOrders,
      ordersByStatus: ordersByStatus.map((g) => ({
        status: g.status,
        count: g._count.id,
      })),
    });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  INVENTORY                                                     ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/inventory", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);

    const where: any = {
      variant: {
        deletedAt: null,
        product: { deletedAt: null, ...(allowedStoreIds && { storeId: { in: allowedStoreIds } }) },
      },
    };
    
    if (query.search) {
      where.variant = {
        ...where.variant,
        OR: [
          { sku: { contains: query.search, mode: "insensitive" } },
          { product: { name: { contains: query.search, mode: "insensitive" } } },
        ],
      };
    }
    if (query.lowStock === "true") {
      where.quantity = { lte: 10 };
    }

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip,
        take,
        orderBy: [{ quantity: "asc" }, { updatedAt: "desc" }],
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, slug: true } },
              images: { take: 1, orderBy: { position: "asc" } },
            },
          },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    return sendPaginated(reply, items.map(item => ({
      ...item,
      lowStockThreshold: 10,
    })), total, Math.floor(skip / take) + 1, take);
  });

  fastify.patch("/inventory/:variantId", async (request, reply) => {
    const { variantId } = request.params as { variantId: string };
    const { quantity, type, note } = request.body as { quantity: number; type?: string; note?: string };

    if (quantity === undefined || quantity === null) return sendError(reply, "quantity is required", 400);

    try {
      const inv = await prisma.inventory.findUnique({ 
        where: { variantId },
        include: { variant: { include: { product: true } } }
      });
      if (!inv) return sendError(reply, "Inventory not found", 404);
      
      await assertStoreAccess(request.user!, inv.variant.product.storeId);

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.inventory.update({
          where: { variantId },
          data: { quantity },
        });

        await tx.inventoryLog.create({
          data: {
            variantId,
            quantity: quantity - inv.quantity,
            type: (type as any) ?? "MANUAL",
            performedBy: request.user!.userId,
            note: note ?? `Stock adjusted from ${inv.quantity} to ${quantity}`,
          },
        });

        return result;
      });

      await auditLogService.logAction({
        adminId: request.user!.userId,
        action: "UPDATE",
        entity: "INVENTORY",
        entityId: variantId,
        entityName: `Stock: ${inv.quantity} → ${quantity}`,
      });

      return sendSuccess(reply, updated);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  SHIPMENTS                                                     ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/shipments", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);

    const where: any = { deletedAt: null };
    if (allowedStoreIds) {
      where.order = { items: { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } } };
    }
    
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { trackingNumber: { contains: query.search, mode: "insensitive" } },
        { order: { ...where.order, orderNumber: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.orderShipment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
      }),
      prisma.orderShipment.count({ where }),
    ]);

    return sendPaginated(reply, shipments, total, Math.floor(skip / take) + 1, take);
  });

  fastify.patch("/shipments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    try {
      const existing = await prisma.orderShipment.findUnique({ 
        where: { id },
        include: { order: { include: { items: { include: { variant: { include: { product: true } } } } } } }
      });
      if (!existing) return sendError(reply, "Shipment not found", 404);

      const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
      if (allowedStoreIds) {
        const orderStoreIds = existing.order.items.map(i => i.variant?.product?.storeId).filter(Boolean);
        if (!orderStoreIds.some(sid => allowedStoreIds.includes(sid))) {
          return sendError(reply, "You do not have access to this shipment", 403);
        }
      }

      const data: any = {};
      if (body.status !== undefined) data.status = body.status;
      if (body.courierName !== undefined) data.courierName = body.courierName;
      if (body.trackingNumber !== undefined) data.trackingNumber = body.trackingNumber;
      if (body.trackingUrl !== undefined) data.trackingUrl = body.trackingUrl;
      if (body.status === "SHIPPED" && !existing.shippedAt) data.shippedAt = new Date();
      if (body.status === "DELIVERED" && !existing.deliveredAt) data.deliveredAt = new Date();

      const updated = await prisma.orderShipment.update({ where: { id }, data });

      if (body.status && body.status !== existing.status) {
        await prisma.shipmentLog.create({
          data: {
            orderId: existing.orderId,
            shipmentId: id,
            adminId: request.user!.userId,
            action: "STATUS_UPDATE",
            fromStatus: existing.status,
            toStatus: body.status as any,
            courierName: updated.courierName,
            trackingNumber: updated.trackingNumber,
            note: `Shipment status: ${existing.status} → ${body.status}`,
          },
        });
      }

      return sendSuccess(reply, updated);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  fastify.post("/shipments", async (request, reply) => {
    const body = request.body as {
      orderId: string;
      courierName?: string;
      trackingNumber?: string;
      trackingUrl?: string;
    };

    if (!body.orderId) return sendError(reply, "orderId is required", 400);

    try {
      const order = await prisma.order.findUnique({ where: { id: body.orderId } });
      if (!order) return sendError(reply, "Order not found", 404);

      const shipment = await prisma.orderShipment.create({
        data: {
          orderId: body.orderId,
          courierName: body.courierName ?? null,
          trackingNumber: body.trackingNumber ?? null,
          trackingUrl: body.trackingUrl ?? null,
          status: "PENDING",
        },
      });

      await prisma.shipmentLog.create({
        data: {
          orderId: body.orderId,
          shipmentId: shipment.id,
          adminId: request.user!.userId,
          action: "CREATED",
          toStatus: "PENDING",
          note: `Shipment created for order ${order.orderNumber}`,
        },
      });

      return sendSuccess(reply, shipment, 201);
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      return sendError(reply, error.message, error.statusCode ?? 500);
    }
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  NOTIFICATIONS                                                 ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/notifications", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);

    const where: any = { userId: request.user!.userId };
    if (query.unreadOnly === "true") where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notificationHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.notificationHistory.count({ where }),
      prisma.notificationHistory.count({ where: { userId: request.user!.userId, isRead: false } }),
    ]);

    return sendSuccess(reply, { notifications, total, unreadCount });
  });

  fastify.patch("/notifications/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.notificationHistory.update({
      where: { id },
      data: { isRead: true },
    });
    return sendSuccess(reply, { message: "Marked as read" });
  });

  fastify.patch("/notifications/read-all", async (request, reply) => {
    await prisma.notificationHistory.updateMany({
      where: { userId: request.user!.userId, isRead: false },
      data: { isRead: true },
    });
    return sendSuccess(reply, { message: "All marked as read" });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  CUSTOMERS                                                     ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/customers", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);

    const where: any = { role: "CUSTOMER" };
    if (allowedStoreIds) {
      where.orders = { some: { items: { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } } } };
    }
    
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          avatar: true,
          isActive: true,
          isEmailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return sendPaginated(reply, customers, total, Math.floor(skip / take) + 1, take);
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  ANALYTICS                                                     ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/analytics", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const daysBack = parseInt(query.days ?? "30", 10);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const allowedStoreIds = await getManagerStoreIds(request.user!.userId, request.user!.role);
    const orderWhere = allowedStoreIds ? { items: { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } } } : {};

    const [
      totalRevenue,
      ordersByStatus,
      revenueByDay,
      topProducts,
      topStores,
      customerStats,
    ] = await Promise.all([
      // Total revenue (delivered/success only)
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { in: ["DELIVERED", "SUCCESS"] }, createdAt: { gte: since }, ...orderWhere },
      }),

      // Orders by status
      prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalAmount: true },
        where: { createdAt: { gte: since }, ...orderWhere },
      }),

      // Revenue by day (last N days)
      allowedStoreIds && allowedStoreIds.length > 0
        ? prisma.$queryRaw<Array<{ day: string; revenue: number; orders: number }>>`
            SELECT DATE(o.created_at) as day,
                   COALESCE(SUM(o.total_amount), 0)::float as revenue,
                   COUNT(DISTINCT o.id)::int as orders
            FROM "Order" o
            JOIN "OrderItem" oi ON o.id = oi.order_id
            JOIN "ProductVariant" pv ON oi.variant_id = pv.id
            JOIN "Product" p ON pv.product_id = p.id
            WHERE o.created_at >= ${since} AND p.store_id IN (${Prisma.join(allowedStoreIds)})
            GROUP BY DATE(o.created_at)
            ORDER BY day ASC`
        : prisma.$queryRaw<Array<{ day: string; revenue: number; orders: number }>>`
            SELECT DATE(o.created_at) as day,
                   COALESCE(SUM(o.total_amount), 0)::float as revenue,
                   COUNT(DISTINCT o.id)::int as orders
            FROM "Order" o
            WHERE o.created_at >= ${since}
            GROUP BY DATE(o.created_at)
            ORDER BY day ASC`,

      // Top products by order count
      prisma.orderItem.groupBy({
        by: ["productName", "storeName"],
        where: allowedStoreIds ? { variant: { product: { storeId: { in: allowedStoreIds } } } } : undefined,
        _count: { id: true },
        _sum: { subtotal: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),

      // Revenue per store
      prisma.orderItem.groupBy({
        by: ["storeName"],
        where: allowedStoreIds ? { variant: { product: { storeId: { in: allowedStoreIds } } } } : undefined,
        _count: { id: true },
        _sum: { subtotal: true },
        orderBy: { _sum: { subtotal: "desc" } },
        take: 10,
      }),

      // Customer growth
      prisma.user.count({
        where: { role: "CUSTOMER", createdAt: { gte: since }, ...(allowedStoreIds ? { orders: { some: { items: { some: { variant: { product: { storeId: { in: allowedStoreIds } } } } } } } } : {}) },
      }),
    ]);

    return sendSuccess(reply, {
      period: { days: daysBack, since: since.toISOString() },
      totalRevenue: totalRevenue._sum.totalAmount ?? 0,
      ordersByStatus: ordersByStatus.map((g) => ({
        status: g.status,
        count: g._count.id,
        revenue: g._sum.totalAmount ?? 0,
      })),
      revenueByDay,
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        store: p.storeName,
        orders: p._count.id,
        revenue: p._sum.subtotal ?? 0,
      })),
      topStores: topStores.map((s) => ({
        name: s.storeName,
        orders: s._count.id,
        revenue: s._sum.subtotal ?? 0,
      })),
      newCustomers: customerStats,
    });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  ADMIN PROFILE & SETTINGS                                      ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/profile", async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: {
        id: true, email: true, fullName: true, avatar: true,
        role: true, phone: true, isActive: true,
        lastLoginAt: true, createdAt: true,
        notificationPreferences: true,
      },
    });
    if (!user) return sendError(reply, "User not found", 404);
    return sendSuccess(reply, user);
  });

  fastify.put("/profile", async (request, reply) => {
    const body = request.body as { fullName?: string; avatar?: string; phone?: string };
    const updated = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        ...(body.fullName !== undefined && { fullName: body.fullName }),
        ...(body.avatar !== undefined && { avatar: body.avatar }),
        ...(body.phone !== undefined && { phone: body.phone }),
      },
      select: {
        id: true, email: true, fullName: true, avatar: true,
        role: true, phone: true, createdAt: true,
      },
    });
    return sendSuccess(reply, updated);
  });

  fastify.put("/profile/password", async (request, reply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    if (!currentPassword || !newPassword) return sendError(reply, "Both passwords are required", 400);
    if (newPassword.length < 8) return sendError(reply, "Password must be at least 8 characters", 400);

    const user = await prisma.user.findUnique({ where: { id: request.user!.userId } });
    if (!user?.password) return sendError(reply, "Password not set", 400);

    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return sendError(reply, "Current password is incorrect", 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return sendSuccess(reply, { message: "Password updated" });
  });

  fastify.get("/notification-preferences", async (request, reply) => {
    let prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: request.user!.userId },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreferences.create({
        data: { userId: request.user!.userId },
      });
    }
    return sendSuccess(reply, prefs);
  });

  fastify.put("/notification-preferences", async (request, reply) => {
    const body = request.body as Record<string, boolean>;
    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId: request.user!.userId },
      create: { userId: request.user!.userId, ...body },
      update: body,
    });
    return sendSuccess(reply, prefs);
  });

  // Admin sessions
  fastify.get("/sessions", async (request, reply) => {
    const sessions = await prisma.userSession.findMany({
      where: { userId: request.user!.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return sendSuccess(reply, sessions);
  });

  fastify.delete("/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.userSession.deleteMany({
      where: { id, userId: request.user!.userId },
    });
    return sendSuccess(reply, { message: "Session revoked" });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  REVIEWS MODERATION                                           ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/reviews", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const where: any = {};

    if (query.status === "APPROVED") where.isApproved = true;
    else if (query.status === "PENDING") where.isApproved = false;

    if (query.search) {
      where.OR = [
        { product: { name: { contains: query.search, mode: "insensitive" } } },
        { user: { fullName: { contains: query.search, mode: "insensitive" } } },
        { body: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, email: true, avatar: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.productReview.count({ where }),
    ]);

    return sendPaginated(reply, reviews, total, Math.floor(skip / take) + 1, take);
  });

  fastify.put("/reviews/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const review = await prisma.productReview.update({
      where: { id },
      data: { isApproved: true },
    });
    return sendSuccess(reply, review);
  });

  fastify.put("/reviews/:id/reject", async (request, reply) => {
    const { id } = request.params as { id: string };
    const review = await prisma.productReview.update({
      where: { id },
      data: { isApproved: false },
    });
    return sendSuccess(reply, review);
  });

  fastify.delete("/reviews/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.productReview.delete({ where: { id } });
    return sendSuccess(reply, { message: "Review deleted successfully" });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  PAYMENTS & REFUNDS                                           ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/payments", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const { skip, take } = parsePagination(query.skip, query.take);
    const where: any = {};

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: "insensitive" } },
        { razorpayPaymentId: { contains: query.search, mode: "insensitive" } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          createdAt: true,
          user: { select: { fullName: true, email: true } },
          orderAddress: { select: { name: true, phone: true } },
          payments: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { id: true, gateway: true, gatewayPaymentId: true, amount: true, status: true, paidAt: true },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return sendPaginated(reply, orders, total, Math.floor(skip / take) + 1, take);
  });

  fastify.post("/payments/:id/refund", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string; amount?: number } | undefined;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) return sendError(reply, "Order not found", 404);
    if (order.paymentStatus === "REFUNDED") {
      return sendError(reply, "Order payment is already refunded", 400);
    }

    const refundAmount = body?.amount ?? Number(order.totalAmount);
    const reason = body?.reason ?? "Customer requested refund (Admin initiated)";

    const updated = await prisma.$transaction(async (tx) => {
      const ord = await tx.order.update({
        where: { id },
        data: {
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
        },
      });

      if (order.payments.length > 0) {
        await tx.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: "REFUNDED",
            note: reason,
          },
        });
      }

      await tx.paymentLog.create({
        data: {
          orderId: id,
          event: "PAYMENT_REFUNDED",
          status: "SUCCESS",
          gateway: order.paymentMethod,
          message: `Admin initiated refund of ₹${refundAmount}. Reason: ${reason}`,
          metadata: { amount: refundAmount, reason, adminUserId: request.user!.userId },
        },
      });

      return ord;
    });

    return sendSuccess(reply, {
      message: "Refund processed successfully",
      order: updated,
    });
  });

  // ╔═══════════════════════════════════════════════════════════════╗
  // ║  CSV EXPORT REPORTING                                         ║
  // ╚═══════════════════════════════════════════════════════════════╝

  fastify.get("/export/orders", async (request, reply) => {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, email: true } },
        orderAddress: { select: { name: true, city: true, state: true } },
        _count: { select: { items: true } },
      },
      take: 1000,
    });

    const headers = ["Order Number", "Date", "Customer Name", "Customer Email", "Status", "Payment Status", "Payment Method", "Items Count", "Total Amount (INR)"];
    const rows = orders.map((o) => [
      `"${o.orderNumber}"`,
      `"${o.createdAt.toISOString()}"`,
      `"${(o.orderAddress?.name || o.user?.fullName || "Guest").replace(/"/g, '""')}"`,
      `"${(o.user?.email || "").replace(/"/g, '""')}"`,
      `"${o.status}"`,
      `"${o.paymentStatus}"`,
      `"${o.paymentMethod}"`,
      o._count.items,
      Number(o.totalAmount).toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="aurazone_orders_export.csv"');
    return reply.send(csvContent);
  });

  fastify.get("/export/customers", async (request, reply) => {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      take: 1000,
    });

    const headers = ["Customer ID", "Full Name", "Email", "Phone", "Orders Count", "Joined Date"];
    const rows = customers.map((c) => [
      `"${c.id}"`,
      `"${(c.fullName || "").replace(/"/g, '""')}"`,
      `"${c.email.replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      c._count.orders,
      `"${c.createdAt.toISOString()}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="aurazone_customers_export.csv"');
    return reply.send(csvContent);
  });

  fastify.get("/export/inventory", async (request, reply) => {
    const variants = await prisma.productVariant.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, brand: true, store: { select: { name: true } } } },
        inventory: true,
      },
      take: 1000,
    });

    const headers = ["SKU", "Product Name", "Brand", "Store", "Price (INR)", "Stock Quantity", "Reserved", "Available", "Status"];
    const rows = variants.map((v) => {
      const qty = v.inventory?.quantity ?? 0;
      const res = v.inventory?.reserved ?? 0;
      return [
        `"${v.sku}"`,
        `"${v.product.name.replace(/"/g, '""')}"`,
        `"${(v.product.brand || "").replace(/"/g, '""')}"`,
        `"${v.product.store.name.replace(/"/g, '""')}"`,
        Number(v.price).toFixed(2),
        qty,
        res,
        Math.max(0, qty - res),
        `"${v.isAvailable ? "ACTIVE" : "INACTIVE"}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="aurazone_inventory_export.csv"');
    return reply.send(csvContent);
  });
};

export default adminRoutes;