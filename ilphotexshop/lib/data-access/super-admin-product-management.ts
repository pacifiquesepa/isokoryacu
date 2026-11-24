import "server-only";

import { Prisma } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { InvalidProductScheduleError } from "@/lib/data-access/products";
import { prisma } from "@/lib/prisma";

export const SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE = 20;

export type ProductManagementView = "scheduled" | "rejected" | "hidden";

export async function getSuperAdminProductManagement(
  view: ProductManagementView,
  query: string,
  page: number,
) {
  await requireSuperAdminPageUser(`/super-admin/products/${view === "scheduled" ? "scheduled-products" : `${view}-products`}`);
  const safePage = Math.max(1, Math.min(page, 500));
  const search = query
    ? {
        OR: [
          { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { sku: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { brand: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { seller: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { location: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};
  const where =
    view === "scheduled"
      ? { moderationStatus: "scheduled" as const, scheduledAt: { not: null }, ...search }
      : view === "rejected"
        ? { moderationStatus: "rejected" as const, ...search }
        : { moderationStatus: "hidden" as const, ...search };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        image: true,
        seller: true,
        category: true,
        categoryInfo: { select: { name: true } },
        price: true,
        stockQuantity: true,
        isPublished: true,
        scheduledAt: true,
        moderationStatus: true,
        moderationReason: true,
        moderatedAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE,
      skip: (safePage - 1) * SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);
  return {
    rows,
    total,
    page: safePage,
    pageSize: SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE,
  };
}

export async function setProductScheduledState(
  actorId: string,
  productId: string,
  scheduledAt: Date | null,
) {
  await requireSuperAdminPageUser("/super-admin/products/scheduled-products");
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      ownerId: true,
      isPublished: true,
      moderationStatus: true,
    },
  });
  if (!product) return null;
  if (scheduledAt) {
    if (scheduledAt.getTime() <= Date.now()) {
      throw new InvalidProductScheduleError();
    }
    if (!product.isPublished && product.moderationStatus !== "scheduled") {
      throw new Error("Only published products can be scheduled");
    }
  }
  await prisma.product.update({
    where: { id: productId },
    data: scheduledAt
      ? {
          scheduledAt,
          isPublished: false,
          isFeatured: false,
          moderationStatus: "scheduled",
        }
      : {
          scheduledAt: null,
          ...(product.moderationStatus === "scheduled"
            ? { isPublished: true, moderationStatus: "published" }
            : {}),
        },
  });
  return { id: productId, scheduledAt };
}

export async function getProductSubcategories(search: string) {
  await requireSuperAdminPageUser("/super-admin/products/subcategories");
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { slug: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};
  const [rows, active, inactive, categories] = await prisma.$transaction([
    prisma.productSubcategory.findMany({
      where,
      select: {
        id: true,
        category: true,
        categoryInfo: { select: { name: true } },
        name: true,
        slug: true,
        commissionBasisPoints: true,
        isActive: true,
        createdAt: true,
        _count: { select: { products: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.productSubcategory.count({ where: { isActive: true } }),
    prisma.productSubcategory.count({ where: { isActive: false } }),
    prisma.productCategoryCatalog.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { rows, active, inactive, categories };
}

export async function upsertProductSubcategory(input: {
  id?: string;
  category: string;
  name: string;
  slug: string;
  commissionBasisPoints?: number | null;
}) {
  await requireSuperAdminPageUser("/super-admin/products/subcategories");
  if (input.id) {
    const [existing, category] = await prisma.$transaction([
      prisma.productSubcategory.findUnique({
        where: { id: input.id },
        select: { category: true, _count: { select: { products: true } } },
      }),
      prisma.productCategoryCatalog.findUnique({
        where: { slug: input.category },
        select: { slug: true },
      }),
    ]);
    if (!existing) return null;
    if (!category) throw new InvalidProductCategorySelectionError();
    if (existing.category !== input.category && existing._count.products > 0) {
      throw new ProductSubcategoryInUseError();
    }
    return prisma.productSubcategory.update({
      where: { id: input.id },
      data: {
        category: input.category,
        name: input.name,
        slug: input.slug,
        commissionBasisPoints: input.commissionBasisPoints ?? null,
      },
    });
  }
  const category = await prisma.productCategoryCatalog.findUnique({
    where: { slug: input.category },
    select: { slug: true },
  });
  if (!category) throw new InvalidProductCategorySelectionError();
  return prisma.productSubcategory.create({
    data: {
      category: input.category,
      name: input.name,
      slug: input.slug,
      commissionBasisPoints: input.commissionBasisPoints ?? null,
    },
  });
}

export class InvalidProductCategorySelectionError extends Error {
  constructor() {
    super("Choose a valid product category");
    this.name = "InvalidProductCategorySelectionError";
  }
}

export class ProductSubcategoryInUseError extends Error {
  constructor() {
    super("A subcategory assigned to products cannot be moved or deleted");
    this.name = "ProductSubcategoryInUseError";
  }
}

export async function deleteProductSubcategory(id: string) {
  await requireSuperAdminPageUser("/super-admin/products/subcategories");
  const subcategory = await prisma.productSubcategory.findUnique({
    where: { id },
    select: { _count: { select: { products: true } } },
  });
  if (!subcategory) return false;
  if (subcategory._count.products > 0) throw new ProductSubcategoryInUseError();
  const result = await prisma.productSubcategory.deleteMany({ where: { id } });
  return result.count === 1;
}

export async function setProductSubcategoryStatus(id: string, isActive: boolean) {
  await requireSuperAdminPageUser("/super-admin/products/subcategories");
  const result = await prisma.productSubcategory.updateMany({
    where: { id },
    data: { isActive },
  });
  return result.count === 1;
}

export async function getSuperAdminProductCategories() {
  await requireSuperAdminPageUser("/super-admin/products/categories");
  return prisma.productCategoryCatalog.findMany({
    select: {
      slug: true,
      name: true,
      description: true,
      commissionBasisPoints: true,
      lowStockThreshold: true,
      _count: { select: { products: true, subcategories: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createProductCategory(input: {
  slug: string;
  name: string;
  description?: string | null;
  commissionBasisPoints?: number | null;
  lowStockThreshold?: number | null;
}) {
  await requireSuperAdminPageUser("/super-admin/products/categories");
  return prisma.productCategoryCatalog.create({
    data: {
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      commissionBasisPoints: input.commissionBasisPoints ?? null,
      lowStockThreshold: input.lowStockThreshold ?? null,
    },
  });
}

export async function updateProductCategory(input: {
  slug: string;
  name: string;
  description?: string | null;
  commissionBasisPoints?: number | null;
  lowStockThreshold?: number | null;
}) {
  await requireSuperAdminPageUser("/super-admin/products/categories");
  const result = await prisma.productCategoryCatalog.updateMany({
    where: { slug: input.slug },
    data: {
      name: input.name,
      description: input.description ?? null,
      commissionBasisPoints: input.commissionBasisPoints ?? null,
      lowStockThreshold: input.lowStockThreshold ?? null,
    },
  });
  return result.count === 1;
}

export class ProductCategoryInUseError extends Error {
  constructor() {
    super("A category with products or subcategories cannot be deleted");
    this.name = "ProductCategoryInUseError";
  }
}

export async function deleteProductCategory(slug: string) {
  await requireSuperAdminPageUser("/super-admin/products/categories");
  const category = await prisma.productCategoryCatalog.findUnique({
    where: { slug },
    select: { _count: { select: { products: true, subcategories: true } } },
  });
  if (!category) return false;
  if (category._count.products > 0 || category._count.subcategories > 0) {
    throw new ProductCategoryInUseError();
  }
  const result = await prisma.productCategoryCatalog.deleteMany({ where: { slug } });
  return result.count === 1;
}

export async function createProductReport(
  reporterId: string,
  productId: string,
  reason: string,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId, isPublished: true },
    select: { id: true },
  });
  if (!product) return null;
  return prisma.productReport.create({
    data: { productId, reporterId, reason, status: "pending" },
  });
}

export async function getSuperAdminProductReports(query: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/products/reported-products");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = query
    ? {
        OR: [
          { reason: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { product: { is: { name: { contains: query, mode: Prisma.QueryMode.insensitive } } } },
          { reporter: { is: { name: { contains: query, mode: Prisma.QueryMode.insensitive } } } },
        ],
      }
    : {};
  const [rows, total, pending, reviewed, dismissed] = await prisma.$transaction([
    prisma.productReport.findMany({
      where,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        reviewNote: true,
        reviewedAt: true,
        product: { select: { id: true, name: true, image: true, seller: true } },
        reporter: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE,
      skip: (safePage - 1) * SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE,
    }),
    prisma.productReport.count({ where }),
    prisma.productReport.count({ where: { status: "pending" } }),
    prisma.productReport.count({ where: { status: "reviewed" } }),
    prisma.productReport.count({ where: { status: "dismissed" } }),
  ]);
  return { rows, total, page: safePage, pageSize: SUPER_ADMIN_PRODUCT_MANAGEMENT_PAGE_SIZE, pending, reviewed, dismissed };
}

export async function reviewProductReport(
  actorId: string,
  reportId: string,
  action: "review" | "dismiss",
  note?: string,
) {
  await requireSuperAdminPageUser("/super-admin/products/reported-products");
  const result = await prisma.productReport.updateMany({
    where: { id: reportId, status: "pending" },
    data: {
      status: action === "review" ? "reviewed" : "dismissed",
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: note || null,
    },
  });
  return result.count === 1;
}
