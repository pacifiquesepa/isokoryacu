import "server-only";

import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  getDefaultAnalyticsDateRange,
  type AnalyticsDateRange,
} from "@/lib/validation/super-admin-analytics";

export type AnalyticsMetric = {
  label: string;
  value: number;
  detail: string;
  tone: "blue" | "green" | "yellow" | "red";
  href: string;
};

export type AnalyticsRow = {
  id: string;
  label: string;
  detail: string;
  indicator: string;
  metric: string;
  href: string;
};

export type SuperAdminAnalyticsReport = {
  title: string;
  description: string;
  notice: string;
  rangeLabel: string;
  dateRange: { from: string; to: string; max: string };
  metrics: AnalyticsMetric[];
  columns: [string, string, string, string];
  rows: AnalyticsRow[];
  activity?: { day: string; count: number }[];
  activityTitle?: string;
  activityDescription?: string;
  activityUnit?: string;
  categories?: { label: string; count: number }[];
};

type DailyCount = { day: string; count: number };

const reportRowLimit = 20;

function formatRangeLabel(range: AnalyticsDateRange) {
  const dateFormat = new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return `${dateFormat.format(range.start)} – ${dateFormat.format(
    new Date(range.endExclusive.getTime() - 1),
  )}`;
}

function getDailySeries(rows: DailyCount[], range: AnalyticsDateRange) {
  const counts = new Map(rows.map((row) => [row.day, row.count]));
  return Array.from({ length: range.days }, (_, index) => {
    const date = new Date(range.start);
    date.setUTCDate(range.start.getUTCDate() + index);
    return {
      day: date.toISOString().slice(5, 10),
      count: counts.get(date.toISOString().slice(0, 10)) ?? 0,
    };
  });
}

async function getOrdersReport(
  title: string,
  callbackUrl: string,
  range: AnalyticsDateRange,
): Promise<SuperAdminAnalyticsReport> {
  await requireSuperAdminPageUser(callbackUrl);
  const [
    totalOrders,
    pendingOrders,
    confirmedOrders,
    fulfilledOrders,
    cancelledOrders,
    dailyOrders,
    orders,
  ] = await prisma.$transaction([
    prisma.order.count({
      where: { createdAt: { gte: range.start, lt: range.endExclusive } },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.pending,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.confirmed,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.fulfilled,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    prisma.order.count({
      where: {
        status: OrderStatus.cancelled,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    prisma.$queryRaw<DailyCount[]>(
      Prisma.sql`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM "Order"
        WHERE "createdAt" >= ${range.start}
          AND "createdAt" < ${range.endExclusive}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ),
    prisma.order.findMany({
      where: {
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      select: {
        id: true,
        status: true,
        subtotal: true,
        currency: true,
        createdAt: true,
        customer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: reportRowLimit,
    }),
    prisma.productCategoryCatalog.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    title,
    description: `Marketplace order activity · ${formatRangeLabel(range)}`,
    notice:
      "Order subtotals are shown as order records only. Payments are not integrated, so they are not verified revenue or payouts.",
    rangeLabel: formatRangeLabel(range),
    dateRange: { from: range.from, to: range.to, max: range.max },
    metrics: [
      {
        label: "Orders in period",
        value: totalOrders,
        detail: formatRangeLabel(range),
        tone: "blue",
        href: "/super-admin/orders",
      },
      {
        label: "Pending",
        value: pendingOrders,
        detail: "Awaiting an administrator decision",
        tone: "yellow",
        href: "/super-admin/orders/new-orders",
      },
      {
        label: "Confirmed",
        value: confirmedOrders,
        detail: "Current marketplace status",
        tone: "green",
        href: "/super-admin/orders/confirmed-orders",
      },
      {
        label: "Fulfilled",
        value: fulfilledOrders,
        detail: "Current marketplace status",
        tone: "green",
        href: "/super-admin/orders/completed-orders",
      },
      {
        label: "Cancelled",
        value: cancelledOrders,
        detail: `${totalOrders.toLocaleString("en-RW")} orders in this period`,
        tone: "red",
        href: "/super-admin/orders/cancelled-orders",
      },
    ],
    columns: ["Order", "Customer", "Status", "Order subtotal"],
    activityTitle: "Daily orders",
    activityDescription: "Number of orders created each day",
    activityUnit: "orders",
    activity: getDailySeries(dailyOrders, range),
    rows: orders.map((order) => ({
      id: order.id,
      label: `#${order.id.slice(-8).toUpperCase()}`,
      detail: `${order.customer.name} · ${order.customer.email} · ${new Intl.DateTimeFormat("en-RW", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(order.createdAt)}`,
      indicator: order.status,
      metric: `${order.subtotal.toLocaleString("en-RW")} ${order.currency}`,
      href: `/super-admin/records/orders/${encodeURIComponent(order.id)}`,
    })),
  };
}

async function getProductReport(
  title: string,
  callbackUrl: string,
  range: AnalyticsDateRange,
): Promise<SuperAdminAnalyticsReport> {
  await requireSuperAdminPageUser(callbackUrl);
  const [
    totalProducts,
    publishedProducts,
    unpublishedProducts,
    outOfStockProducts,
    categoryGroups,
    bestSellers,
    supportedProductCategories,
  ] = await prisma.$transaction([
    prisma.product.count(),
    prisma.product.count({ where: { isPublished: true } }),
    prisma.product.count({ where: { isPublished: false } }),
    prisma.product.count({ where: { stockQuantity: 0 } }),
    prisma.product.groupBy({
      by: ["category"],
      _count: { category: true },
      orderBy: { category: "asc" },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: {
        productId: { not: null },
        order: {
          status: { not: OrderStatus.cancelled },
          createdAt: { gte: range.start, lt: range.endExclusive },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: reportRowLimit,
    }),
    prisma.productCategoryCatalog.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const productIds = bestSellers
    .map((item) => item.productId)
    .filter((id): id is string => id !== null);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          category: true,
          categoryInfo: { select: { name: true } },
          stockQuantity: true,
          isPublished: true,
        },
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const isCategoryReport = title === "Category Performance";
  const categoryCounts = new Map(
    categoryGroups.map((group) => [
      group.category,
      typeof group._count === "object" && group._count !== null
        ? group._count.category ?? 0
        : 0,
    ]),
  );
  const categoryRows = supportedProductCategories.map((category) => {
    const count = categoryCounts.get(category.slug) ?? 0;
    return {
      id: category.slug,
      label: category.name,
      detail: "Catalog category",
      indicator: `${count.toLocaleString("en-RW")} products`,
      metric: totalProducts
        ? `${Math.round((count / totalProducts) * 100)}%`
        : "0%",
      href: `/super-admin/products?category=${encodeURIComponent(category.slug)}`,
    };
  });

  return {
    title,
    description: `Current catalog and product demand · ${formatRangeLabel(range)}`,
    notice:
      "Best-selling quantities in the selected period exclude cancelled orders. Catalog counts are current; product views and paid-sales data are not collected.",
    rangeLabel: formatRangeLabel(range),
    dateRange: { from: range.from, to: range.to, max: range.max },
    metrics: [
      {
        label: "All products",
        value: totalProducts,
        detail: "Marketplace catalog",
        tone: "blue",
        href: "/super-admin/products",
      },
      {
        label: "Published",
        value: publishedProducts,
        detail: "Visible in the storefront",
        tone: "green",
        href: "/super-admin/products/published-products",
      },
      {
        label: "Unpublished",
        value: unpublishedProducts,
        detail: "Hidden from the storefront",
        tone: "yellow",
        href: "/super-admin/products/draft-products",
      },
      {
        label: "Out of stock",
        value: outOfStockProducts,
        detail: "Stock quantity is zero",
        tone: "red",
        href: "/super-admin/products/out-of-stock",
      },
    ],
    columns: isCategoryReport
      ? ["Category", "Catalog", "Products", "Catalog share"]
      : ["Product", "Publication", "Category · stock", "Units ordered"],
    categories: supportedProductCategories.map((category) => ({
      label: category.name,
      count: categoryCounts.get(category.slug) ?? 0,
    })),
    rows: isCategoryReport
      ? categoryRows
      : bestSellers.flatMap((item) => {
      if (!item.productId) return [];
      const product = productById.get(item.productId);
      if (!product) return [];
      return [
        {
          id: item.productId,
          label: item.productName,
          detail: product.isPublished ? "Published" : "Unpublished",
          indicator: `${product.categoryInfo.name} · ${product.stockQuantity} in stock`,
          metric: `${(item._sum?.quantity ?? 0).toLocaleString("en-RW")} units`,
          href: `/super-admin/records/products/${encodeURIComponent(item.productId)}`,
        },
      ];
    }),
  };
}

async function getMerchantReport(
  title: string,
  callbackUrl: string,
  range: AnalyticsDateRange,
): Promise<SuperAdminAnalyticsReport> {
  await requireSuperAdminPageUser(callbackUrl);
  const [totalMerchants, newMerchants, sellers, soldUnits] =
    await prisma.$transaction([
      prisma.user.count({ where: { role: UserRole.seller } }),
      prisma.user.count({
        where: {
          role: UserRole.seller,
          createdAt: { gte: range.start, lt: range.endExclusive },
        },
      }),
      prisma.user.findMany({
        where: {
          role: UserRole.seller,
          createdAt: { gte: range.start, lt: range.endExclusive },
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: "desc" },
        take: reportRowLimit,
      }),
      prisma.orderItem.groupBy({
        by: ["sellerId"],
        where: {
          sellerId: { not: null },
          order: {
            status: { not: OrderStatus.cancelled },
            createdAt: { gte: range.start, lt: range.endExclusive },
          },
        },
        _sum: { quantity: true },
        orderBy: { sellerId: "asc" },
      }),
    ]);

  const unitsBySeller = new Map(
    soldUnits.map((group) => [group.sellerId, group._sum?.quantity ?? 0]),
  );
  const dateFormat = new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return {
    title,
    description: `Merchant registrations and order-item activity · ${formatRangeLabel(range)}`,
    notice:
      "Merchant registrations and non-cancelled order units use the selected period. Catalog counts are current and do not represent merchant earnings or payouts.",
    rangeLabel: formatRangeLabel(range),
    dateRange: { from: range.from, to: range.to, max: range.max },
    metrics: [
      {
        label: "Merchants",
        value: totalMerchants,
        detail: "Seller accounts",
        tone: "blue",
        href: "/super-admin/merchants",
      },
      {
        label: "New merchants",
        value: newMerchants,
        detail: formatRangeLabel(range),
        tone: "green",
        href: "/super-admin/merchants",
      },
      {
        label: "Listed products",
        value: sellers.reduce((total, seller) => total + seller._count.products, 0),
        detail: "Across the displayed merchants",
        tone: "yellow",
        href: "/super-admin/products",
      },
      {
        label: "Units ordered",
        value: soldUnits.reduce(
          (total, seller) => total + (seller._sum?.quantity ?? 0),
          0,
        ),
        detail: "Non-cancelled orders",
        tone: "red",
        href: "/super-admin/orders",
      },
    ],
    columns: ["Merchant", "Account", "Catalog products", "Units ordered"],
    rows: sellers.map((seller) => ({
      id: seller.id,
      label: seller.name,
      detail: `${seller.email} · Joined ${dateFormat.format(seller.createdAt)}`,
      indicator: `${seller._count.products} products`,
      metric: `${(unitsBySeller.get(seller.id) ?? 0).toLocaleString("en-RW")} units`,
      href: `/super-admin/records/users/${encodeURIComponent(seller.id)}`,
    })),
  };
}

async function getCustomerReport(
  title: string,
  callbackUrl: string,
  range: AnalyticsDateRange,
): Promise<SuperAdminAnalyticsReport> {
  await requireSuperAdminPageUser(callbackUrl);
  const [totalCustomers, newCustomers, customers, dailyCustomers] = await prisma.$transaction([
    prisma.user.count({ where: { role: UserRole.customer } }),
    prisma.user.count({
      where: {
        role: UserRole.customer,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
    }),
    prisma.user.findMany({
      where: {
        role: UserRole.customer,
        createdAt: { gte: range.start, lt: range.endExclusive },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: reportRowLimit,
    }),
    prisma.$queryRaw<DailyCount[]>(
      Prisma.sql`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM "User"
        WHERE role = ${UserRole.customer}::"UserRole"
          AND "createdAt" >= ${range.start}
          AND "createdAt" < ${range.endExclusive}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ),
  ]);
  const dateFormat = new Intl.DateTimeFormat("en-RW", {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return {
    title,
    description: `Customer registrations and marketplace order counts · ${formatRangeLabel(range)}`,
    notice:
      "Customer registration counts use the selected period. Order counts reflect marketplace records, not payment or spending history.",
    rangeLabel: formatRangeLabel(range),
    dateRange: { from: range.from, to: range.to, max: range.max },
    activity: getDailySeries(dailyCustomers, range),
    activityTitle: "Daily customer registrations",
    activityDescription: "Number of customer accounts registered each day",
    activityUnit: "customer registrations",
    metrics: [
      {
        label: "Customers",
        value: totalCustomers,
        detail: "Registered customer accounts",
        tone: "blue",
        href: "/super-admin/users/customers",
      },
      {
        label: "New customers",
        value: newCustomers,
        detail: formatRangeLabel(range),
        tone: "green",
        href: "/super-admin/users/customers",
      },
      {
        label: "Orders by recent customers",
        value: customers.reduce((total, customer) => total + customer._count.orders, 0),
        detail: `Across ${customers.length} displayed accounts`,
        tone: "yellow",
        href: "/super-admin/orders",
      },
      {
        label: "No orders yet",
        value: customers.filter((customer) => customer._count.orders === 0).length,
        detail: `Across ${customers.length} displayed accounts`,
        tone: "red",
        href: "/super-admin/users/customers",
      },
    ],
    columns: ["Customer", "Account", "Joined", "Orders"],
    rows: customers.map((customer) => ({
      id: customer.id,
      label: customer.name,
      detail: customer.email,
      indicator: dateFormat.format(customer.createdAt),
      metric: customer._count.orders.toLocaleString("en-RW"),
      href: `/super-admin/records/users/${encodeURIComponent(customer.id)}`,
    })),
  };
}

export async function getSuperAdminAnalyticsReport(
  path: string[],
  title: string,
  range: AnalyticsDateRange = getDefaultAnalyticsDateRange(),
): Promise<SuperAdminAnalyticsReport | null> {
  const callbackUrl = `/super-admin/${path.join("/")}`;
  const report = path[1];

  if (!report || report === "sales-analytics") {
    return getOrdersReport(title, callbackUrl, range);
  }
  if (
    report === "product-analytics" ||
    report === "best-selling-products" ||
    report === "category-performance"
  ) {
    return getProductReport(title, callbackUrl, range);
  }
  if (report === "merchant-analytics") {
    return getMerchantReport(title, callbackUrl, range);
  }
  if (report === "customer-analytics") {
    return getCustomerReport(title, callbackUrl, range);
  }
  return null;
}
