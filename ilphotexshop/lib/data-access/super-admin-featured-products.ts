import "server-only";

import { Prisma } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const SUPER_ADMIN_FEATURED_PRODUCTS_PAGE_SIZE = 20;

export async function getSuperAdminFeaturedProducts(
  search: string,
  requestedPage: number,
) {
  await requireSuperAdminPageUser("/super-admin/products/featured-products");
  const page = Math.max(1, Math.min(500, requestedPage));
  const pageSize = SUPER_ADMIN_FEATURED_PRODUCTS_PAGE_SIZE;
  const where: Prisma.ProductWhereInput = {
    isPublished: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { seller: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  };
  const [products, total, publishedCount, featuredCount] =
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
          isFeatured: true,
          createdAt: true,
        },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({
        where: { isPublished: true, isFeatured: true },
      }),
    ]);

  return {
    rows: products,
    total,
    page,
    pageSize,
    publishedCount,
    featuredCount,
  };
}
