import "server-only";

import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import type { User } from "@prisma/client";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  productSpecificationSchema,
  type ListProductsQuery,
} from "@/lib/validation/products";

type MerchantActor = Pick<User, "id" | "name" | "email" | "role">;

export type MerchantProductFilter =
  | "all"
  | "published"
  | "unpublished"
  | "draft"
  | "pending"
  | "scheduled"
  | "rejected"
  | "hidden"
  | "featured"
  | "archived";

export type MerchantProductRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  image: string;
  price: number;
  stockQuantity: number;
  rating: number;
  reviewCount: number;
  isPublished: boolean;
  moderationStatus: string;
  scheduledAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
};

function assertMerchant(actor: MerchantActor) {
  if (actor.role !== "seller") throw new AuthorizationDeniedError();
}

export async function getMerchantAnalyticsData(actor: MerchantActor) {
  assertMerchant(actor);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);

  const [orderItems, products, salesOrders, cancelledOrders, productViews, productReviews, favorites] =
    await prisma.$transaction([
      prisma.orderItem.findMany({
        where: {
          sellerId: actor.id,
          order: { createdAt: { gte: from } },
        },
        select: {
          productId: true,
          productName: true,
          quantity: true,
          merchantLineTotal: true,
          createdAt: true,
          order: { select: { status: true } },
        },
      }),
      prisma.product.findMany({
        where: { ownerId: actor.id },
        select: {
          id: true,
          name: true,
          rating: true,
          reviewCount: true,
          stockQuantity: true,
          isPublished: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: from },
          items: { some: { sellerId: actor.id } },
          status: { in: [OrderStatus.delivered, OrderStatus.fulfilled] },
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: from },
          items: { some: { sellerId: actor.id } },
          status: OrderStatus.cancelled,
        },
      }),
      prisma.productView.count({
        where: { product: { ownerId: actor.id }, viewedAt: { gte: from } },
      }),
      prisma.productReview.count({
        where: { product: { ownerId: actor.id }, createdAt: { gte: from } },
      }),
      prisma.productFavorite.count({
        where: { product: { ownerId: actor.id } },
      }),
    ]);

  const completedStatuses = new Set<OrderStatus>([
    OrderStatus.delivered,
    OrderStatus.fulfilled,
  ]);
  const activeItems = orderItems.filter((item) =>
    completedStatuses.has(item.order.status),
  );
  const byProduct = new Map<
    string,
    { name: string; quantity: number; revenue: number; orders: number }
  >();
  for (const item of activeItems) {
    const key = item.productId ?? item.productName;
    const current = byProduct.get(key) ?? {
      name: item.productName,
      quantity: 0,
      revenue: 0,
      orders: 0,
    };
    current.quantity += item.quantity;
    current.revenue += item.merchantLineTotal;
    current.orders += 1;
    byProduct.set(key, current);
  }

  const productRows = [...byProduct.entries()]
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = activeItems.reduce(
    (sum, item) => sum + item.merchantLineTotal,
    0,
  );
  const totalUnits = activeItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const ratedProducts = products.filter((product) => product.reviewCount > 0);
  const averageRating = ratedProducts.length
    ? ratedProducts.reduce((sum, product) => sum + product.rating, 0) /
      ratedProducts.length
    : 0;
  const conversionRate = productViews
    ? (salesOrders / productViews) * 100
    : 0;

  return {
    period: "Last 30 days",
    totalRevenue,
    totalUnits,
    salesOrders,
    cancelledOrders,
    averageRating,
    productViews,
    productReviews,
    favorites,
    conversionRate,
    products,
    bestSellers: productRows.slice(0, 10),
  };
}

export async function getMerchantDashboardData(actor: MerchantActor) {
  assertMerchant(actor);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const firstDay = new Date(today);
  firstDay.setUTCDate(firstDay.getUTCDate() - 6);

  const productWhere = { ownerId: actor.id };
  const orderWhere = { items: { some: { sellerId: actor.id } } };
  const [
    totalProducts,
    publishedProducts,
    unpublishedProducts,
    outOfStockProducts,
    lowStockRows,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    fulfilledOrders,
    recentProducts,
    recentOrders,
    dailyOrders,
    bestSellers,
  ] = await prisma.$transaction([
    prisma.product.count({ where: productWhere }),
    prisma.product.count({
      where: { ...productWhere, isPublished: true },
    }),
    prisma.product.count({
      where: { ...productWhere, isPublished: false },
    }),
    prisma.product.count({
      where: { ...productWhere, stockQuantity: 0 },
    }),
    prisma.$queryRaw<{ count: number }[]>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM "Product" p
        LEFT JOIN "ProductCategoryCatalog" c ON c."slug" = p."category"
        WHERE p."ownerId" = ${actor.id}
          AND p."stockQuantity" <= COALESCE(p."lowStockThreshold", c."lowStockThreshold", 3)
      `,
    ),
    prisma.order.count({ where: orderWhere }),
    prisma.order.count({
      where: { ...orderWhere, status: OrderStatus.pending },
    }),
    prisma.order.count({
      where: { ...orderWhere, status: OrderStatus.confirmed },
    }),
    prisma.order.count({
      where: { ...orderWhere, status: OrderStatus.fulfilled },
    }),
    prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        name: true,
        category: true,
        categoryInfo: { select: { name: true } },
        image: true,
        price: true,
        stockQuantity: true,
        rating: true,
        reviewCount: true,
        isPublished: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        status: true,
        createdAt: true,
        items: {
          where: { sellerId: actor.id },
          select: {
            id: true,
            productName: true,
            quantity: true,
            merchantUnitPrice: true,
            merchantLineTotal: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.$queryRaw<{ day: string; count: number }[]>(
      Prisma.sql`
        SELECT
          TO_CHAR(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          COUNT(DISTINCT o."id")::int AS count
        FROM "Order" o
        WHERE o."createdAt" >= ${firstDay}
          AND EXISTS (
            SELECT 1
            FROM "OrderItem" oi
            WHERE oi."orderId" = o."id"
              AND oi."sellerId" = ${actor.id}
          )
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        sellerId: actor.id,
        productId: { not: null },
        order: { status: { not: OrderStatus.cancelled } },
      },
      _sum: { quantity: true, merchantLineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const orderCounts = new Map(dailyOrders.map(({ day, count }) => [day, count]));
  const orderActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(firstDay.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      day: new Intl.DateTimeFormat("en", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      count: orderCounts.get(key) ?? 0,
    };
  });

  return {
    stats: {
      totalProducts,
      publishedProducts,
      unpublishedProducts,
      outOfStockProducts,
      lowStockProducts: lowStockRows[0]?.count ?? 0,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      fulfilledOrders,
    },
    orderActivity,
    recentProducts: recentProducts.map(({ categoryInfo, ...product }) => ({
      ...product,
      category: categoryInfo.name,
    })),
    recentOrders,
    bestSellers: bestSellers.map((item) => ({
      name: item.productName,
      quantity: item._sum?.quantity ?? 0,
      value: item._sum?.merchantLineTotal ?? 0,
    })),
  };
}

export async function getMerchantProducts(
  actor: MerchantActor,
  query: ListProductsQuery,
  filter: MerchantProductFilter = "all",
) {
  assertMerchant(actor);
  const where: Prisma.ProductWhereInput = {
    ownerId: actor.id,
    ...(filter === "all"
      ? { archivedAt: null }
      : {}),
    ...(filter === "published"
      ? { isPublished: true }
      : filter === "unpublished"
        ? { isPublished: false }
        : filter === "featured"
          ? { isFeatured: true, isPublished: true }
          : filter === "archived"
            ? { archivedAt: { not: null } }
        : filter === "draft" ||
            filter === "pending" ||
            filter === "scheduled" ||
            filter === "rejected" ||
            filter === "hidden"
          ? { moderationStatus: filter }
        : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.q
      ? {
          OR: [
            {
              name: {
                contains: query.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              nameRw: {
                contains: query.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              nameFr: {
                contains: query.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              sku: {
                contains: query.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              brand: {
                contains: query.q,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
  };

  const [
    products,
    total,
    totalProducts,
    publishedProducts,
    unpublishedProducts,
    outOfStockProducts,
    draftProducts,
    pendingProducts,
    scheduledProducts,
    rejectedProducts,
    hiddenProducts,
    featuredProducts,
    archivedProducts,
  ] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        categoryInfo: { select: { name: true } },
        image: true,
        price: true,
        stockQuantity: true,
        rating: true,
        reviewCount: true,
        isPublished: true,
        archivedAt: true,
        moderationStatus: true,
        scheduledAt: true,
        createdAt: true,
      },
      orderBy:
        query.sort === "price-low"
          ? { price: "asc" }
          : query.sort === "price-high"
            ? { price: "desc" }
            : query.sort === "rating"
              ? { rating: "desc" }
              : { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { ownerId: actor.id } }),
    prisma.product.count({
      where: { ownerId: actor.id, isPublished: true },
    }),
    prisma.product.count({
      where: { ownerId: actor.id, isPublished: false },
    }),
    prisma.product.count({
      where: { ownerId: actor.id, stockQuantity: 0 },
    }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, moderationStatus: "draft" } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, moderationStatus: "pending" } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, moderationStatus: "scheduled" } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, moderationStatus: "rejected" } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, moderationStatus: "hidden" } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: null, isFeatured: true, isPublished: true } }),
    prisma.product.count({ where: { ownerId: actor.id, archivedAt: { not: null } } }),
  ]);

  return {
    products: products.map(({ categoryInfo, ...product }) => ({
      ...product,
      category: categoryInfo.name,
    })),
    total,
    summary: {
      totalProducts,
      publishedProducts,
      unpublishedProducts,
      outOfStockProducts,
      draftProducts,
      pendingProducts,
      scheduledProducts,
      rejectedProducts,
      hiddenProducts,
      featuredProducts,
      archivedProducts,
    },
  };
}

export async function getMerchantProduct(actor: MerchantActor, id: string) {
  assertMerchant(actor);
  const product = await prisma.product.findFirst({
    where: { id, ownerId: actor.id },
    select: {
      id: true,
      sku: true,
      brand: true,
      subcategoryId: true,
      subcategory: {
        select: { id: true, name: true, category: true, isActive: true },
      },
      name: true,
      nameRw: true,
      nameFr: true,
      description: true,
      warranty: true,
      specifications: true,
      returnPolicy: true,
      category: true,
      categoryInfo: { select: { name: true } },
      price: true,
      previousPrice: true,
      image: true,
      location: true,
      stockQuantity: true,
      lowStockThreshold: true,
      isPublished: true,
      moderationStatus: true,
      scheduledAt: true,
      archivedAt: true,
      uploadedImages: {
        select: { id: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
      createdAt: true,
    },
  });
  if (!product) return null;
  return {
    ...product,
    specifications:
      product.specifications === null
        ? null
        : productSpecificationSchema.parse(product.specifications),
  };
}

export async function getMerchantOrders(
  actor: MerchantActor,
  status?: OrderStatus,
) {
  assertMerchant(actor);
  const sellerItems = { items: { some: { sellerId: actor.id } } };
  const where: Prisma.OrderWhereInput = {
    ...sellerItems,
    ...(status ? { status } : {}),
  };
  const [orders, total, pending, confirmed, processing, shipped, delivered, fulfilled, cancelled] =
    await prisma.$transaction([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true,
          items: {
            where: { sellerId: actor.id },
            select: {
              id: true,
              productName: true,
              productImage: true,
              merchantUnitPrice: true,
              quantity: true,
              merchantLineTotal: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.order.count({ where: sellerItems }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.pending },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.confirmed },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.processing },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.shipped },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.delivered },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.fulfilled },
      }),
      prisma.order.count({
        where: { ...sellerItems, status: OrderStatus.cancelled },
      }),
    ]);

  return {
    orders,
    total,
    pending,
    confirmed,
    processing,
    shipped,
    delivered,
    fulfilled,
    cancelled,
  };
}

export async function getMerchantProfile(actor: MerchantActor) {
  assertMerchant(actor);
  return prisma.user.findUnique({
    where: { id: actor.id },
    select: { name: true, email: true, phone: true, createdAt: true },
  });
}

export async function updateMerchantProfile(
  actor: MerchantActor,
  input: { name: string; phone: string | null },
) {
  assertMerchant(actor);
  const updated = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET "name" = ${input.name},
          "phone" = ${input.phone},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${actor.id}
        AND "role" = ${UserRole.seller}::"UserRole"
        AND "isSuspended" = false
        AND "isAnonymized" = false
    `,
  );
  if (updated !== 1) return null;

  return prisma.user.findUnique({
    where: { id: actor.id },
    select: { name: true, email: true, phone: true, createdAt: true },
  });
}

export async function getMerchantOrder(actor: MerchantActor, id: string) {
  assertMerchant(actor);
  return prisma.order.findFirst({
    where: {
      id,
      items: { some: { sellerId: actor.id } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      items: {
        where: { sellerId: actor.id },
        select: {
          id: true,
          productName: true,
          productImage: true,
          sellerName: true,
          merchantUnitPrice: true,
          quantity: true,
          merchantLineTotal: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
