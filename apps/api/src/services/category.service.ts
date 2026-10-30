import { prisma, type Category, type Prisma } from "@aurazone/database";
import { slugify } from "@aurazone/utils";
import { logAction } from "./auditLog.service.js";

// ─── List Categories ─────────────────────────────────────────────────────────
export async function listCategories(opts?: {
  storeId?: string;
  storeIds?: string[];
  parentId?: string | null;
  activeOnly?: boolean;
  includeDeleted?: boolean;
  search?: string;
  skip?: number;
  take?: number;
}): Promise<{ categories: Category[]; total: number }> {
  const where: Prisma.CategoryWhereInput = {};

  // Exclude soft-deleted by default
  if (!opts?.includeDeleted) where.deletedAt = null;

  if (opts?.storeId) where.storeId = opts.storeId;
  else if (opts?.storeIds) where.storeId = { in: opts.storeIds };
  if (opts?.parentId !== undefined) where.parentId = opts.parentId;
  if (opts?.activeOnly) where.isActive = true;
  if (opts?.search) {
    where.OR = [
      { name: { contains: opts.search, mode: "insensitive" } },
      { slug: { contains: opts.search, mode: "insensitive" } },
    ];
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      skip: opts?.skip ?? 0,
      take: opts?.take ?? 100,
      include: {
        store: { select: { id: true, name: true, slug: true } },
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: opts?.includeDeleted ? {} : { deletedAt: null, ...(opts?.activeOnly ? { isActive: true } : {}) },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true, isActive: true },
        },
        _count: { select: { products: true } },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, total };
}

// ─── Get Category by ID ──────────────────────────────────────────────────────
export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      parent: { select: { id: true, name: true, slug: true } },
      children: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      attributeTemplates: { orderBy: { sortOrder: "asc" } },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  return category;
}

// ─── Get Category by Slug (within a store) ───────────────────────────────────
export async function getCategoryBySlug(storeSlug: string, categorySlug: string) {
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  const category = await prisma.category.findFirst({
    where: { storeId: store.id, slug: categorySlug, isActive: true, deletedAt: null },
    include: {
      store: { select: { id: true, name: true, slug: true } },
      children: {
        where: { isActive: true, deletedAt: null },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { products: true } },
    },
  });

  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  return category;
}

// ─── Create Category ─────────────────────────────────────────────────────────
export async function createCategory(
  data: {
    storeId: string;
    parentId?: string | null;
    name: string;
    slug?: string;
    description?: string;
    imageUrl?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
  adminId?: string
): Promise<Category> {
  // Verify store exists
  const store = await prisma.store.findUnique({ where: { id: data.storeId } });
  if (!store) {
    throw Object.assign(new Error("Store not found"), { statusCode: 404 });
  }

  // Verify parent exists if provided
  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
    if (!parent) {
      throw Object.assign(new Error("Parent category not found"), { statusCode: 404 });
    }
    if (parent.storeId !== data.storeId) {
      throw Object.assign(new Error("Parent category must be in the same store"), { statusCode: 400 });
    }
  }

  const slug = data.slug ?? slugify(data.name);

  // Check uniqueness within store (scoped to storeId)
  const existing = await prisma.category.findFirst({
    where: {
      storeId: data.storeId,
      deletedAt: null,
      OR: [
        { slug },
        { name: { equals: data.name.trim(), mode: "insensitive" as const } },
      ],
    },
  });
  if (existing) {
    if (existing.slug === slug) {
      throw Object.assign(new Error("Category slug already exists in this store"), { statusCode: 409 });
    }
    throw Object.assign(new Error("A category with this name already exists in this store"), { statusCode: 409 });
  }

  const category = await prisma.category.create({
    data: {
      storeId: data.storeId,
      parentId: data.parentId ?? null,
      slug,
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      store: { select: { id: true, name: true, slug: true } },
    },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "CREATE",
      entity: "CATEGORY",
      entityId: category.id,
      entityName: category.name,
    });
  }

  return category;
}

// ─── Update Category ─────────────────────────────────────────────────────────
export async function updateCategory(
  id: string,
  data: Partial<{
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    parentId: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
  adminId?: string
): Promise<Category> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  if ((data.slug && data.slug !== category.slug) || (data.name && data.name !== category.name)) {
    const slugToCheck = data.slug ?? (data.name ? slugify(data.name) : undefined);
    const duplicate = await prisma.category.findFirst({
      where: {
        storeId: category.storeId,
        id: { not: id },
        deletedAt: null,
        OR: [
          ...(slugToCheck ? [{ slug: slugToCheck }] : []),
          ...(data.name ? [{ name: { equals: data.name.trim(), mode: "insensitive" as const } }] : []),
        ],
      },
    });
    if (duplicate) {
      if (slugToCheck && duplicate.slug === slugToCheck) {
        throw Object.assign(new Error("Category slug already exists in this store"), { statusCode: 409 });
      }
      throw Object.assign(new Error("A category with this name already exists in this store"), { statusCode: 409 });
    }
  }

  // Prevent circular parent reference
  if (data.parentId === id) {
    throw Object.assign(new Error("Category cannot be its own parent"), { statusCode: 400 });
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: {
      store: { select: { id: true, name: true, slug: true } },
    },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: data.isActive !== undefined && data.isActive !== category.isActive ? "TOGGLE_STATUS" : "UPDATE",
      entity: "CATEGORY",
      entityId: id,
      entityName: updated.name,
      changes: { before: { name: category.name, isActive: category.isActive }, after: { name: updated.name, isActive: updated.isActive } },
    });
  }

  return updated;
}

// ─── Soft Delete Category ────────────────────────────────────────────────────
export async function deleteCategory(id: string, adminId?: string): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });

  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }

  if (category._count.products > 0) {
    throw Object.assign(
      new Error(`Cannot delete category with ${category._count.products} products`),
      { statusCode: 400 }
    );
  }

  if (category._count.children > 0) {
    throw Object.assign(
      new Error(`Cannot delete category with ${category._count.children} subcategories`),
      { statusCode: 400 }
    );
  }

  // Soft delete
  await prisma.category.update({
    where: { id },
    data: { deletedAt: new Date(), deletedBy: adminId ?? null, isActive: false },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "DELETE",
      entity: "CATEGORY",
      entityId: id,
      entityName: category.name,
    });
  }
}

// ─── Restore Category ────────────────────────────────────────────────────────
export async function restoreCategory(id: string, adminId?: string): Promise<Category> {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw Object.assign(new Error("Category not found"), { statusCode: 404 });
  }
  if (!category.deletedAt) {
    throw Object.assign(new Error("Category is not deleted"), { statusCode: 400 });
  }

  const restored = await prisma.category.update({
    where: { id },
    data: { deletedAt: null, deletedBy: null, isActive: true },
    include: { store: { select: { id: true, name: true, slug: true } } },
  });

  if (adminId) {
    await logAction({
      adminId,
      action: "RESTORE",
      entity: "CATEGORY",
      entityId: id,
      entityName: restored.name,
    });
  }

  return restored;
}