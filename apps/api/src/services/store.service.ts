import { prisma, type Store, type Prisma } from "@aurazone/database";
import { slugify } from "@aurazone/utils";
import { logAction } from "./auditLog.service.js";

// ─── List Stores ─────────────────────────────────────────────────────────────
export async function listStores(opts?: {
  activeOnly?: boolean;
  search?: string;
  includeDeleted?: boolean;
  storeIds?: string[];
  skip?: number;
  take?: number;
}): Promise<{ stores: Store[]; total: number }> {
  const where: Prisma.StoreWhereInput = {};

  // Exclude soft-deleted by default
  if (!opts?.includeDeleted) where.deletedAt = null;

  if (opts?.activeOnly) where.isActive = true;
  if (opts?.storeIds) where.id = { in: opts.storeIds };
  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { slug: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 50,
      include: { _count: { select: { categories: true, products: true } } },
    }),
    prisma.store.count({ where }),
  ]);

  return { stores, total };
}

// ─── Get Store by Slug ───────────────────────────────────────────────────────
export async function getStoreBySlug(slug: string) {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true, parentId: null, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          children: {
            where: { isActive: true, deletedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      _count: { select: { products: true } },
    },
  });

  if (!store || store.deletedAt) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  return store;
}

// ─── Get Store by ID ─────────────────────────────────────────────────────────
export async function getStoreById(id: string) {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      categories: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      attributeTemplates: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true, categories: true } },
    },
  });

  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  return store;
}

// ─── Create Store ────────────────────────────────────────────────────────────
export async function createStore(
  data: {
    name: string;
    slug?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    accentColor?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
  adminId?: string
): Promise<Store> {
  const slug = data.slug ?? slugify(data.name);

  const existing = await prisma.store.findUnique({ where: { slug } });
  if (existing) {
    throw Object.assign(new Error("Store slug already taken"), { statusCode: 409 });
  }

  const store = await prisma.store.create({
    data: {
      slug,
      name: data.name,
      description: data.description ?? null,
      logoUrl: data.logoUrl ?? null,
      bannerUrl: data.bannerUrl ?? null,
      accentColor: data.accentColor ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "CREATE",
      entity: "STORE",
      entityId: store.id,
      entityName: store.name,
    });
  }

  return store;
}

// ─── Update Store ────────────────────────────────────────────────────────────
export async function updateStore(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    logoUrl: string;
    bannerUrl: string;
    accentColor: string;
    isActive: boolean;
    sortOrder: number;
  }>,
  adminId?: string
): Promise<Store> {
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  if (data.slug && data.slug !== store.slug) {
    const slugTaken = await prisma.store.findUnique({ where: { slug: data.slug } });
    if (slugTaken) {
      throw Object.assign(new Error("Store slug already taken"), { statusCode: 409 });
    }
  }

  const before = { ...store };
  const updated = await prisma.store.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
      ...(data.accentColor !== undefined && { accentColor: data.accentColor }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: data.isActive !== undefined && data.isActive !== before.isActive ? "TOGGLE_STATUS" : "UPDATE",
      entity: "STORE",
      entityId: id,
      entityName: updated.name,
      changes: { before: { name: before.name, isActive: before.isActive }, after: { name: updated.name, isActive: updated.isActive } },
    });
  }

  return updated;
}

// ─── Soft Delete Store ───────────────────────────────────────────────────────
export async function deleteStore(id: string, adminId?: string): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  // Bug 63: Atomically soft-delete and deactivate store and its associated child products
  const now = new Date();
  await prisma.$transaction([
    prisma.store.update({
      where: { id },
      data: { deletedAt: now, deletedBy: adminId ?? null, isActive: false },
    }),
    prisma.product.updateMany({
      where: { storeId: id, deletedAt: null },
      data: { deletedAt: now, deletedBy: adminId ?? null, isActive: false },
    }),
  ]);

  if (adminId) {
    await logAction({
      adminId,
      action: "DELETE",
      entity: "STORE",
      entityId: id,
      entityName: store.name,
    });
  }
}

// ─── Restore Store ───────────────────────────────────────────────────────────
export async function restoreStore(id: string, adminId?: string): Promise<Store> {
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }
  if (!store.deletedAt) {
    throw Object.assign(new Error("Store is not deleted"), { statusCode: 400 });
  }

  const restored = await prisma.store.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null, isActive: true },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "RESTORE",
      entity: "STORE",
      entityId: id,
      entityName: restored.name,
    });
  }

  return restored;
}