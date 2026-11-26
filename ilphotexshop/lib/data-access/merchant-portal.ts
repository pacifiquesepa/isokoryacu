import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMerchantPageUser } from "@/lib/authorization";

export async function getMerchantCustomers() {
  const merchant = await requireMerchantPageUser("/merchant/customers");
  const rows = await prisma.order.findMany({
    where: { items: { some: { sellerId: merchant.id } } },
    select: {
      id: true,
      customerId: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true, phone: true } },
      items: {
        where: { sellerId: merchant.id },
        select: { quantity: true, merchantLineTotal: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const customers = new Map<string, {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    orders: number;
    units: number;
    purchases: number;
    lastPurchase: Date;
  }>();
  for (const order of rows) {
    const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const purchases = order.items.reduce((sum, item) => sum + item.merchantLineTotal, 0);
    const current = customers.get(order.customerId);
    if (current) {
      current.orders += 1;
      current.units += units;
      current.purchases += purchases;
      if (order.createdAt > current.lastPurchase) current.lastPurchase = order.createdAt;
    } else {
      customers.set(order.customerId, {
        id: order.customer.id,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        orders: 1,
        units,
        purchases,
        lastPurchase: order.createdAt,
      });
    }
  }
  return [...customers.values()].sort(
    (a, b) => b.lastPurchase.getTime() - a.lastPurchase.getTime(),
  );
}

export async function getMerchantPromotionData() {
  const merchant = await requireMerchantPageUser("/merchant/promotions");
  const [featured, activeBanners, coupons, campaigns] = await prisma.$transaction([
    prisma.featuredMerchant.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.homepageBanner.count({
      where: {
        status: "active",
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    }),
    prisma.coupon.count({
      where: {
        status: { in: ["active", "scheduled"] },
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
      },
    }),
    prisma.marketingCampaign.count({
      where: { status: { in: ["active", "scheduled"] } },
    }),
  ]);
  return { merchant, featured, activeBanners, coupons, campaigns };
}

export async function getMerchantCommunicationData() {
  const merchant = await requireMerchantPageUser("/merchant/messages");
  const conversations = await prisma.communicationConversation.findMany({
    where: { participantIds: { has: merchant.id } },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const participantIds = [
    ...new Set(conversations.flatMap((row) => row.participantIds)),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));
  return {
    conversations: conversations.map((conversation) => ({
      ...conversation,
      participants: conversation.participantIds
        .map((id) => userMap.get(id))
        .filter((user): user is (typeof users)[number] => Boolean(user)),
    })),
  };
}

export async function getMerchantSupportTickets() {
  const merchant = await requireMerchantPageUser("/merchant/support");
  return prisma.supportTicket.findMany({
    where: {
      OR: [
        { requesterId: merchant.id },
        { assignedToId: merchant.id },
        { subject: { contains: merchant.name, mode: Prisma.QueryMode.insensitive } },
      ],
    },
    include: { _count: { select: { messages: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getMerchantConversationDetail(conversationId: string) {
  const merchant = await requireMerchantPageUser("/merchant/messages");
  const conversation = await prisma.communicationConversation.findFirst({
    where: { id: conversationId, participantIds: { has: merchant.id } },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  if (!conversation) return null;
  const senderIds = [...new Set(conversation.messages.map((message) => message.senderId))];
  const participants = await prisma.user.findMany({
    where: { id: { in: [...new Set([...conversation.participantIds, ...senderIds])] } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(participants.map((participant) => [participant.id, participant]));
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      sender: userMap.get(message.senderId) ?? null,
    })),
  };
}

export async function addMerchantConversationMessage(conversationId: string, body: string) {
  const merchant = await requireMerchantPageUser("/merchant/messages");
  const conversation = await prisma.communicationConversation.findFirst({
    where: { id: conversationId, participantIds: { has: merchant.id }, status: "open" },
    select: { id: true },
  });
  if (!conversation) return null;
  const now = new Date();
  return prisma.$transaction(async (transaction) => {
    await transaction.communicationMessage.create({
      data: { conversationId: conversation.id, senderId: merchant.id, body },
    });
    await transaction.communicationConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });
  });
}

export async function getMerchantSupportTicketDetail(ticketId: string) {
  const merchant = await requireMerchantPageUser("/merchant/support");
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      OR: [{ requesterId: merchant.id }, { assignedToId: merchant.id }],
    },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
  });
  if (!ticket) return null;
  const ids = [
    ...new Set([
      ...ticket.messages.map((message) => message.senderId),
      ...(ticket.requesterId ? [ticket.requesterId] : []),
      ...(ticket.assignedToId ? [ticket.assignedToId] : []),
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((user) => [user.id, user]));
  return {
    ...ticket,
    messages: ticket.messages.map((message) => ({
      ...message,
      sender: userMap.get(message.senderId) ?? null,
    })),
  };
}

export async function getMerchantAuditData() {
  const merchant = await requireMerchantPageUser("/merchant/audit");
  const [staffChanges, staffAudits, accessChanges, loginEvents, sessions, stockMovements, payoutRequests] =
    await prisma.$transaction([
      prisma.merchantStaff.findMany({
        where: { merchantId: merchant.id },
        select: {
          id: true,
          role: true,
          status: true,
          updatedAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.merchantStaffAudit.findMany({
        where: { merchantId: merchant.id },
        select: {
          id: true,
          action: true,
          detail: true,
          success: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
          target: { select: { name: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      }),
      prisma.merchantAccessAudit.findMany({
        where: { targetId: merchant.id },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.loginEvent.findMany({
        where: { userId: merchant.id },
        select: { id: true, outcome: true, reason: true, ipAddress: true, deviceName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.securitySession.findMany({
        where: { userId: merchant.id },
        select: { id: true, deviceName: true, ipAddress: true, isRevoked: true, lastSeenAt: true, expiresAt: true },
        orderBy: { lastSeenAt: "desc" },
        take: 50,
      }),
      prisma.productStockMovement.findMany({
        where: { product: { is: { ownerId: merchant.id } } },
        select: { id: true, productName: true, type: true, quantityChange: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.merchantPayout.findMany({
        where: { merchantId: merchant.id },
        select: { id: true, amount: true, status: true, requestedAt: true, processedAt: true },
        orderBy: { requestedAt: "desc" },
        take: 100,
      }),
    ]);
  return { staffChanges, staffAudits, accessChanges, loginEvents, sessions, stockMovements, payoutRequests };
}
