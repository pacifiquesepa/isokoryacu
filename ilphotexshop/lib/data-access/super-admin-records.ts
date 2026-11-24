import "server-only";

import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { productSpecificationSchema } from "@/lib/validation/products";

export type SuperAdminRecordKind = "users" | "products" | "orders";

export type SuperAdminRecordRow = {
  id: string;
  name: string;
  summary: string;
  status: string;
  phone?: string | null;
  isSuspended?: boolean;
  isAnonymized?: boolean;
  createdAt: Date;
  value?: number;
  currency?: string;
  image?: string;
  stockQuantity?: number;
  itemCount?: number;
};

export type SuperAdminRecordList = {
  kind: SuperAdminRecordKind;
  title: string;
  rows: SuperAdminRecordRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { label: string; value: number; href: string }[];
  categories?: { slug: string; name: string }[];
};

export type SuperAdminRecordDetail = {
  kind: SuperAdminRecordKind;
  id: string;
  title: string;
  subtitle: string;
  fields: { label: string; value: string }[];
};

export const SUPER_ADMIN_RECORD_PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_SUPER_ADMIN_RECORD_PAGE_SIZE = 20;

export async function getSuperAdminProductCategoryCounts() {
  await requireSuperAdminPageUser("/super-admin/products/categories");
  const categories = await prisma.productCategoryCatalog.findMany({
    select: {
      slug: true,
      name: true,
      _count: { select: { products: true } },
    },
    orderBy: { name: "asc" },
  });
  return categories.map((category) => ({
    category: category.slug,
    name: category.name,
    count: category._count.products,
  }));
}

function getUserFilter(path: string[], search: string) {
  const [section, view] = path;
  const isSuspended = section === "users" && view === "suspended-users";
  const isInactive = section === "users" && view === "inactive-users";
  const isArchived = section === "users" && view === "archived-users";
  const role =
    section === "merchants"
      ? UserRole.seller
      : view === "administrators"
        ? UserRole.admin
        : view === "super-administrators"
          ? UserRole.super_admin
          : view === "customers"
            ? UserRole.customer
            : view === "merchants"
              ? UserRole.seller
              : undefined;

  return {
    ...(role ? { role } : {}),
    ...(isSuspended ? { isSuspended: true } : {}),
    ...(section === "users" && !view
      ? { isActive: true, isAnonymized: false, archivedAt: null }
      : {}),
    ...(isInactive
      ? { isActive: false, isAnonymized: false, archivedAt: null }
      : {}),
    ...(isArchived
      ? { OR: [{ archivedAt: { not: null } }, { isAnonymized: true }] }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  } satisfies Prisma.UserWhereInput;
}

function getProductFilter(
  path: string[],
  search: string,
  category?: string,
) {
  const [, view] = path;
  const isPublished =
    view === "published-products"
      ? true
      : view === "draft-products"
        ? false
        : undefined;
  const stockQuantity = view === "out-of-stock" ? 0 : undefined;

  return {
    ...(isPublished === undefined ? {} : { isPublished }),
    ...(stockQuantity === undefined ? {} : { stockQuantity }),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { seller: { contains: search, mode: Prisma.QueryMode.insensitive } },
            { location: { contains: search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  } satisfies Prisma.ProductWhereInput;
}

function getOrderFilter(path: string[], search: string) {
  const [, view] = path;
  const status =
    view === "new-orders"
      ? OrderStatus.pending
      : view === "confirmed-orders"
        ? OrderStatus.confirmed
        : view === "processing-orders"
          ? OrderStatus.processing
          : view === "shipped-orders"
            ? OrderStatus.shipped
            : view === "delivered-orders"
              ? OrderStatus.delivered
              : view === "completed-orders"
                ? OrderStatus.fulfilled
                : view === "cancelled-orders"
                  ? OrderStatus.cancelled
                  : undefined;

  return {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: Prisma.QueryMode.insensitive } },
            {
              deliveryName: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              deliveryPhone: {
                contains: search,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              customer: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.OrderWhereInput;
}

export async function getSuperAdminRecordList(
  path: string[],
  search: string,
  requestedPage: number,
  title: string,
  category?: string,
  requestedPageSize = DEFAULT_SUPER_ADMIN_RECORD_PAGE_SIZE,
): Promise<SuperAdminRecordList | null> {
  await requireSuperAdminPageUser(`/super-admin/${path.join("/")}`);

  const page = Math.max(1, Math.min(500, requestedPage));
  const pageSize =
    SUPER_ADMIN_RECORD_PAGE_SIZES.find((size) => size === requestedPageSize) ??
    DEFAULT_SUPER_ADMIN_RECORD_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  if (path[0] === "merchants" && path[1] === "suspended-merchants") {
    const searchFilter = search
      ? Prisma.sql`
          AND (
            "name" ILIKE ${`%${search}%`}
            OR "email" ILIKE ${`%${search}%`}
            OR "phone" ILIKE ${`%${search}%`}
          )
        `
      : Prisma.empty;
    const [rows, total, totalUsers, totalSellers, totalAdmins, totalCustomers, suspendedSellers] =
      await prisma.$transaction([
        prisma.$queryRaw<
          { id: string; name: string; email: string; phone: string | null; role: UserRole; createdAt: Date; isSuspended: boolean; isAnonymized: boolean }[]
        >(Prisma.sql`
          SELECT "id", "name", "email", "phone", "role", "createdAt", "isSuspended", "isAnonymized"
          FROM "User"
          WHERE "role" = ${UserRole.seller}::"UserRole"
            AND "isSuspended" = true
            ${searchFilter}
          ORDER BY "createdAt" DESC
          LIMIT ${pageSize}
          OFFSET ${offset}
        `),
        prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "role" = ${UserRole.seller}::"UserRole"
            AND "isSuspended" = true
            ${searchFilter}
        `),
        prisma.user.count(),
        prisma.user.count({ where: { role: UserRole.seller } }),
        prisma.user.count({
          where: { role: { in: [UserRole.admin, UserRole.super_admin] } },
        }),
        prisma.user.count({ where: { role: UserRole.customer } }),
        prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "role" = ${UserRole.seller}::"UserRole"
            AND "isSuspended" = true
        `),
      ]);

    return {
      kind: "users",
      title,
      rows: rows.map((merchant) => ({
        id: merchant.id,
        name: merchant.name,
        summary: merchant.email,
        status: merchant.role,
        phone: merchant.phone,
        isSuspended: merchant.isSuspended,
        isAnonymized: merchant.isAnonymized,
        createdAt: merchant.createdAt,
      })),
      total: total[0]?.count ?? 0,
      page,
      pageSize,
      summary: [
        { label: "All users", value: totalUsers, href: "/super-admin/users" },
        { label: "Merchants", value: totalSellers, href: "/super-admin/users/merchants" },
        { label: "Admins", value: totalAdmins, href: "/super-admin/users/administrators" },
        { label: "Customers", value: totalCustomers, href: "/super-admin/users/customers" },
        {
          label: "Suspended users",
          value: suspendedSellers[0]?.count ?? 0,
          href: "/super-admin/users/suspended-users",
        },
      ],
    };
  }

  if (
    (path[0] === "users" &&
      [
        undefined,
        "administrators",
        "super-administrators",
        "merchants",
        "customers",
        "suspended-users",
      ].includes(path[1])) ||
    (path[0] === "merchants" && path.length === 1)
  ) {
    const where = getUserFilter(path, search);
    const [rows, total, totalUsers, totalSellers, totalAdmins, totalCustomers, suspendedSellers] =
      await prisma.$transaction([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isSuspended: true,
            isAnonymized: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip: offset,
        }),
        prisma.user.count({ where }),
        prisma.user.count(),
        prisma.user.count({ where: { role: UserRole.seller } }),
        prisma.user.count({
          where: {
            role: { in: [UserRole.admin, UserRole.super_admin] },
          },
        }),
        prisma.user.count({ where: { role: UserRole.customer } }),
        prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "User"
          WHERE "role" = ${UserRole.seller}::"UserRole"
            AND "isSuspended" = true
        `),
      ]);

    return {
      kind: "users",
      title,
      rows: rows.map((user) => ({
        id: user.id,
        name: user.name,
        summary: user.email,
        status: user.role,
        phone: user.phone,
        isSuspended: user.isSuspended,
        isAnonymized: user.isAnonymized,
        createdAt: user.createdAt,
      })),
      total,
      page,
      pageSize,
      summary: [
        { label: "All users", value: totalUsers, href: "/super-admin/users" },
        { label: "Merchants", value: totalSellers, href: "/super-admin/users/merchants" },
        { label: "Admins", value: totalAdmins, href: "/super-admin/users/administrators" },
        { label: "Customers", value: totalCustomers, href: "/super-admin/users/customers" },
        {
          label: "Suspended users",
          value: suspendedSellers[0]?.count ?? 0,
          href: "/super-admin/users/suspended-users",
        },
      ],
    };
  }

  if (
    path[0] === "products" &&
    [undefined, "published-products", "draft-products", "out-of-stock"].includes(path[1])
  ) {
    const where = getProductFilter(path, search, category);
    const [
      rows,
      total,
      totalProducts,
      publishedProducts,
      draftProducts,
      outOfStockProducts,
      categories,
    ] = await prisma.$transaction([
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
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: offset,
      }),
      prisma.product.count({ where }),
      prisma.product.count(),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({ where: { isPublished: false } }),
      prisma.product.count({ where: { stockQuantity: 0 } }),
      prisma.productCategoryCatalog.findMany({
        select: { slug: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      kind: "products",
      title,
      rows: rows.map((product) => ({
        id: product.id,
        name: product.name,
        summary: `${product.seller} · ${product.categoryInfo.name}`,
        status: product.isPublished ? "Published" : "Unpublished",
        createdAt: product.createdAt,
        image: product.image,
        value: product.price,
        currency: "RWF",
        stockQuantity: product.stockQuantity,
      })),
      total,
      page,
      pageSize,
      summary: [
        { label: "All products", value: totalProducts, href: "/super-admin/products" },
        { label: "Published", value: publishedProducts, href: "/super-admin/products/published-products" },
        { label: "Unpublished", value: draftProducts, href: "/super-admin/products/draft-products" },
        { label: "Out of stock", value: outOfStockProducts, href: "/super-admin/products/out-of-stock" },
      ],
      categories,
    };
  }

  if (
    path[0] === "orders" &&
    [
      undefined,
      "new-orders",
      "confirmed-orders",
      "processing-orders",
      "shipped-orders",
      "delivered-orders",
      "completed-orders",
      "cancelled-orders",
    ].includes(path[1])
  ) {
    const where = getOrderFilter(path, search);
    const [rows, total, totalOrders, pendingOrders, confirmedOrders, fulfilledOrders, cancelledOrders] =
      await prisma.$transaction([
        prisma.order.findMany({
          where,
          select: {
            id: true,
            status: true,
            subtotal: true,
            currency: true,
            createdAt: true,
            customer: { select: { name: true, email: true } },
            items: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip: offset,
        }),
        prisma.order.count({ where }),
        prisma.order.count(),
        prisma.order.count({ where: { status: OrderStatus.pending } }),
        prisma.order.count({ where: { status: OrderStatus.confirmed } }),
        prisma.order.count({ where: { status: OrderStatus.fulfilled } }),
        prisma.order.count({ where: { status: OrderStatus.cancelled } }),
      ]);

    return {
      kind: "orders",
      title,
      rows: rows.map((order) => ({
        id: order.id,
        name: `#${order.id.slice(-8).toUpperCase()}`,
        summary: `${order.customer.name} · ${order.customer.email}`,
        status: order.status,
        createdAt: order.createdAt,
        value: order.subtotal,
        currency: order.currency,
        itemCount: order.items.length,
      })),
      total,
      page,
      pageSize,
      summary: [
        { label: "All orders", value: totalOrders, href: "/super-admin/orders" },
        { label: "Pending", value: pendingOrders, href: "/super-admin/orders/new-orders" },
        { label: "Confirmed", value: confirmedOrders, href: "/super-admin/orders/confirmed-orders" },
        { label: "Fulfilled", value: fulfilledOrders, href: "/super-admin/orders/completed-orders" },
        { label: "Cancelled", value: cancelledOrders, href: "/super-admin/orders/cancelled-orders" },
      ],
    };
  }

  return null;
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-RW", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export async function getSuperAdminRecordDetails(
  kind: string,
  id: string,
): Promise<SuperAdminRecordDetail | null> {
  await requireSuperAdminPageUser(`/super-admin/records/${kind}/${id}`);

  if (kind === "users") {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        archivedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return null;
    const suspensionRows = await prisma.$queryRaw<
      { isSuspended: boolean; isAnonymized: boolean }[]
    >(
      Prisma.sql`SELECT "isSuspended", "isAnonymized" FROM "User" WHERE "id" = ${id}`,
    );
    const isSuspended = suspensionRows[0]?.isSuspended ?? false;
    const isAnonymized = suspensionRows[0]?.isAnonymized ?? false;
    const latestAccessEvents = await prisma.$queryRaw<
      { action: "suspended" | "reactivated"; reason: string | null; createdAt: Date }[]
    >(
      Prisma.sql`
        SELECT "action", "reason", "createdAt"
        FROM "MerchantAccessAudit"
        WHERE "targetId" = ${id}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `,
    );
    const latestAccessEvent = latestAccessEvents[0];
    return {
      kind: "users",
      id: user.id,
      title: user.name,
      subtitle: `${user.role.replace("_", " ")} · ${user.email}`,
      fields: [
        { label: "Full name", value: user.name },
        { label: "Email", value: user.email },
        { label: "Phone", value: user.phone ?? "Not provided" },
        { label: "Role", value: user.role.replace("_", " ") },
        { label: "Account access", value: isSuspended ? "Suspended" : "Active" },
        { label: "Profile state", value: isAnonymized ? "Anonymized" : "Identifiable" },
        { label: "Account state", value: isAnonymized ? "Anonymized" : user.archivedAt ? "Archived" : user.isActive ? "Active" : "Inactive" },
        { label: "Last login", value: user.lastLoginAt ? displayDate(user.lastLoginAt) : "Not recorded" },
        ...(isSuspended && latestAccessEvent?.action === "suspended"
          ? [
              {
                label: "Suspension reason",
                value: latestAccessEvent.reason ?? "No reason recorded",
              },
              {
                label: "Suspended at (UTC)",
                value: displayDate(latestAccessEvent.createdAt),
              },
            ]
          : []),
        { label: "Registered", value: displayDate(user.createdAt) },
        { label: "Last updated", value: displayDate(user.updatedAt) },
      ],
    };
  }

  if (kind === "products") {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        brand: true,
        name: true,
        nameRw: true,
        nameFr: true,
        description: true,
        warranty: true,
        specifications: true,
        returnPolicy: true,
        category: true,
        categoryInfo: { select: { name: true } },
        subcategory: { select: { name: true } },
        price: true,
        previousPrice: true,
        rating: true,
        reviewCount: true,
        badge: true,
        image: true,
        seller: true,
        location: true,
        stockQuantity: true,
        isPublished: true,
        moderationStatus: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!product) return null;
    const specifications =
      product.specifications === null
        ? null
        : productSpecificationSchema.parse(product.specifications);
    return {
      kind: "products",
      id: product.id,
      title: product.name,
      subtitle: `${product.seller} · ${product.categoryInfo.name}`,
      fields: [
        { label: "SKU", value: product.sku ?? "Not provided" },
        { label: "Brand", value: product.brand ?? "Not provided" },
        { label: "Product name", value: product.name },
        { label: "Kinyarwanda name", value: product.nameRw ?? "Not provided" },
        { label: "French name", value: product.nameFr ?? "Not provided" },
        { label: "Category", value: product.categoryInfo.name },
        { label: "Subcategory", value: product.subcategory?.name ?? "Not provided" },
        { label: "Description", value: product.description ?? "Not provided" },
        { label: "Warranty", value: product.warranty ?? "Not provided" },
        {
          label: "Specifications",
          value: specifications?.length
            ? specifications.map(({ name, value }) => `${name}: ${value}`).join("; ")
            : "Not provided",
        },
        { label: "Return policy", value: product.returnPolicy ?? "Not provided" },
        { label: "Price", value: `${product.price.toLocaleString("en-RW")} RWF` },
        {
          label: "Previous price",
          value: product.previousPrice
            ? `${product.previousPrice.toLocaleString("en-RW")} RWF`
            : "Not set",
        },
        { label: "Seller", value: product.seller },
        { label: "Location", value: product.location },
        { label: "Stock", value: String(product.stockQuantity) },
        {
          label: "Publication status",
          value: product.isPublished
            ? "Published"
            : product.moderationStatus === "pending"
              ? "Pending review"
              : product.moderationStatus === "scheduled"
                ? "Scheduled"
                : product.moderationStatus === "rejected"
                  ? "Rejected"
                  : product.moderationStatus === "hidden"
                    ? "Hidden"
                    : "Draft",
        },
        { label: "Scheduled at", value: product.scheduledAt ? displayDate(product.scheduledAt) : "Not scheduled" },
        { label: "Rating", value: `${product.rating} (${product.reviewCount} reviews)` },
        { label: "Badge", value: product.badge ?? "None" },
        { label: "Image URL", value: product.image },
        { label: "Added", value: displayDate(product.createdAt) },
        { label: "Last updated", value: displayDate(product.updatedAt) },
      ],
    };
  }

  if (kind === "orders") {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fulfillmentMethod: true,
        paymentMode: true,
        cashCollectedAt: true,
        cashCollectionReference: true,
        deliveryZone: true,
        deliveryFee: true,
        deliveryEta: true,
        pickupLocation: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddress: true,
        subtotal: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true, email: true } },
        items: {
          select: {
            productName: true,
            sellerName: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
          },
          orderBy: { createdAt: "asc" },
        },
        shipments: {
          select: {
            carrier: true,
            trackingNumber: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
            notes: true,
          },
          orderBy: { createdAt: "desc" },
        },
        refunds: {
          select: {
            id: true,
            amount: true,
            currency: true,
            reason: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        disputes: {
          select: {
            id: true,
            reason: true,
            resolution: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!order) return null;
    const fields = [
      { label: "Order ID", value: order.id },
      { label: "Status", value: order.status },
      {
        label: "Payment method",
        value: order.paymentMode ?? "Not specified",
      },
      {
        label: "Cash collection",
        value: order.cashCollectedAt
          ? displayDate(order.cashCollectedAt)
          : "Not recorded",
      },
      ...(order.cashCollectionReference
        ? [{ label: "Cash collection reference", value: order.cashCollectionReference }]
        : []),
      { label: "Customer", value: order.customer.name },
      { label: "Customer email", value: order.customer.email },
      { label: "Delivery recipient", value: order.deliveryName },
      { label: "Delivery phone", value: order.deliveryPhone },
      {
        label: order.fulfillmentMethod === "pickup" ? "Pickup location" : "Delivery address",
        value:
          order.fulfillmentMethod === "pickup"
            ? order.pickupLocation ?? "To be confirmed"
            : order.deliveryAddress,
      },
      ...(order.fulfillmentMethod === "delivery"
        ? [
            {
              label: "Delivery area",
              value:
                order.deliveryZone === "kigali"
                  ? "Kigali"
                  : order.deliveryZone === "international"
                    ? "Outside Rwanda"
                    : "Outside Kigali, within Rwanda",
            },
            { label: "Estimated delivery", value: order.deliveryEta ?? "To be confirmed" },
            {
              label: "Delivery fee",
              value: `${order.deliveryFee.toLocaleString("en-RW")} ${order.currency}`,
            },
          ]
        : []),
      {
        label: "Items",
        value:
          order.items
            .map(
              (item) =>
                `${item.productName} · ${item.sellerName} · ${item.quantity} × ${item.unitPrice.toLocaleString("en-RW")} ${order.currency} = ${item.lineTotal.toLocaleString("en-RW")} ${order.currency}`,
            )
            .join("\n") || "No items",
      },
      {
        label: "Items subtotal",
        value: `${order.subtotal.toLocaleString("en-RW")} ${order.currency}`,
      },
      {
        label: "Order total",
        value: `${(order.subtotal + order.deliveryFee).toLocaleString("en-RW")} ${order.currency}`,
      },
      {
        label: "Shipments",
        value:
          order.shipments
            .map(
              (shipment) =>
                `${shipment.carrier} · ${shipment.trackingNumber} · ${shipment.status}${shipment.notes ? ` · ${shipment.notes}` : ""}`,
            )
            .join("\n") || "No shipment record",
      },
      {
        label: "Refund requests",
        value:
          order.refunds
            .map(
              (refund) =>
                `${refund.amount.toLocaleString("en-RW")} ${refund.currency.trim()} · ${refund.status} · ${refund.reason}`,
            )
            .join("\n") || "No refund requests",
      },
      {
        label: "Disputes",
        value:
          order.disputes
            .map(
              (dispute) =>
                `${dispute.status} · ${dispute.reason}${dispute.resolution ? ` · Resolution: ${dispute.resolution}` : ""}`,
            )
            .join("\n") || "No disputes",
      },
      { label: "Placed", value: displayDate(order.createdAt) },
      { label: "Last updated", value: displayDate(order.updatedAt) },
    ];
    return {
      kind: "orders",
      id: order.id,
      title: `Order #${order.id.slice(-8).toUpperCase()}`,
      subtitle: `${order.customer.name} · ${order.status}`,
      fields,
    };
  }

  return null;
}
