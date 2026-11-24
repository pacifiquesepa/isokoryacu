import "server-only";

import { createHash } from "node:crypto";
import {
  OrderPaymentProofStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultDeliverySettings } from "@/lib/data-access/delivery-settings";
import { enqueueOrderNotifications } from "@/lib/data-access/order-notifications";
import { getCommissionBreakdown } from "@/lib/commerce/pricing";
import {
  InsufficientProductStockError,
  recordOrderSale,
  reverseOrderSale,
} from "@/lib/data-access/inventory";
import type {
  CreateOrderInput,
  ListOrdersQuery,
} from "@/lib/validation/orders";

const orderItemFields = {
  id: true,
  productId: true,
  productName: true,
  productImage: true,
  sellerName: true,
  unitPrice: true,
  quantity: true,
  lineTotal: true,
} as const;

const customerOrderFields = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  paymentMode: true,
  cashCollectedAt: true,
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
  items: {
    select: orderItemFields,
    orderBy: { createdAt: "asc" as const },
  },
  paymentProofs: {
    select: {
      id: true,
      method: true,
      amount: true,
      currency: true,
      status: true,
      transactionReference: true,
      documentName: true,
      reviewReason: true,
      createdAt: true,
      reviewedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

const customerOrderDetailFields = {
  ...customerOrderFields,
  shipments: {
    select: {
      id: true,
      carrier: true,
      trackingNumber: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      notes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  notifications: {
    where: { channel: "in_app" as const },
    select: {
      id: true,
      title: true,
      body: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const adminOrderFields = {
  ...customerOrderFields,
  paymentProofs: false,
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const idempotentOrderFields = {
  ...customerOrderFields,
  requestHash: true,
} as const;

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["fulfilled"],
  fulfilled: [],
  cancelled: [],
};

const maxOrderSubtotal = 2_147_483_647;

export class OrderInventoryUnavailableError extends Error {
  constructor() {
    super("One or more products are unavailable or have insufficient stock");
    this.name = "OrderInventoryUnavailableError";
  }
}

export class OrderSubtotalTooLargeError extends Error {
  constructor() {
    super("Order subtotal exceeds the supported amount");
    this.name = "OrderSubtotalTooLargeError";
  }
}

export class IdempotencyKeyReuseError extends Error {
  constructor() {
    super("Idempotency key was already used for a different order");
    this.name = "IdempotencyKeyReuseError";
  }
}

export class OrderStatusConflictError extends Error {
  constructor() {
    super("Order status cannot be changed to the requested state");
    this.name = "OrderStatusConflictError";
  }
}

export class OrderPaymentProofConflictError extends OrderStatusConflictError {
  constructor(
    message = "An order with a payment proof awaiting review or approved cannot be cancelled",
  ) {
    super();
    this.message = message;
    this.name = "OrderPaymentProofConflictError";
  }
}

export class CashCollectionConflictError extends Error {
  constructor() {
    super("Cash collection can only be recorded once for an active cash-on-delivery order");
    this.name = "CashCollectionConflictError";
  }
}

function isPrismaError(
  error: unknown,
  code: "P2002" | "P2034",
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function hashOrderInput(input: CreateOrderInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function findExistingOrder(
  customerId: string,
  idempotencyKey: string,
  requestHash: string,
) {
  const existing = await prisma.order.findUnique({
    where: {
      customerId_idempotencyKey: { customerId, idempotencyKey },
    },
    select: idempotentOrderFields,
  });
  if (!existing) return null;
  const { requestHash: storedHash, ...order } = existing;
  if (storedHash !== requestHash) {
    throw new IdempotencyKeyReuseError();
  }

  return { order, replayed: true };
}

export async function createCustomerOrder(
  customerId: string,
  idempotencyKey: string,
  input: CreateOrderInput,
) {
  const requestHash = hashOrderInput(input);
  const existing = await findExistingOrder(
    customerId,
    idempotencyKey,
    requestHash,
  );
  if (existing) return existing;

  try {
    const order = await prisma.$transaction(
      async (transaction) => {
        const duplicate = await transaction.order.findUnique({
          where: {
            customerId_idempotencyKey: { customerId, idempotencyKey },
          },
          select: idempotentOrderFields,
        });
        if (duplicate) {
          const { requestHash: storedHash, ...previousOrder } = duplicate;
          if (storedHash !== requestHash) {
            throw new IdempotencyKeyReuseError();
          }
          return { order: previousOrder, replayed: true };
        }

        const products = await transaction.product.findMany({
          where: {
            id: { in: input.items.map((item) => item.productId) },
            isPublished: true,
          },
          select: {
            id: true,
            name: true,
            image: true,
            seller: true,
            ownerId: true,
            price: true,
            stockQuantity: true,
            updatedAt: true,
            categoryInfo: { select: { commissionBasisPoints: true } },
            subcategory: { select: { commissionBasisPoints: true } },
          },
        });
        if (products.length !== input.items.length) {
          throw new OrderInventoryUnavailableError();
        }

        const productsById = new Map(products.map((product) => [product.id, product]));
        const pricingByProduct = new Map(
          products.map((product) => [
            product.id,
            getCommissionBreakdown(
              product.price,
              product.categoryInfo.commissionBasisPoints,
              product.subcategory?.commissionBasisPoints ?? null,
            ),
          ]),
        );
        const subtotal = input.items.reduce((total, item) => {
          const product = productsById.get(item.productId);
          if (!product || product.stockQuantity < item.quantity) {
            throw new OrderInventoryUnavailableError();
          }
          const pricing = pricingByProduct.get(product.id);
          if (!pricing) throw new OrderInventoryUnavailableError();
          return total + pricing.customerPrice * item.quantity;
        }, 0);
        if (!Number.isSafeInteger(subtotal) || subtotal > maxOrderSubtotal) {
          throw new OrderSubtotalTooLargeError();
        }
        const deliverySettings =
          input.fulfillmentMethod === "delivery"
            ? await transaction.deliverySettings.findUnique({
                where: { id: "default" },
                select: {
                  deliveryFeeRwf: true,
                  etaKigali: true,
                  etaOutsideKigali: true,
                  etaInternational: true,
                },
              })
            : null;
        const deliveryFee =
          input.fulfillmentMethod === "delivery"
            ? deliverySettings?.deliveryFeeRwf ??
              defaultDeliverySettings.deliveryFeeRwf
            : 0;
        const deliveryEta =
          input.fulfillmentMethod === "delivery"
            ? input.deliveryZone === "kigali"
              ? deliverySettings?.etaKigali ?? defaultDeliverySettings.etaKigali
              : input.deliveryZone === "international"
                ? deliverySettings?.etaInternational ??
                  defaultDeliverySettings.etaInternational
                : deliverySettings?.etaOutsideKigali ??
                  defaultDeliverySettings.etaOutsideKigali
            : null;
        if (subtotal + deliveryFee > maxOrderSubtotal) {
          throw new OrderSubtotalTooLargeError();
        }

        let discountAmount = 0;
        let couponId: string | null = null;
        if (input.couponCode) {
          const coupon = await transaction.coupon.findUnique({
            where: { code: input.couponCode },
            select: {
              id: true,
              discountType: true,
              discountValue: true,
              minimumSubtotal: true,
              maximumDiscount: true,
              usageLimit: true,
              perUserLimit: true,
              startsAt: true,
              endsAt: true,
              status: true,
              _count: { select: { redemptions: true } },
            },
          });
          const now = new Date();
          if (
            !coupon ||
            coupon.status === "cancelled" ||
            coupon.status === "ended" ||
            coupon.status !== "active" ||
            coupon.startsAt > now ||
            coupon.endsAt < now ||
            subtotal < coupon.minimumSubtotal
          ) {
            throw new Error("Coupon is invalid or not active");
          }
          if (coupon.usageLimit !== null && coupon._count.redemptions >= coupon.usageLimit) {
            throw new Error("Coupon usage limit has been reached");
          }
          const userRedemptions = await transaction.couponRedemption.count({
            where: { couponId: coupon.id, userId: customerId },
          });
          if (userRedemptions >= coupon.perUserLimit) {
            throw new Error("Coupon usage limit for this account has been reached");
          }
          discountAmount =
            coupon.discountType === "percentage"
              ? Math.floor((subtotal * coupon.discountValue) / 100)
              : coupon.discountValue;
          if (coupon.maximumDiscount !== null) {
            discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
          }
          discountAmount = Math.min(discountAmount, subtotal);
          couponId = coupon.id;
        }


        const createdOrder = await transaction.order.create({
          data: {
            customerId,
            idempotencyKey,
            requestHash,
            fulfillmentMethod: input.fulfillmentMethod,
            paymentMode: input.paymentMode,
            deliveryZone: input.deliveryZone ?? null,
            deliveryFee,
            deliveryEta,
            notifyByEmail: input.notifyByEmail,
            notifyByWhatsapp: input.notifyByWhatsapp,
            notificationLanguage: input.notificationLanguage,
            pickupLocation: input.pickupLocation ?? null,
            deliveryLatitude: input.deliveryLatitude ?? null,
            deliveryLongitude: input.deliveryLongitude ?? null,
            deliveryName: input.deliveryName,
            deliveryPhone: input.deliveryPhone,
            deliveryAddress: input.deliveryAddress,
            subtotal,
            items: {
              create: input.items.map((item) => {
                const product = productsById.get(item.productId);
                if (!product) throw new OrderInventoryUnavailableError();
                const pricing = pricingByProduct.get(product.id);
                if (!pricing) throw new OrderInventoryUnavailableError();

                return {
                  productId: product.id,
                  sellerId: product.ownerId,
                  productName: product.name,
                  productImage: product.image,
                  sellerName: product.seller,
                  unitPrice: pricing.customerPrice,
                  quantity: item.quantity,
                  lineTotal: pricing.customerPrice * item.quantity,
                  merchantUnitPrice: pricing.basePrice,
                  platformCommissionUnit: pricing.commissionAmount,
                  merchantLineTotal: pricing.basePrice * item.quantity,
                  platformCommissionTotal:
                    pricing.commissionAmount * item.quantity,
                };
              }),
            },
          },
          select: customerOrderFields,
        });
        if (couponId && discountAmount > 0) {
          await transaction.couponRedemption.create({
            data: {
              couponId,
              userId: customerId,
              orderId: createdOrder.id,
              discountAmount,
              currency: createdOrder.currency,
            },
          });
        }
        await enqueueOrderNotifications(transaction, createdOrder.id, "placed");
        return { order: createdOrder, replayed: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return order;
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const duplicate = await findExistingOrder(
        customerId,
        idempotencyKey,
        requestHash,
      );
      if (duplicate) return duplicate;
    }
    if (isPrismaError(error, "P2034")) {
      const duplicate = await findExistingOrder(
        customerId,
        idempotencyKey,
        requestHash,
      );
      if (duplicate) return duplicate;
      throw new OrderInventoryUnavailableError();
    }
    throw error;
  }
}

export async function getCustomerOrders(
  customerId: string,
  query: ListOrdersQuery,
) {
  const where = {
    customerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: customerOrderFields,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total };
}

export async function getCustomerDashboardSummary(customerId: string) {
  const monthRangeStart = new Date();
  monthRangeStart.setUTCDate(1);
  monthRangeStart.setUTCHours(0, 0, 0, 0);
  monthRangeStart.setUTCMonth(monthRangeStart.getUTCMonth() - 5);
  const [statusCounts, receiptsInReview, recentOrders, monthlyOrders] =
    await prisma.$transaction([
    prisma.order.groupBy({
      by: ["status"],
      where: { customerId },
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),
    prisma.orderPaymentProof.count({
      where: {
        customerId,
        status: OrderPaymentProofStatus.pending,
      },
    }),
    prisma.order.findMany({
      where: { customerId },
      select: {
        id: true,
        status: true,
        fulfillmentMethod: true,
        subtotal: true,
        deliveryFee: true,
        currency: true,
        createdAt: true,
        items: {
          select: { id: true, productName: true, quantity: true },
          orderBy: { createdAt: "asc" },
          take: 2,
        },
        _count: { select: { items: true } },
        paymentProofs: {
          select: { status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.$queryRaw<{ month: string; count: number }[]>(
      Prisma.sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS "month",
          COUNT(*)::int AS "count"
        FROM "Order"
        WHERE "customerId" = ${customerId}
          AND "createdAt" >= ${monthRangeStart}
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,
    ),
  ]);
  const countForEntry = (entry: (typeof statusCounts)[number]) =>
    typeof entry._count === "object" && entry._count !== null
      ? entry._count._all ?? 0
      : 0;
  const countForStatus = (status: OrderStatus) => {
    const entry = statusCounts.find((item) => item.status === status);
    return entry ? countForEntry(entry) : 0;
  };

  return {
    totalOrders: statusCounts.reduce(
      (sum, entry) => sum + countForEntry(entry),
      0,
    ),
    inProgressOrders: [
      OrderStatus.pending,
      OrderStatus.confirmed,
      OrderStatus.processing,
      OrderStatus.shipped,
    ].reduce((sum, status) => sum + countForStatus(status), 0),
    completedOrders:
      countForStatus(OrderStatus.delivered) +
      countForStatus(OrderStatus.fulfilled),
    receiptsInReview,
    statusBreakdown: statusCounts.map((entry) => ({
      status: entry.status,
      count: countForEntry(entry),
    })),
    monthlyOrders,
    recentOrders,
  };
}

export async function getCustomerOrder(customerId: string, id: string) {
  return prisma.order.findFirst({
    where: { id, customerId },
    select: customerOrderDetailFields,
  });
}

export async function cancelCustomerOrder(customerId: string, id: string) {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const orderRows = await transaction.$queryRaw<
          { status: OrderStatus }[]
        >(
          Prisma.sql`
            SELECT "status"
            FROM "Order"
            WHERE "id" = ${id} AND "customerId" = ${customerId}
            FOR UPDATE
          `,
        );
        const orderState = orderRows[0];
        if (!orderState) return null;
        const order = await transaction.order.findUnique({
          where: { id },
          select: {
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                productName: true,
                quantity: true,
              },
            },
          },
        });
        if (!order || orderState.status !== OrderStatus.pending) {
          throw new OrderStatusConflictError();
        }
        const approvedPayment = await transaction.orderPaymentProof.findFirst({
          where: {
            orderId: id,
            status: {
              in: [
                OrderPaymentProofStatus.pending,
                OrderPaymentProofStatus.approved,
              ],
            },
          },
          select: { id: true },
        });
        if (approvedPayment) throw new OrderPaymentProofConflictError();

        const updated = await transaction.order.updateMany({
          where: { id, customerId, status: OrderStatus.pending },
          data: { status: OrderStatus.cancelled },
        });
        if (updated.count !== 1) throw new OrderStatusConflictError();

        await reverseOrderSale(transaction, id, order.items, customerId);
        await enqueueOrderNotifications(transaction, id, OrderStatus.cancelled);
        return transaction.order.findUnique({
          where: { id },
          select: customerOrderFields,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      throw new OrderStatusConflictError();
    }
    throw error;
  }
}

export async function getAdminOrders(query: ListOrdersQuery) {
  const where = query.status ? { status: query.status } : {};
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      select: adminOrderFields,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.order.count({ where }),
  ]);
  return { orders, total };
}

export async function updateOrderStatusAsAdmin(
  id: string,
  nextStatus: OrderStatus,
  actorId?: string,
) {
  try {
    return await prisma.$transaction(
      async (transaction) => {
        const orderRows = await transaction.$queryRaw<
          { status: OrderStatus }[]
        >(
          Prisma.sql`
            SELECT "status"
            FROM "Order"
            WHERE "id" = ${id}
            FOR UPDATE
          `,
        );
        const orderState = orderRows[0];
        if (!orderState) return null;
        const order = await transaction.order.findUnique({
          where: { id },
          select: {
            status: true,
            items: {
              select: {
                id: true,
                productId: true,
                productName: true,
                quantity: true,
              },
            },
          },
        });
        if (!order) return null;
        if (orderState.status === nextStatus) {
          return transaction.order.findUnique({
            where: { id },
            select: adminOrderFields,
          });
        }

        if (nextStatus === OrderStatus.cancelled) {
          const approvedPayment = await transaction.orderPaymentProof.findFirst({
            where: {
              orderId: id,
              status: {
                in: [
                  OrderPaymentProofStatus.pending,
                  OrderPaymentProofStatus.approved,
                ],
              },
            },
            select: { id: true },
          });
          if (approvedPayment) throw new OrderPaymentProofConflictError();
        }
        if (nextStatus === OrderStatus.confirmed) {
          const pendingProof = await transaction.orderPaymentProof.findFirst({
            where: {
              orderId: id,
              status: OrderPaymentProofStatus.pending,
            },
            select: { id: true },
          });
          if (pendingProof) {
            throw new OrderPaymentProofConflictError(
              "Review or reject the pending payment proof before confirming the order",
            );
          }
        }

        if (!allowedTransitions[orderState.status].includes(nextStatus)) {
          throw new OrderStatusConflictError();
        }
        if (nextStatus === OrderStatus.confirmed) {
          const approvedPaymentProof = await transaction.orderPaymentProof.findFirst({
            where: {
              orderId: id,
              status: OrderPaymentProofStatus.approved,
            },
            select: { id: true },
          });
          if (!approvedPaymentProof) {
            try {
              await recordOrderSale(transaction, id, order.items, actorId ?? null);
            } catch (error) {
              if (error instanceof InsufficientProductStockError) {
                throw new OrderStatusConflictError();
              }
              throw error;
            }
          }
        }

        const updated = await transaction.order.updateMany({
          where: { id, status: orderState.status },
          data: { status: nextStatus },
        });
        if (updated.count !== 1) throw new OrderStatusConflictError();

        if (nextStatus === OrderStatus.cancelled) {
          await reverseOrderSale(transaction, id, order.items, actorId ?? null);
        }

        await enqueueOrderNotifications(transaction, id, nextStatus);
        return transaction.order.findUnique({
          where: { id },
          select: adminOrderFields,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2034")) {
      throw new OrderStatusConflictError();
    }
    throw error;
  }
}

export async function recordOrderCashCollection(
  orderId: string,
  actorId: string,
  reference?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const orders = await transaction.$queryRaw<
      {
        paymentMode: "receipt" | "cash_on_delivery" | null;
        status: OrderStatus;
        cashCollectedAt: Date | null;
      }[]
    >(
      Prisma.sql`
        SELECT "paymentMode", "status", "cashCollectedAt"
        FROM "Order"
        WHERE "id" = ${orderId}
        FOR UPDATE
      `,
    );
    const order = orders[0];
    if (!order) return null;
    if (
      order.paymentMode !== "cash_on_delivery" ||
      order.status === OrderStatus.cancelled ||
      order.cashCollectedAt
    ) {
      throw new CashCollectionConflictError();
    }
    return transaction.order.update({
      where: { id: orderId },
      data: {
        cashCollectedAt: new Date(),
        cashCollectedById: actorId,
        cashCollectionReference: reference ?? null,
      },
      select: {
        id: true,
        paymentMode: true,
        cashCollectedAt: true,
        cashCollectionReference: true,
      },
    });
  });
}
