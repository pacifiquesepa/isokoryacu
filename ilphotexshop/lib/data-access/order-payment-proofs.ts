import "server-only";

import {
  OrderPaymentProofStatus,
  OrderStatus,
  PaymentAccountType,
  PaymentProofMethod,
  Prisma,
  type UserRole,
} from "@prisma/client";
import {
  AuthorizationDeniedError,
  requireSuperAdminPageUser,
  requireUserRole,
} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  InsufficientProductStockError,
  recordOrderSale,
} from "@/lib/data-access/inventory";
import type { PaymentProofDocument } from "@/lib/http/payment-proof-upload";
import type {
  PaymentProofReview,
  PaymentProofSubmission,
} from "@/lib/validation/payment-proofs";

export class PaymentProofConflictError extends Error {
  constructor(message = "A payment proof is already awaiting review or approved") {
    super(message);
    this.name = "PaymentProofConflictError";
  }
}

export class OrderNotPayableError extends Error {
  constructor() {
    super("Only pending orders can receive payment proofs");
    this.name = "OrderNotPayableError";
  }
}

export class PaymentMethodUnavailableError extends Error {
  constructor() {
    super("This payment method has no active destination account");
    this.name = "PaymentMethodUnavailableError";
  }
}

export class PaymentProofReviewConflictError extends Error {
  constructor() {
    super("This payment proof is no longer awaiting review");
    this.name = "PaymentProofReviewConflictError";
  }
}

export type PaymentProofQueueStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "all";

export async function getSuperAdminPaymentOverview() {
  await requireSuperAdminPageUser("/super-admin/payments");
  const [
    totalProofs,
    pendingProofs,
    approvedProofs,
    rejectedProofs,
    approvedAmounts,
    bankTransferCount,
    mobileMoneyCount,
  ] = await prisma.$transaction([
    prisma.orderPaymentProof.count(),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.pending },
    }),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.approved },
    }),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.rejected },
    }),
    prisma.orderPaymentProof.groupBy({
      by: ["currency"],
      where: { status: OrderPaymentProofStatus.approved },
      _sum: { amount: true },
      orderBy: { currency: "asc" },
    }),
    prisma.orderPaymentProof.count({
      where: { method: PaymentProofMethod.bank_transfer },
    }),
    prisma.orderPaymentProof.count({
      where: { method: PaymentProofMethod.mobile_money },
    }),
  ]);
  return {
    totalProofs,
    pendingProofs,
    approvedProofs,
    rejectedProofs,
    approvedAmounts: approvedAmounts.map((entry) => ({
      currency: entry.currency.trim(),
      amount: entry._sum?.amount ?? 0,
    })),
    methods: [
      { method: PaymentProofMethod.bank_transfer, count: bankTransferCount },
      { method: PaymentProofMethod.mobile_money, count: mobileMoneyCount },
    ].filter((entry) => entry.count > 0),
  };
}

export async function getActivePaymentAccounts() {
  const customer = await requireUserRole("customer");
  if (!customer) throw new AuthorizationDeniedError();
  return prisma.superAdminPaymentAccount.findMany({
    where: { isActive: true },
    select: {
      id: true,
      type: true,
      provider: true,
      accountName: true,
      accountNumber: true,
      currency: true,
    },
    orderBy: [{ type: "asc" }, { provider: "asc" }],
  });
}

export async function getCustomerPaymentProofs(
  customerId: string,
  status: OrderPaymentProofStatus | undefined,
  offset: number,
  limit: number,
) {
  const where: Prisma.OrderPaymentProofWhereInput = {
    customerId,
    ...(status ? { status } : {}),
  };
  const [rows, total, pending, approved, rejected] = await prisma.$transaction([
    prisma.orderPaymentProof.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        transactionReference: true,
        status: true,
        createdAt: true,
        order: { select: { id: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.orderPaymentProof.count({ where }),
    prisma.orderPaymentProof.count({
      where: { customerId, status: OrderPaymentProofStatus.pending },
    }),
    prisma.orderPaymentProof.count({
      where: { customerId, status: OrderPaymentProofStatus.approved },
    }),
    prisma.orderPaymentProof.count({
      where: { customerId, status: OrderPaymentProofStatus.rejected },
    }),
  ]);
  return { rows, total, pending, approved, rejected };
}

export async function getCustomerPaymentProof(
  customerId: string,
  proofId: string,
) {
  return prisma.orderPaymentProof.findFirst({
    where: { id: proofId, customerId },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      transactionReference: true,
      documentName: true,
      status: true,
      reviewReason: true,
      createdAt: true,
      reviewedAt: true,
      order: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          subtotal: true,
          deliveryFee: true,
          currency: true,
        },
      },
    },
  });
}

export async function getCustomerPaymentProofDocument(
  customerId: string,
  orderId: string,
  proofId: string,
) {
  return prisma.orderPaymentProof.findFirst({
    where: { id: proofId, orderId, customerId },
    select: {
      document: true,
      documentName: true,
      documentMimeType: true,
    },
  });
}

export async function submitOrderPaymentProof(
  customerId: string,
  orderId: string,
  input: PaymentProofSubmission,
  document: PaymentProofDocument,
) {
  return prisma.$transaction(async (transaction) => {
    const orders = await transaction.$queryRaw<
      { subtotal: number; deliveryFee: number; currency: string; status: OrderStatus }[]
    >(
      Prisma.sql`
        SELECT "subtotal", "deliveryFee", "currency", "status"
        FROM "Order"
        WHERE "id" = ${orderId} AND "customerId" = ${customerId}
        FOR UPDATE
      `,
    );
    const order = orders[0];
    if (!order) return null;
    if (order.status !== OrderStatus.pending) throw new OrderNotPayableError();

    const accountType =
      input.method === "bank_transfer"
        ? PaymentAccountType.bank
        : PaymentAccountType.mobile_money;
    const activeAccount = await transaction.superAdminPaymentAccount.findFirst({
      where: { type: accountType, isActive: true },
      select: { id: true },
    });
    if (!activeAccount) throw new PaymentMethodUnavailableError();

    const existing = await transaction.orderPaymentProof.findFirst({
      where: {
        orderId,
        status: {
          in: [OrderPaymentProofStatus.pending, OrderPaymentProofStatus.approved],
        },
      },
      select: { id: true },
    });
    if (existing) throw new PaymentProofConflictError();

    return transaction.orderPaymentProof.create({
      data: {
        orderId,
        customerId,
        amount: order.subtotal + order.deliveryFee,
        currency: order.currency,
        method:
          input.method === "bank_transfer"
            ? PaymentProofMethod.bank_transfer
            : PaymentProofMethod.mobile_money,
        transactionReference: input.transactionReference,
        document: new Uint8Array(document.bytes),
        documentName: document.fileName,
        documentMimeType: document.mimeType,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        status: true,
        createdAt: true,
      },
    });
  });
}

export async function getSuperAdminPaymentProofQueue(
  status: PaymentProofQueueStatus,
  offset = 0,
) {
  await requireSuperAdminPageUser("/super-admin/payments/payment-proofs");
  const where =
    status === "all"
      ? {}
      : {
          status:
            status === "pending"
              ? OrderPaymentProofStatus.pending
              : status === "approved"
                ? OrderPaymentProofStatus.approved
                : OrderPaymentProofStatus.rejected,
        };
  const [rows, total, pending, approved, rejected] = await prisma.$transaction([
    prisma.orderPaymentProof.findMany({
      where,
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        transactionReference: true,
        documentName: true,
        status: true,
        reviewReason: true,
        createdAt: true,
        customer: { select: { name: true, email: true } },
        order: {
          select: {
            id: true,
            status: true,
            subtotal: true,
            deliveryFee: true,
            currency: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      skip: offset,
    }),
    prisma.orderPaymentProof.count({ where }),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.pending },
    }),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.approved },
    }),
    prisma.orderPaymentProof.count({
      where: { status: OrderPaymentProofStatus.rejected },
    }),
  ]);
  return { rows, total, pending, approved, rejected };
}

export async function reviewOrderPaymentProof(
  actorId: string,
  proofId: string,
  decision: PaymentProofReview,
) {
  return prisma.$transaction(async (transaction) => {
    const actors = await transaction.$queryRaw<{ role: UserRole }[]>(
      Prisma.sql`SELECT "role" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`,
    );
    const role = actors[0]?.role;
    if (!role) {
      throw new AuthorizationDeniedError();
    }

    const proofReferences = await transaction.$queryRaw<{ orderId: string }[]>(
      Prisma.sql`
        SELECT "orderId"
        FROM "OrderPaymentProof"
        WHERE "id" = ${proofId}
      `,
    );
    const proofReference = proofReferences[0];
    if (!proofReference) return null;
    if (role !== "super_admin" && role !== "admin") {
      const sellerItems = await transaction.$queryRaw<{ count: number }[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "OrderItem"
          WHERE "orderId" = ${proofReference.orderId}
            AND "sellerId" = ${actorId}
        `,
      );
      if (!sellerItems[0]?.count) {
        throw new AuthorizationDeniedError();
      }
    }
    const orderRows = await transaction.$queryRaw<{ status: OrderStatus }[]>(
      Prisma.sql`
        SELECT "status"
        FROM "Order"
        WHERE "id" = ${proofReference.orderId}
        FOR UPDATE
      `,
    );
    const proofRows = await transaction.$queryRaw<
      { orderId: string; status: OrderPaymentProofStatus }[]
    >(
      Prisma.sql`
        SELECT "orderId", "status"
        FROM "OrderPaymentProof"
        WHERE "id" = ${proofId}
        FOR UPDATE
      `,
    );
    const proof = proofRows[0];
    if (!proof) return null;
    if (
      proof.status !== OrderPaymentProofStatus.pending ||
      orderRows[0]?.status !== OrderStatus.pending
    ) {
      throw new PaymentProofReviewConflictError();
    }

    const result = await transaction.orderPaymentProof.updateMany({
      where: { id: proofId, status: OrderPaymentProofStatus.pending },
      data: {
        status:
          decision.action === "approve"
            ? OrderPaymentProofStatus.approved
            : OrderPaymentProofStatus.rejected,
        reviewReason: decision.action === "reject" ? decision.reason : null,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    if (result.count !== 1) throw new PaymentProofReviewConflictError();
    if (decision.action === "approve") {
      const items = await transaction.orderItem.findMany({
        where: { orderId: proofReference.orderId },
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
        },
      });
      try {
        await recordOrderSale(
          transaction,
          proofReference.orderId,
          items,
          actorId,
        );
      } catch (error) {
        if (error instanceof InsufficientProductStockError) {
          throw new PaymentProofReviewConflictError();
        }
        throw error;
      }
    }
    return transaction.orderPaymentProof.findUnique({
      where: { id: proofId },
      select: { id: true, status: true, reviewedAt: true },
    });
  });
}

export async function getSuperAdminPaymentProofDocument(id: string) {
  await requireSuperAdminPageUser("/super-admin/payments/payment-proofs");
  return prisma.orderPaymentProof.findUnique({
    where: { id },
    select: {
      document: true,
      documentName: true,
      documentMimeType: true,
    },
  });
}
