import { prisma, type Product, type Prisma } from "@aurazone/database";
import { slugify, buildSku } from "@aurazone/utils";
import crypto from "crypto";
import type { Redis } from "ioredis";
import { logAction } from "./auditLog.service.js";

export async function listProducts(opts?: {
  storeId?: string;
  storeIds?: string[];
  categoryId?: string;
  brand?: string | string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isActive?: boolean;
  includeDeleted?: boolean;
  couponCode?: string;
  sortBy?: string;
  skip?: number;
  take?: number;
  redis?: Redis | null;
}): Promise<{ products: Product[]; total: number }> {
  const cacheKey = opts?.redis
    ? `products:list:${crypto
        .createHash("md5")
        .update(
          JSON.stringify({
            storeId: opts.storeId,
            storeIds: opts.storeIds,
            categoryId: opts.categoryId,
            brand: opts.brand,
            search: opts.search,
            minPrice: opts.minPrice,
            maxPrice: opts.maxPrice,
            inStock: opts.inStock,
            isActive: opts.isActive,
            includeDeleted: opts.includeDeleted,
            couponCode: opts.couponCode,
            sortBy: opts.sortBy,
            skip: opts.skip,
            take: opts.take,
          })
        )
        .digest("hex")}`
    : null;

  if (cacheKey && opts?.redis) {
    try {
      const cached = await opts.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback to database
    }
  }

  const where: Prisma.ProductWhereInput = {};

  // Exclude soft-deleted by default
  if (!opts?.includeDeleted) where.deletedAt = null;

  if (opts?.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: opts.couponCode.toUpperCase() },
      include: { products: { select: { productId: true } } },
    });
    if (coupon) {
      if (coupon.isProductSpecific) {
        where.id = { in: coupon.products.map((p) => p.productId) };
      } else if (coupon.storeId) {
        where.storeId = coupon.storeId;
      }
    }
  }

  if (opts?.storeId) where.storeId = opts.storeId;
  else if (opts?.storeIds) where.storeId = { in: opts.storeIds };
  if (opts?.categoryId) where.categoryId = opts.categoryId;
  if (opts?.isActive !== undefined) where.isActive = opts.isActive;

  if (opts?.brand) {
    const brands = Array.isArray(opts.brand)
      ? opts.brand
      : opts.brand.split(",").map((b) => b.trim()).filter(Boolean);
    if (brands.length > 0) {
      where.brand = { in: brands, mode: "insensitive" };
    }
  }

  const variantFilter: Prisma.ProductVariantListRelationFilter["some"] = {
    isAvailable: true,
    deletedAt: null,
  };

  if (opts?.minPrice !== undefined) {
    variantFilter.price = { ...(variantFilter.price as object || {}), gte: opts.minPrice };
  }
  if (opts?.maxPrice !== undefined) {
    variantFilter.price = { ...(variantFilter.price as object || {}), lte: opts.maxPrice };
  }
  if (opts?.inStock) {
    variantFilter.inventory = { quantity: { gt: 0 } };
  }

  if (opts?.minPrice !== undefined || opts?.maxPrice !== undefined || opts?.inStock) {
    where.variants = { some: variantFilter };
  }

  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { slug: { contains: opts.search, mode: "insensitive" } },
      { brand: { contains: opts.search, mode: "insensitive" } },
      { description: { contains: opts.search, mode: "insensitive" } },
      { tags: { has: opts.search } },
    ];
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: "desc" };
  switch (opts?.sortBy) {
    case "name_asc": orderBy = { name: "asc" }; break;
    case "name_desc": orderBy = { name: "desc" }; break;
    case "newest": orderBy = { createdAt: "desc" }; break;
    case "oldest": orderBy = { createdAt: "asc" }; break;
  }

  // Handle price sorting across product variants
  if (opts?.sortBy === "price_asc" || opts?.sortBy === "price_desc") {
    const [allMatching, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          variants: {
            where: { deletedAt: null },
            orderBy: { price: "asc" },
            include: {
              attributes: true,
              images: { orderBy: { position: "asc" } },
              inventory: true,
            },
          },
          _count: { select: { variants: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const isAsc = opts.sortBy === "price_asc";
    const sorted = allMatching.sort((a, b) => {
      const priceA = Number(a.variants[0]?.price ?? 0);
      const priceB = Number(b.variants[0]?.price ?? 0);
      return isAsc ? priceA - priceB : priceB - priceA;
    });

    const skip = opts?.skip ?? 0;
    const take = opts?.take ?? 24;
    const result = { products: sorted.slice(skip, skip + take), total };
    if (cacheKey && opts?.redis) {
      try {
        await opts.redis.set(cacheKey, JSON.stringify(result), "EX", 120); // 2 min TTL
      } catch {
        // Non-blocking
      }
    }
    return result;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where, orderBy,
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 24,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { deletedAt: null },
          orderBy: { price: "asc" },
          include: {
            attributes: true,
            images: { orderBy: { position: "asc" } },
            inventory: true,
          },
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const result = { products, total };
  if (cacheKey && opts?.redis) {
    try {
      await opts.redis.set(cacheKey, JSON.stringify(result), "EX", 120); // 2 min TTL
    } catch {
      // Non-blocking
    }
  }

  return result;
}

export async function getProductBySlug(slug: string, redis?: Redis | null) {
  const cacheKey = `product:slug:${slug}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback to database
    }
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { deletedAt: null },
        include: {
          attributes: true,
          images: { orderBy: { position: "asc" } },
          inventory: true,
        },
      },
      _count: { select: { variants: true } },
    },
  });
  if (!product || product.deletedAt) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  const now = new Date();
  const applicableCoupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        {
          OR: [
            {
              isProductSpecific: true,
              products: { some: { productId: product.id } },
            },
            {
              isProductSpecific: false,
              OR: [{ storeId: null }, { storeId: product.storeId }],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minOrderValue: true,
      maxDiscount: true,
      endDate: true,
      isProductSpecific: true,
      bannerText: true,
    },
    orderBy: { discountValue: "desc" },
  });

  const result = {
    ...product,
    applicableCoupons,
  };

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), "EX", 300); // 5 min TTL
    } catch {
      // Non-blocking
    }
  }

  return result;
}

export async function getProductById(id: string, redis?: Redis | null) {
  const cacheKey = `product:id:${id}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Fallback
    }
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { deletedAt: null },
        include: {
          attributes: true,
          images: { orderBy: { position: "asc" } },
          inventory: true,
          _count: { select: { orderItems: true } },
        },
      },
      _count: { select: { variants: true } },
    },
  });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(product), "EX", 300); // 5 min TTL
    } catch {
      // Non-blocking
    }
  }

  return product;
}

export async function invalidateProductCache(
  product: { id?: string; slug?: string; storeId?: string },
  redis?: Redis | null
): Promise<void> {
  if (!redis) return;
  try {
    const keysToDelete: string[] = [];
    if (product.id) keysToDelete.push(`product:id:${product.id}`);
    if (product.slug) keysToDelete.push(`product:slug:${product.slug}`);

    // Invalidate list queries via SCAN
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "products:list:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys && keys.length > 0) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    // Also clear search query cache
    cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "search:*", "COUNT", 100);
      cursor = nextCursor;
      if (keys && keys.length > 0) {
        keysToDelete.push(...keys);
      }
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }
  } catch (err) {
    console.error("[ProductCache] Invalidation error:", err);
  }
}

export async function createProduct(
  data: {
    storeId: string;
    categoryId: string;
    name: string;
    slug?: string;
    brand?: string;
    modelNumber?: string;
    gender?: any;
    description?: string;
    shortDescription?: string;
    tags?: string[];
    hasVariants?: boolean;
    isActive?: boolean;
    isFeatured?: boolean;
    variants: Array<{
      sku?: string;
      price: number;
      compareAtPrice?: number;
      attributes?: Array<{ key: string; value: string }>;
      quantity?: number;
      images?: any[];
    }>;
  },
  adminId?: string,
  redis?: Redis | null
): Promise<Product> {
  const [store, category] = await Promise.all([
    prisma.store.findUnique({ where: { id: data.storeId } }),
    prisma.category.findUnique({ where: { id: data.categoryId } }),
  ]);
  if (!store) throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  if (!category) throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  if (category.storeId !== data.storeId) {
    throw Object.assign(new Error("Category does not belong to the selected store"), { statusCode: 400 });
  }

  if (data.name) data.name = data.name.trim();

  const existingName = await prisma.product.findFirst({
    where: { storeId: data.storeId, name: { equals: data.name, mode: "insensitive" } },
  });
  if (existingName) {
    throw Object.assign(new Error("Product name already exists in this store"), { statusCode: 409 });
  }

  const slug = data.slug ?? slugify(data.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) throw Object.assign(new Error("Product slug already taken"), { statusCode: 409 });

  const product = await prisma.product.create({
    data: {
      storeId: data.storeId,
      categoryId: data.categoryId,
      name: data.name,
      slug,
      brand: data.brand ?? null,
      modelNumber: data.modelNumber ?? null,
      gender: data.gender ?? null,
      description: data.description ?? null,
      shortDescription: data.shortDescription ?? null,
      tags: data.tags ?? [],
      hasVariants: data.hasVariants ?? true,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      variants: {
        create: data.variants.map((v: any, i) => ({
          sku: v.sku ?? buildSku(store.slug, slug, String(i)),
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          isAvailable: true,
          attributes: v.attributes
            ? { create: v.attributes.map((a: any) => ({ key: a.key, value: a.value })) }
            : undefined,
          inventory: {
            create: { quantity: v.quantity ?? 0 }
          },
          images: v.images && v.images.length > 0
            ? { create: v.images.map((img: any, idx: number) => ({ url: img.url ?? img, position: idx, altText: data.name })) }
            : undefined
        })),
      },
    },
    include: { variants: { include: { attributes: true } } },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "CREATE",
      entity: "PRODUCT",
      entityId: product.id,
      entityName: product.name,
    });
  }

  await invalidateProductCache({ id: product.id, slug: product.slug, storeId: product.storeId }, redis);

  return product;
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string; slug: string; description: string;
    shortDescription: string; brand: string;
    modelNumber: string; gender: any;
    categoryId: string; storeId: string;
    isActive: boolean; isFeatured: boolean; hasVariants: boolean;
    tags: string[];
    variants?: any[];
  }>,
  adminId?: string,
  redis?: Redis | null
): Promise<Product> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  if (data.name && data.name.trim().toLowerCase() !== product.name.toLowerCase()) {
    const trimmedName = data.name.trim();
    const existingName = await prisma.product.findFirst({
      where: { storeId: product.storeId, name: { equals: trimmedName, mode: "insensitive" } },
    });
    if (existingName) {
      throw Object.assign(new Error("Product name already exists in this store"), { statusCode: 409 });
    }
    data.name = trimmedName; // Update data.name to be trimmed
  }

  if (data.slug && data.slug !== product.slug) {
    const slugTaken = await prisma.product.findUnique({ where: { slug: data.slug } });
    if (slugTaken) throw Object.assign(new Error("Product slug already taken"), { statusCode: 409 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.shortDescription !== undefined && { shortDescription: data.shortDescription }),
      ...(data.brand !== undefined && { brand: data.brand }),
      ...(data.modelNumber !== undefined && { modelNumber: data.modelNumber }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.storeId !== undefined && { storeId: data.storeId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      ...(data.hasVariants !== undefined && { hasVariants: data.hasVariants }),
      ...(data.tags !== undefined && { tags: data.tags }),
    },
    include: { variants: { include: { attributes: true } } },
  });

  if (data.variants) {
    const keepVariantIds = data.variants.filter((v: any) => v.id).map((v: any) => v.id);

    await prisma.productVariant.deleteMany({
      where: {
        productId: id,
        id: { notIn: keepVariantIds },
      },
    });

    for (const [i, v] of data.variants.entries()) {
      if (v.id) {
        await prisma.productVariant.update({
          where: { id: v.id },
          data: {
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            isAvailable: v.isAvailable ?? true,
          }
        });

        if (v.quantity !== undefined) {
          const inv = await prisma.inventory.findUnique({ where: { variantId: v.id } });
          if (inv) {
            await prisma.inventory.update({ where: { variantId: v.id }, data: { quantity: v.quantity } });
          } else {
            await prisma.inventory.create({ data: { variantId: v.id, quantity: v.quantity } });
          }
        }

        if (v.images && Array.isArray(v.images)) {
          await prisma.productImage.deleteMany({ where: { variantId: v.id } });
          if (v.images.length > 0) {
            await prisma.productImage.createMany({
              data: v.images.map((img: any, idx: number) => ({
                variantId: v.id,
                url: img.url ?? img,
                position: idx,
                altText: data.name ?? updated.name ?? "Product Image"
              }))
            });
          }
        }

        if (v.attributes && Array.isArray(v.attributes)) {
          await prisma.productVariantAttribute.deleteMany({ where: { variantId: v.id } });
          if (v.attributes.length > 0) {
            await prisma.productVariantAttribute.createMany({
              data: v.attributes.map((a: any) => ({
                variantId: v.id,
                key: a.key,
                value: a.value,
              }))
            });
          }
        }
      } else {
        await prisma.productVariant.create({
          data: {
            productId: id,
            sku: v.sku ?? `${updated.slug}-${i}-${Date.now()}`,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            isAvailable: v.isAvailable ?? true,
            attributes: v.attributes && v.attributes.length > 0
              ? { create: v.attributes.map((a: any) => ({ key: a.key, value: a.value })) }
              : undefined,
            inventory: {
              create: { quantity: v.quantity ?? 0 }
            },
            images: v.images && v.images.length > 0
              ? { create: v.images.map((img: any, idx: number) => ({ url: img.url ?? img, position: idx, altText: data.name ?? updated.name ?? "Product Image" })) }
              : undefined
          }
        });
      }
    }
  }

  if (adminId) {
    await logAction({
      adminId,
      action: data.isActive !== undefined && data.isActive !== product.isActive ? "TOGGLE_STATUS" : "UPDATE",
      entity: "PRODUCT",
      entityId: id,
      entityName: updated.name,
      changes: { before: { name: product.name, isActive: product.isActive }, after: { name: updated.name, isActive: updated.isActive } },
    });
  }

  await invalidateProductCache({ id: updated.id, slug: updated.slug, storeId: updated.storeId }, redis);
  if (product.slug !== updated.slug) {
    await invalidateProductCache({ slug: product.slug }, redis);
  }

  return updated;
}

export async function deleteProduct(id: string, adminId?: string, redis?: Redis | null): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { _count: { select: { orderItems: true } } } },
    },
  });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  // Soft delete — mark as deleted
  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: adminId ?? null, isActive: false },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "DELETE",
      entity: "PRODUCT",
      entityId: id,
      entityName: product.name,
    });
  }

  await invalidateProductCache({ id: product.id, slug: product.slug, storeId: product.storeId }, redis);
}

export async function restoreProduct(id: string, adminId?: string, redis?: Redis | null): Promise<Product> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  if (!product.deletedAt) {
    throw Object.assign(new Error("Product is not deleted"), { statusCode: 400 });
  }

  const restored = await prisma.product.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null, isActive: true },
    include: { variants: { include: { attributes: true } } },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "RESTORE",
      entity: "PRODUCT",
      entityId: id,
      entityName: restored.name,
    });
  }

  await invalidateProductCache({ id: restored.id, slug: restored.slug, storeId: restored.storeId }, redis);

  return restored;
}

export async function getProductReviews(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  const reviews = await prisma.productReview.findMany({
    where: { productId: product.id, isApproved: true },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, fullName: true, avatar: true } },
    },
  });
  return reviews;
}

export async function addProductReview(slug: string, userId: string, data: { rating: number; body?: string }) {
  if (data.rating < 1 || data.rating > 5) {
    throw Object.assign(new Error("Rating must be between 1 and 5"), { statusCode: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  const existingReview = await prisma.productReview.findUnique({
    where: { productId_userId: { productId: product.id, userId } },
  });
  if (existingReview) {
    throw Object.assign(new Error("You have already reviewed this product"), { statusCode: 409 });
  }

  const review = await prisma.productReview.create({
    data: {
      productId: product.id,
      userId,
      rating: data.rating,
      body: data.body,
    },
  });

  return review;
}

export async function getRelatedProducts(slug: string, limit = 6) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, categoryId: true, storeId: true, tags: true, brand: true },
  });
  if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });

  const related = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      isActive: true,
      deletedAt: null,
      OR: [
        { categoryId: product.categoryId },
        ...(product.brand ? [{ brand: product.brand }] : []),
        ...(product.tags.length > 0 ? [{ tags: { hasSome: product.tags } }] : []),
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { deletedAt: null },
        orderBy: { price: "asc" },
        include: {
          attributes: true,
          images: { orderBy: { position: "asc" } },
          inventory: true,
        },
      },
    },
  });

  return related;
}