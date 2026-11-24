import "server-only";

import {
  MerchantFinancialChangeStatus,
  MerchantPayoutStatus,
  OrderPaymentMode,
  OrderPaymentProofStatus,
  OrderStatus,
  PaymentAccountType,
  Prisma,
  RefundStatus,
  UserRole,
} from "@prisma/client";
import type { User } from "@prisma/client";
import {
  AuthorizationDeniedError,
  requireSuperAdminPageUser,
} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import type {
  MerchantFinancialChange,
  MerchantFinancialChangeReview,
  MerchantPayoutReview,
} from "@/lib/validation/merchant-finance";

type MerchantActor = Pick<User, "id" | "role">;

const eligibleItemsWhere = (merchantId: string): Prisma.OrderItemWhereInput => ({
  sellerId: merchantId,
  order: {
    is: {
      status: OrderStatus.fulfilled,
      refunds: {
        none: {
          status: {
            in: [
              RefundStatus.requested,
              RefundStatus.approved,
              RefundStatus.refunded,
            ],
          },
        },
      },
      OR: [
        {
          paymentProofs: {
            some: { status: OrderPaymentProofStatus.approved },
          },
        },
        {
          paymentMode: OrderPaymentMode.cash_on_delivery,
          cashCollectedAt: { not: null },
        },
      ],
    },
  },
});

function assertMerchant(actor: MerchantActor) {
  if (actor.role !== UserRole.seller) throw new AuthorizationDeniedError();
}

function maskDestination(value: string) {
  const visible = value.slice(-4);
  return `${"*".repeat(Math.max(4, value.length - visible.length))}${visible}`;
}

async function getBalance(transaction: Prisma.TransactionClient, merchantId: string) {
  const where = eligibleItemsWhere(merchantId);
  const [earnings, payouts] = await Promise.all([
    transaction.orderItem.aggregate({
      where,
      _sum: {
        merchantLineTotal: true,
        platformCommissionTotal: true,
      },
    }),
    transaction.merchantPayout.groupBy({
      by: ["status"],
      where: {
        merchantId,
        status: {
          in: [MerchantPayoutStatus.requested, MerchantPayoutStatus.paid],
        },
      },
      _sum: { amount: true },
    }),
  ]);
  const paid = payouts.find((row) => row.status === MerchantPayoutStatus.paid)?._sum
    .amount ?? 0;
  const reserved = payouts.find(
    (row) => row.status === MerchantPayoutStatus.requested,
  )?._sum.amount ?? 0;
  const earned = earnings._sum.merchantLineTotal ?? 0;
  const committed = paid + reserved;
  return {
    earned,
    platformCommission: earnings._sum.platformCommissionTotal ?? 0,
    paid,
    reserved,
    available: Math.max(0, earned - committed),
    reservationsCovered: earned >= committed,
  };
}

export async function getMerchantFinanceData(actor: MerchantActor) {
  assertMerchant(actor);
  const [balance, profile, pendingChange, payouts] = await Promise.all([
    getBalance(prisma, actor.id),
    prisma.merchantFinancialProfile.findUnique({
      where: { merchantId: actor.id },
      select: {
        accountName: true,
        bankName: true,
        bankAccountNumber: true,
        mobileMoneyProvider: true,
        mobileMoneyNumber: true,
        currency: true,
        isVerified: true,
      },
    }),
    prisma.merchantFinancialChangeRequest.findFirst({
      where: { merchantId: actor.id, status: MerchantFinancialChangeStatus.pending },
      select: { id: true, requestedAt: true },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.merchantPayout.findMany({
      where: { merchantId: actor.id },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        destinationName: true,
        destinationType: true,
        destinationProvider: true,
        destinationNumber: true,
        transactionReference: true,
        reviewNote: true,
        requestedAt: true,
        processedAt: true,
      },
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: 100,
    }),
  ]);

  const destinations = profile
    ? [
        ...(profile.bankName && profile.bankAccountNumber
          ? [
              {
                type: PaymentAccountType.bank,
                provider: profile.bankName,
                maskedNumber: maskDestination(profile.bankAccountNumber),
              },
            ]
          : []),
        ...(profile.mobileMoneyProvider && profile.mobileMoneyNumber
          ? [
              {
                type: PaymentAccountType.mobile_money,
                provider: profile.mobileMoneyProvider,
                maskedNumber: maskDestination(profile.mobileMoneyNumber),
              },
            ]
          : []),
      ]
    : [];
  return {
    balance,
    profile: profile
      ? {
          accountName: profile.accountName,
          currency: profile.currency,
          isVerified: profile.isVerified,
          destinations,
        }
      : null,
    pendingChange,
    payouts: payouts.map(({ destinationNumber, ...payout }) => ({
      ...payout,
      destinationNumber: maskDestination(destinationNumber),
    })),
  };
}

export async function getMerchantFinanceSummary(actor: MerchantActor) {
  assertMerchant(actor);
  return getBalance(prisma, actor.id);
}

export class MerchantPayoutNotAvailableError extends Error {
  constructor(message = "The requested payout is not available") {
    super(message);
    this.name = "MerchantPayoutNotAvailableError";
  }
}

export class MerchantPayoutConflictError extends Error {
  constructor() {
    super("This payout request has already been processed");
    this.name = "MerchantPayoutConflictError";
  }
}

export class MerchantFinancialChangeConflictError extends Error {
  constructor() {
    super("A payout destination change is already awaiting review");
    this.name = "MerchantFinancialChangeConflictError";
  }
}

export async function createMerchantPayoutRequest(
  actor: MerchantActor,
  amount: number,
  destinationType: "bank" | "mobile_money",
) {
  assertMerchant(actor);
  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR UPDATE`,
      );
      const profile = await transaction.merchantFinancialProfile.findUnique({
        where: { merchantId: actor.id },
      });
      if (!profile || !profile.isVerified) {
        throw new MerchantPayoutNotAvailableError(
          "A verified payout account is required before requesting a payout",
        );
      }
      const destination =
        destinationType === PaymentAccountType.bank
          ? profile.bankName && profile.bankAccountNumber
            ? {
                type: PaymentAccountType.bank,
                provider: profile.bankName,
                number: profile.bankAccountNumber,
              }
            : null
          : profile.mobileMoneyProvider && profile.mobileMoneyNumber
            ? {
                type: PaymentAccountType.mobile_money,
                provider: profile.mobileMoneyProvider,
                number: profile.mobileMoneyNumber,
              }
            : null;
      if (!destination) {
        throw new MerchantPayoutNotAvailableError(
          "The selected payout destination is not available",
        );
      }
      const balance = await getBalance(transaction, actor.id);
      if (amount > balance.available) {
        throw new MerchantPayoutNotAvailableError(
          "The payout amount exceeds your available balance",
        );
      }
      return transaction.merchantPayout.create({
        data: {
          merchantId: actor.id,
          amount,
          currency: profile.currency,
          destinationName: profile.accountName,
          destinationType: destination.type,
          destinationProvider: destination.provider,
          destinationNumber: destination.number,
        },
        select: { id: true, amount: true, currency: true, status: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createMerchantFinancialChangeRequest(
  actor: MerchantActor,
  input: MerchantFinancialChange,
) {
  assertMerchant(actor);
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR UPDATE`,
    );
    const pending = await transaction.merchantFinancialChangeRequest.findFirst({
      where: {
        merchantId: actor.id,
        status: MerchantFinancialChangeStatus.pending,
      },
      select: { id: true },
    });
    if (pending) throw new MerchantFinancialChangeConflictError();
    return transaction.merchantFinancialChangeRequest.create({
      data: { merchantId: actor.id, ...input },
      select: { id: true, status: true, requestedAt: true },
    });
  });
}

export async function getSuperAdminMerchantPayouts() {
  await requireSuperAdminPageUser("/super-admin/payments/merchant-payouts");
  return prisma.merchantPayout.findMany({
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      destinationName: true,
      destinationType: true,
      destinationProvider: true,
      destinationNumber: true,
      transactionReference: true,
      reviewNote: true,
      requestedAt: true,
      processedAt: true,
      merchant: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });
}

export async function reviewMerchantPayout(
  actorId: string,
  payoutId: string,
  decision: MerchantPayoutReview,
) {
  await requireSuperAdminPageUser("/super-admin/payments/merchant-payouts");
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<
      { merchantId: string; status: MerchantPayoutStatus }[]
    >(
      Prisma.sql`
        SELECT "merchantId", "status"
        FROM "MerchantPayout"
        WHERE "id" = ${payoutId}
        FOR UPDATE
      `,
    );
    if (!rows.length) return null;
    if (rows[0].status !== MerchantPayoutStatus.requested) {
      throw new MerchantPayoutConflictError();
    }
    if (decision.action === "paid") {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${rows[0].merchantId} FOR UPDATE`,
      );
      const balance = await getBalance(transaction, rows[0].merchantId);
      if (!balance.reservationsCovered) {
        throw new MerchantPayoutNotAvailableError(
          "Current eligible earnings no longer cover this payout request",
        );
      }
    }
    return transaction.merchantPayout.update({
      where: { id: payoutId },
      data: {
        status:
          decision.action === "paid"
            ? MerchantPayoutStatus.paid
            : MerchantPayoutStatus.rejected,
        transactionReference:
          decision.action === "paid" ? decision.transactionReference : null,
        reviewNote: decision.action === "reject" ? decision.reason : null,
        reviewedById: actorId,
        processedAt: new Date(),
      },
      select: { id: true, status: true, processedAt: true },
    });
  });
}

export async function getSuperAdminFinancialChangeRequests() {
  await requireSuperAdminPageUser("/super-admin/merchants/financial-change-requests");
  return prisma.merchantFinancialChangeRequest.findMany({
    select: {
      id: true,
      accountName: true,
      bankName: true,
      bankAccountNumber: true,
      mobileMoneyProvider: true,
      mobileMoneyNumber: true,
      currency: true,
      status: true,
      reviewNote: true,
      requestedAt: true,
      reviewedAt: true,
      merchant: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });
}

export async function reviewMerchantFinancialChangeRequest(
  actorId: string,
  requestId: string,
  decision: MerchantFinancialChangeReview,
) {
  await requireSuperAdminPageUser("/super-admin/merchants/financial-change-requests");
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<
      { merchantId: string; status: MerchantFinancialChangeStatus }[]
    >(
      Prisma.sql`
        SELECT "merchantId", "status"
        FROM "MerchantFinancialChangeRequest"
        WHERE "id" = ${requestId}
        FOR UPDATE
      `,
    );
    const request = rows[0];
    if (!request) return null;
    if (request.status !== MerchantFinancialChangeStatus.pending) {
      throw new MerchantPayoutConflictError();
    }
    const fields = await transaction.merchantFinancialChangeRequest.findUniqueOrThrow({
      where: { id: requestId },
      select: {
        accountName: true,
        bankName: true,
        bankAccountNumber: true,
        mobileMoneyProvider: true,
        mobileMoneyNumber: true,
        currency: true,
      },
    });
    const approved = decision.action === "approve";
    await transaction.merchantFinancialChangeRequest.update({
      where: { id: requestId },
      data: {
        status: approved
          ? MerchantFinancialChangeStatus.approved
          : MerchantFinancialChangeStatus.rejected,
        reviewNote: approved ? null : decision.reason,
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    if (approved) {
      await transaction.merchantFinancialProfile.upsert({
        where: { merchantId: request.merchantId },
        create: {
          merchantId: request.merchantId,
          ...fields,
          isVerified: true,
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
        update: {
          ...fields,
          isVerified: true,
          verifiedById: actorId,
          verifiedAt: new Date(),
        },
      });
    }
    return { id: requestId, status: approved ? "approved" : "rejected" };
  });
}
