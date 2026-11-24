import "server-only";

import { Prisma } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const PRODUCT_MODERATION_PAGE_SIZE = 20;

export async function getSuperAdminPendingProducts(query: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/products/pending-approval");
  const safePage = Math.max(1, Math.min(page, 500));
  const search: Prisma.ProductWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { seller: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { location: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};
  const where = {
    ...search,
    moderationStatus: "pending" as const,
  } satisfies Prisma.ProductWhereInput;
  const [rows, total, pending, rejected, published, hidden] =
    await prisma.$transaction([
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
          location: true,
          createdAt: true,
          updatedAt: true,
          moderationStatus: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: PRODUCT_MODERATION_PAGE_SIZE,
        skip: (safePage - 1) * PRODUCT_MODERATION_PAGE_SIZE,
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { moderationStatus: "pending" } }),
      prisma.product.count({ where: { moderationStatus: "rejected" } }),
      prisma.product.count({ where: { moderationStatus: "published" } }),
      prisma.product.count({ where: { moderationStatus: "hidden" } }),
    ]);
  return {
    rows,
    total,
    page: safePage,
    pageSize: PRODUCT_MODERATION_PAGE_SIZE,
    summary: { pending, rejected, published, hidden },
  };
}
