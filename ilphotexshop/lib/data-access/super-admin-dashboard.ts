import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageUser } from "@/lib/authorization";

type DailyOrderCount = {
  day: string;
  count: number;
};

type DailyUserRegistrationCount = DailyOrderCount & {
  role: string;
};

function getDailyActivity(
  rows: DailyOrderCount[],
  firstDay: Date,
) {
  const counts = new Map(rows.map(({ day, count }) => [day, count]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setUTCDate(firstDay.getUTCDate() + index);
    return {
      day: new Intl.DateTimeFormat("en", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      count: counts.get(date.toISOString().slice(0, 10)) ?? 0,
    };
  });
}

export async function getSuperAdminDashboardData() {
  await requireSuperAdminPageUser();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const firstDay = new Date(today);
  firstDay.setUTCDate(firstDay.getUTCDate() - 6);

  const [totalUsers, totalMerchants, totalCustomers, totalProducts, publishedProducts, pendingProducts, totalOrders, pendingOrders, recentOrders, recentProducts, recentMerchants, dailyOrders, dailyUserRegistrations, pendingKycRows, recentRoleChanges, recentMerchantAccessActions, recentKycAudits, pendingPaymentProofs, recentPaymentProofs] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { role: "seller" } }),
      prisma.user.count({ where: { role: "customer" } }),
      prisma.product.count(),
      prisma.product.count({ where: { isPublished: true } }),
      prisma.product.count({ where: { moderationStatus: "pending" } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.findMany({
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
        take: 6,
      }),
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          seller: true,
          isPublished: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.user.findMany({
        where: { role: "seller" },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.$queryRaw<DailyOrderCount[]>(
        Prisma.sql`
          SELECT
            TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count
          FROM "Order"
          WHERE "createdAt" >= ${firstDay}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ),
      prisma.$queryRaw<DailyUserRegistrationCount[]>(
        Prisma.sql`
          SELECT
            TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            "role"::text AS role,
            COUNT(*)::int AS count
          FROM "User"
          WHERE "role" IN ('seller'::"UserRole", 'customer'::"UserRole")
            AND "createdAt" >= ${firstDay}
          GROUP BY 1, 2
          ORDER BY 1, 2
        `,
      ),
      prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS count
          FROM "MerchantKyc"
          WHERE "status" = 'pending'::"MerchantKycStatus"
        `,
      ),
      prisma.userRoleAudit.findMany({
        select: {
          id: true,
          previousRole: true,
          newRole: true,
          createdAt: true,
          actor: { select: { name: true } },
          target: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.merchantAccessAudit.findMany({
        select: {
          id: true,
          action: true,
          createdAt: true,
          actor: { select: { name: true } },
          target: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.merchantKycAudit.findMany({
        select: {
          id: true,
          action: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.orderPaymentProof.count({
        where: { status: "pending" },
      }),
      prisma.orderPaymentProof.findMany({
        where: { status: "pending" },
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          transactionReference: true,
          createdAt: true,
          customer: { select: { name: true, email: true } },
          order: { select: { id: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 5,
      }),
    ]);

  const orderActivity = getDailyActivity(dailyOrders, firstDay);
  const merchantActivity = getDailyActivity(
    dailyUserRegistrations.filter((row) => row.role === "seller"),
    firstDay,
  );
  const customerActivity = getDailyActivity(
    dailyUserRegistrations.filter((row) => row.role === "customer"),
    firstDay,
  );
  const securityActivities = [
    ...recentRoleChanges.map((audit) => ({
      id: `role-${audit.id}`,
      description: `Changed ${audit.target.name}'s role from ${audit.previousRole} to ${audit.newRole}`,
      actorName: audit.actor.name,
      createdAt: audit.createdAt,
      href: `/super-admin/security/audit/${encodeURIComponent(audit.id)}`,
    })),
    ...recentMerchantAccessActions.map((audit) => ({
      id: `merchant-${audit.id}`,
      description: `${audit.action === "suspended" ? "Suspended" : "Reactivated"} merchant ${audit.target.name}`,
      actorName: audit.actor.name,
      createdAt: audit.createdAt,
      href: `/super-admin/security/merchant-access/${encodeURIComponent(audit.id)}`,
    })),
    ...recentKycAudits.map((audit) => ({
      id: `kyc-${audit.id}`,
      description:
        audit.action === "approved"
          ? "Approved a merchant application"
          : audit.action === "rejected"
            ? "Declined a merchant application"
            : audit.action === "reverification_requested"
              ? "Requested merchant re-verification"
              : "Erased a merchant application",
      actorName: audit.actor.name,
      createdAt: audit.createdAt,
      href: `/super-admin/security/merchant-kyc/audit/${encodeURIComponent(audit.id)}`,
    })),
  ]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 5);

  return {
    stats: {
      totalUsers,
      totalMerchants,
      totalCustomers,
      totalProducts,
      publishedProducts,
      unpublishedProducts: totalProducts - publishedProducts,
      pendingProducts,
      totalOrders,
      pendingOrders,
      pendingPaymentProofs,
      pendingKycApplications: pendingKycRows[0]?.count ?? 0,
    },
    orderActivity,
    registrationActivity: {
      merchants: merchantActivity,
      customers: customerActivity,
    },
    recentOrders,
    recentProducts,
    recentMerchants,
    recentPaymentProofs,
    securityActivities,
  };
}
