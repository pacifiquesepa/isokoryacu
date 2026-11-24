import "server-only";

import { OrderStatus, Prisma } from "@prisma/client";
import { requireSuperAdminPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { enqueueOrderNotifications } from "@/lib/data-access/order-notifications";

export const SUPER_ADMIN_ORDERS_PAGE_SIZE = 20;

export type SuperAdminOrderStatus = "all" | Lowercase<`${OrderStatus}`>;

export async function getSuperAdminOrders(
  query: string,
  status: SuperAdminOrderStatus,
  page: number,
) {
  await requireSuperAdminPageUser("/super-admin/orders");

  const safePage = Math.max(1, Math.min(page, 500));
  const statusFilter =
    status === "all"
      ? {}
      : { status: status as OrderStatus };
  const searchFilter = query
    ? {
        OR: [
          { id: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { deliveryName: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { deliveryPhone: { contains: query, mode: Prisma.QueryMode.insensitive } },
          {
            customer: {
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
              ],
            },
          },
        ],
      }
    : {};
  const where = { ...statusFilter, ...searchFilter } satisfies Prisma.OrderWhereInput;
  const offset = (safePage - 1) * SUPER_ADMIN_ORDERS_PAGE_SIZE;

  const [
    rows,
    total,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    fulfilledOrders,
    cancelledOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
  ] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        status: true,
        subtotal: true,
        currency: true,
        deliveryName: true,
        deliveryPhone: true,
        deliveryAddress: true,
        createdAt: true,
        customer: { select: { id: true, name: true, email: true } },
        items: {
          select: {
            id: true,
            productName: true,
            quantity: true,
            lineTotal: true,
            sellerName: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUPER_ADMIN_ORDERS_PAGE_SIZE,
      skip: offset,
    }),
    prisma.order.count({ where }),
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.pending } }),
    prisma.order.count({ where: { status: OrderStatus.confirmed } }),
    prisma.order.count({ where: { status: OrderStatus.fulfilled } }),
    prisma.order.count({ where: { status: OrderStatus.cancelled } }),
    prisma.order.count({ where: { status: OrderStatus.processing } }),
    prisma.order.count({ where: { status: OrderStatus.shipped } }),
    prisma.order.count({ where: { status: OrderStatus.delivered } }),
  ]);

  return {
    rows,
    total,
    page: safePage,
    pageSize: SUPER_ADMIN_ORDERS_PAGE_SIZE,
    summary: {
      totalOrders,
      pendingOrders,
      confirmedOrders,
      fulfilledOrders,
      cancelledOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
    },
  };
}

export async function createOrderShipment(
  orderId: string,
  input: { carrier: string; trackingNumber: string; status: "processing" | "shipped" | "delivered"; notes?: string },
) {
  await requireSuperAdminPageUser("/super-admin/orders");
  return prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) return null;
    const shipment = await transaction.orderShipment.create({
      data: {
        orderId,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        status: input.status,
        notes: input.notes,
        shippedAt:
          input.status === "shipped" || input.status === "delivered"
            ? new Date()
            : null,
        deliveredAt: input.status === "delivered" ? new Date() : null,
      },
    });
    await transaction.order.update({
      where: { id: orderId },
      data: { status: input.status },
    });
    await enqueueOrderNotifications(transaction, orderId, input.status);
    return shipment;
  });
}

export async function getSuperAdminRefunds(query: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/orders/returns-refund-requests");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = query
    ? { OR: [{ reason: { contains: query, mode: Prisma.QueryMode.insensitive } }, { orderId: { contains: query, mode: Prisma.QueryMode.insensitive } }] }
    : {};
  const [rows, total] = await prisma.$transaction([
    prisma.orderRefund.findMany({
      where,
      select: { id: true, orderId: true, amount: true, currency: true, reason: true, status: true, createdAt: true, refundedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUPER_ADMIN_ORDERS_PAGE_SIZE,
      skip: (safePage - 1) * SUPER_ADMIN_ORDERS_PAGE_SIZE,
    }),
    prisma.orderRefund.count({ where }),
  ]);
  return { rows, total, page: safePage, pageSize: SUPER_ADMIN_ORDERS_PAGE_SIZE };
}

export async function reviewOrderRefund(
  actorId: string,
  refundId: string,
  action: "approve" | "reject" | "refund" | "cancel",
) {
  await requireSuperAdminPageUser("/super-admin/orders/returns-refund-requests");
  const status =
    action === "approve" ? "approved" :
    action === "reject" ? "rejected" :
    action === "refund" ? "refunded" : "cancelled";
  const result = await prisma.orderRefund.updateMany({
    where: { id: refundId },
    data: {
      status,
      reviewedById: actorId,
      reviewedAt: new Date(),
      refundedAt: action === "refund" ? new Date() : null,
    },
  });
  return result.count === 1;
}

export async function getSuperAdminDisputes(query: string, page: number) {
  await requireSuperAdminPageUser("/super-admin/orders/disputes");
  const safePage = Math.max(1, Math.min(page, 500));
  const where = query
    ? { OR: [{ reason: { contains: query, mode: Prisma.QueryMode.insensitive } }, { resolution: { contains: query, mode: Prisma.QueryMode.insensitive } }, { orderId: { contains: query, mode: Prisma.QueryMode.insensitive } }] }
    : {};
  const [rows, total] = await prisma.$transaction([
    prisma.orderDispute.findMany({
      where,
      select: { id: true, orderId: true, reason: true, resolution: true, status: true, createdAt: true, resolvedAt: true, closedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUPER_ADMIN_ORDERS_PAGE_SIZE,
      skip: (safePage - 1) * SUPER_ADMIN_ORDERS_PAGE_SIZE,
    }),
    prisma.orderDispute.count({ where }),
  ]);
  return { rows, total, page: safePage, pageSize: SUPER_ADMIN_ORDERS_PAGE_SIZE };
}

export async function reviewOrderDispute(
  disputeId: string,
  action: "review" | "resolve" | "close",
  resolution?: string,
) {
  await requireSuperAdminPageUser("/super-admin/orders/disputes");
  const now = new Date();
  const result = await prisma.orderDispute.updateMany({
    where: { id: disputeId },
    data:
      action === "review"
        ? { status: "under_review" }
        : action === "resolve"
          ? { status: "resolved", resolution: resolution || null, resolvedAt: now }
          : { status: "closed", resolution: resolution || null, closedAt: now },
  });
  return result.count === 1;
}

export async function createOrderRefundRequest(
  customerId: string,
  orderId: string,
  input: { amount: number; currency: string; reason: string },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: {
      id: true,
      subtotal: true,
      deliveryFee: true,
      currency: true,
      status: true,
    },
  });
  if (!order) return null;
  if (input.currency !== order.currency.trim()) throw new Error("Refund currency must match the order");
  if (input.amount > order.subtotal + order.deliveryFee) {
    throw new Error("Refund amount cannot exceed the order total");
  }
  return prisma.orderRefund.create({
    data: {
      orderId,
      requestedById: customerId,
      amount: input.amount,
      currency: input.currency,
      reason: input.reason,
      status: "requested",
    },
  });
}

export async function createOrderDisputeRequest(
  customerId: string,
  orderId: string,
  reason: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true },
  });
  if (!order) return null;
  const existing = await prisma.orderDispute.findFirst({
    where: { orderId, status: { in: ["open", "under_review"] } },
    select: { id: true },
  });
  if (existing) throw new Error("An active dispute already exists for this order");
  return prisma.orderDispute.create({
    data: { orderId, openedById: customerId, reason, status: "open" },
  });
}
