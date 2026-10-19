import { prisma, type Product, type Prisma } from "@aurazone/database";
import type { Redis } from "ioredis";

export interface SearchFacetItem {
  name: string;
  count: number;
  id?: string;
  slug?: string;
}

export interface SearchFacets {
  brands: SearchFacetItem[];
  categories: SearchFacetItem[];
  priceRange: { min: number; max: number };
  inStockCount: number;
}

export interface SearchResultItem {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  shortDescription: string | null;
  tags: string[];
  relevanceScore?: number;
  category: { id: string; name: string; slug: string };
  store: { id: string; name: string; slug: string };
  minPrice: number;
  maxPrice: number;
  hasDiscount: boolean;
  maxDiscountPercent: number;
  inStock: boolean;
  totalStock: number;
  primaryImage: string | null;
  variants: any[];
  avgRating?: number;
  reviewCount?: number;
  createdAt: Date;
}

export interface SearchResults {
  query: string;
  products: SearchResultItem[];
  total: number;
  facets: SearchFacets;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LiveSuggestion {
  suggestions: string[];
  products: Array<{
    id: string;
    name: string;
    slug: string;
    brand: string | null;
    price: number;
    compareAtPrice: number | null;
    primaryImage: string | null;
    storeName: string;
    categoryName: string;
  }>;
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  brands: Array<{ name: string; count: number }>;
}

export class SearchService {
  /**
   * Fast autocomplete and live suggestions (Elasticsearch-like instant suggestions)
   */
  static async getLiveSuggestions(
    rawQuery: string,
    redis?: Redis | null,
    limit = 6
  ): Promise<LiveSuggestion> {
    const q = rawQuery.trim().toLowerCase();
    if (!q || q.length < 2) {
      return { suggestions: [], products: [], categories: [], brands: [] };
    }

    const cacheKey = `cache:search:suggest:${q}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // Continue on cache miss/error
      }
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    // Parallel search across products, categories, and brands
    const [matchingProducts, matchingCategories, matchingBrands] = await Promise.all([
      // Top matching products
      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { tags: { hasSome: tokens } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          brand: true,
          store: { select: { name: true } },
          category: { select: { name: true } },
          variants: {
            where: { isAvailable: true, deletedAt: null },
            orderBy: { price: "asc" },
            take: 1,
            select: {
              price: true,
              compareAtPrice: true,
              images: { take: 1, orderBy: { position: "asc" }, select: { url: true } },
            },
          },
        },
      }),

      // Matching categories
      prisma.category.findMany({
        where: {
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        take: 4,
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { isActive: true, deletedAt: null } } } },
        },
      }),

      // Matching distinct brands
      prisma.product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          brand: { contains: q, mode: "insensitive" },
        },
        select: { brand: true },
        distinct: ["brand"],
        take: 4,
      }),
    ]);

    // Build query suggestion strings
    const suggestionsSet = new Set<string>();

    for (const p of matchingProducts) {
      suggestionsSet.add(p.name);
      if (p.brand && p.brand.toLowerCase().includes(q)) {
        suggestionsSet.add(p.brand);
      }
    }

    for (const c of matchingCategories) {
      suggestionsSet.add(`${q} in ${c.name}`);
      suggestionsSet.add(c.name);
    }

    const formattedProducts = matchingProducts.map((p) => {
      const v = p.variants[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        price: v ? Number(v.price) : 0,
        compareAtPrice: v?.compareAtPrice ? Number(v.compareAtPrice) : null,
        primaryImage: v?.images[0]?.url ?? null,
        storeName: p.store.name,
        categoryName: p.category.name,
      };
    });

    const formattedCategories = matchingCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
    }));

    const formattedBrands = matchingBrands
      .filter((b): b is { brand: string } => !!b.brand)
      .map((b) => ({ name: b.brand, count: 1 }));

    const result: LiveSuggestion = {
      suggestions: Array.from(suggestionsSet).slice(0, 8),
      products: formattedProducts,
      categories: formattedCategories,
      brands: formattedBrands,
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

  /**
   * Full Elasticsearch-style search with multi-field weighting, relevance ranking, and facets
   */
  static async search(opts: {
    q?: string;
    storeId?: string;
    storeSlug?: string;
    categoryId?: string;
    categorySlug?: string;
    brand?: string | string[];
    couponCode?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sortBy?: "relevance" | "price_asc" | "price_desc" | "newest" | "oldest" | "name_asc" | "name_desc";
    skip?: number;
    take?: number;
    redis?: Redis | null;
  }): Promise<SearchResults> {
    const rawQuery = (opts.q ?? "").trim();
    const query = rawQuery.toLowerCase();
    const skip = Math.max(0, opts.skip ?? 0);
    const take = Math.min(100, Math.max(1, opts.take ?? 24));
    const sortBy = opts.sortBy ?? (query ? "relevance" : "newest");

    // Build Prisma base filter
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    if (opts.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: opts.couponCode.toUpperCase() },
        include: { products: { select: { productId: true } } },
      });
      if (coupon) {
        if (coupon.isProductSpecific) {
          const productIds = coupon.products.map((p) => p.productId);
          where.id = { in: productIds };
        } else if (coupon.storeId) {
          where.storeId = coupon.storeId;
        }
      }
    }

    if (opts.storeId) where.storeId = opts.storeId;
    if (opts.storeSlug) where.store = { slug: opts.storeSlug };
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.categorySlug) where.category = { slug: opts.categorySlug };

    // Brand filter (supports comma-separated string or array)
    if (opts.brand) {
      const brands = Array.isArray(opts.brand)
        ? opts.brand
        : opts.brand.split(",").map((b) => b.trim()).filter(Boolean);
      if (brands.length > 0) {
        where.brand = { in: brands, mode: "insensitive" };
      }
    }

    // Price filter
    if (opts.minPrice !== undefined || opts.maxPrice !== undefined) {
      where.variants = {
        some: {
          isAvailable: true,
          deletedAt: null,
          ...(opts.minPrice !== undefined && { price: { gte: opts.minPrice } }),
          ...(opts.maxPrice !== undefined && { price: { lte: opts.maxPrice } }),
        },
      };
    }

    // Stock availability filter
    if (opts.inStock) {
      where.variants = {
        ...((where.variants as any) || {}),
        some: {
          ...((where.variants as any)?.some || {}),
          isAvailable: true,
          deletedAt: null,
          inventory: { quantity: { gt: 0 } },
        },
      };
    }

    // Query terms tokenization
    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];

    if (query && tokens.length > 0) {
      where.OR = [
        // Name contains full string
        { name: { contains: query, mode: "insensitive" } },
        // Brand contains
        { brand: { contains: query, mode: "insensitive" } },
        // Category contains
        { category: { name: { contains: query, mode: "insensitive" } } },
        // Store contains
        { store: { name: { contains: query, mode: "insensitive" } } },
        // Tags array match
        { tags: { hasSome: tokens } },
        // Description contains
        { description: { contains: query, mode: "insensitive" } },
        // Short description contains
        { shortDescription: { contains: query, mode: "insensitive" } },
        // Token in variants attributes (e.g. Color: Red, Size: XL)
        {
          variants: {
            some: {
              attributes: {
                some: {
                  value: { contains: query, mode: "insensitive" },
                },
              },
            },
          },
        },
      ];
    }

    // Database query
    const rawProducts = await prisma.product.findMany({
      where,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        reviews: { where: { isApproved: true }, select: { rating: true } },
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
      // When sorting by standard DB column, we can do it at SQL level
      orderBy:
        sortBy === "newest"
          ? { createdAt: "desc" }
          : sortBy === "oldest"
          ? { createdAt: "asc" }
          : sortBy === "name_asc"
          ? { name: "asc" }
          : sortBy === "name_desc"
          ? { name: "desc" }
          : { createdAt: "desc" },
    });

    // Score and transform results
    const scoredProducts: SearchResultItem[] = rawProducts.map((p) => {
      let score = 0;
      const lowerName = p.name.toLowerCase();
      const lowerBrand = (p.brand ?? "").toLowerCase();
      const lowerCategory = p.category.name.toLowerCase();
      const lowerStore = p.store.name.toLowerCase();
      const lowerDesc = (p.description ?? "").toLowerCase();
      const tagsList = p.tags.map((t) => t.toLowerCase());

      if (query) {
        // 1. Exact name match
        if (lowerName === query) score += 100;
        // 2. Name starts with query
        else if (lowerName.startsWith(query)) score += 60;
        // 3. Name contains query
        else if (lowerName.includes(query)) score += 40;

        // 4. Token matches in name
        for (const token of tokens) {
          if (lowerName.includes(token)) score += 15;
          if (lowerBrand.includes(token)) score += 20;
          if (lowerCategory.includes(token)) score += 15;
          if (lowerStore.includes(token)) score += 10;
          if (tagsList.includes(token)) score += 15;
          if (lowerDesc.includes(token)) score += 5;
        }

        // 5. Featured product boost
        if (p.isFeatured) score += 10;
      }

      // Compute price range and stock
      const validVariants = p.variants.filter((v) => v.isAvailable);
      const prices = validVariants.map((v) => Number(v.price));
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      let maxDiscount = 0;
      for (const v of validVariants) {
        if (v.compareAtPrice && Number(v.compareAtPrice) > Number(v.price)) {
          const disc = Math.round(
            ((Number(v.compareAtPrice) - Number(v.price)) / Number(v.compareAtPrice)) * 100
          );
          if (disc > maxDiscount) maxDiscount = disc;
        }
      }

      const totalStock = p.variants.reduce((acc, v) => acc + (v.inventory?.quantity ?? 0), 0);
      const inStock = totalStock > 0;

      // Primary image
      let primaryImage: string | null = null;
      for (const v of p.variants) {
        if (v.images && v.images.length > 0) {
          primaryImage = v.images[0].url;
          break;
        }
      }

      const reviewCount = p.reviews.length;
      const avgRating =
        reviewCount > 0
          ? p.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
          : 0;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        description: p.description,
        shortDescription: p.shortDescription,
        tags: p.tags,
        relevanceScore: score,
        category: p.category,
        store: p.store,
        minPrice,
        maxPrice,
        hasDiscount: maxDiscount > 0,
        maxDiscountPercent: maxDiscount,
        inStock,
        totalStock,
        primaryImage,
        variants: p.variants,
        avgRating,
        reviewCount,
        createdAt: p.createdAt,
      };
    });

    // Custom sorting for relevance and computed prices
    if (sortBy === "relevance" && query) {
      scoredProducts.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
    } else if (sortBy === "price_asc") {
      scoredProducts.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sortBy === "price_desc") {
      scoredProducts.sort((a, b) => b.maxPrice - a.maxPrice);
    }

    // Build Facets / Aggregations across all matching products
    const brandCounts = new Map<string, number>();
    const categoryCounts = new Map<string, { id: string; name: string; slug: string; count: number }>();
    let overallMinPrice = Number.POSITIVE_INFINITY;
    let overallMaxPrice = 0;
    let inStockCounter = 0;

    for (const item of scoredProducts) {
      if (item.brand) {
        brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
      }
      const catKey = item.category.id;
      const existingCat = categoryCounts.get(catKey);
      if (existingCat) {
        existingCat.count++;
      } else {
        categoryCounts.set(catKey, {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
          count: 1,
        });
      }

      if (item.minPrice < overallMinPrice && item.minPrice > 0) overallMinPrice = item.minPrice;
      if (item.maxPrice > overallMaxPrice) overallMaxPrice = item.maxPrice;
      if (item.inStock) inStockCounter++;
    }

    const facets: SearchFacets = {
      brands: Array.from(brandCounts.entries()).map(([name, count]) => ({ name, count })),
      categories: Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count),
      priceRange: {
        min: overallMinPrice === Number.POSITIVE_INFINITY ? 0 : overallMinPrice,
        max: overallMaxPrice,
      },
      inStockCount: inStockCounter,
    };

    // Paginate in-memory array
    const paginatedProducts = scoredProducts.slice(skip, skip + take);
    const total = scoredProducts.length;

    return {
      query: rawQuery,
      products: paginatedProducts,
      total,
      facets,
      page: Math.floor(skip / take) + 1,
      limit: take,
      totalPages: Math.ceil(total / take) || 1,
    };
  }
}
