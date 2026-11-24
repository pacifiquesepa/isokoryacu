import "server-only";

import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageUser } from "@/lib/authorization";

export async function getSuperAdminOrderNotifications() {
  await requireSuperAdminPageUser("/super-admin/communication/notifications");
  return prisma.orderNotification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      orderId: true,
      channel: true,
      status: true,
      title: true,
      recipient: true,
      error: true,
      createdAt: true,
    },
  });
}
