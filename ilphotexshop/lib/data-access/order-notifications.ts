import "server-only";

import {
  OrderNotificationChannel,
  OrderNotificationStatus,
  Prisma,
} from "@prisma/client";
import { getOrderNotificationCopy, type OrderNotificationEvent } from "@/lib/order-notification-copy";
import type { Language } from "@/lib/marketplace-i18n";

function isEmailConfigured() {
  const port = Number(process.env.SMTP_PORT);
  return Boolean(
    process.env.SMTP_HOST &&
      Number.isInteger(port) &&
      port > 0 &&
      port <= 65535 &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.SMTP_FROM,
  );
}

function isWhatsAppConfigured() {
  return Boolean(
    process.env.WHATSAPP_WEBJS_ENABLED === "true" &&
      process.env.WHATSAPP_EXPECTED_NUMBER,
  );
}

export async function enqueueOrderNotifications(
  transaction: Prisma.TransactionClient,
  orderId: string,
  event: OrderNotificationEvent,
) {
  const order = await transaction.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      deliveryPhone: true,
      notifyByEmail: true,
      notifyByWhatsapp: true,
      notificationLanguage: true,
      customer: { select: { email: true } },
    },
  });
  if (!order) throw new Error("Cannot notify about an order that does not exist");

  const language = order.notificationLanguage as Language;
  const copy = getOrderNotificationCopy(
    event,
    language,
    order.id.slice(-8).toUpperCase(),
  );
  const now = new Date();
  const notifications: Prisma.OrderNotificationCreateManyInput[] = [
    {
      orderId,
      customerId: order.customerId,
      channel: OrderNotificationChannel.in_app,
      status: OrderNotificationStatus.sent,
      eventType: event,
      title: copy.title,
      body: copy.body,
      sentAt: now,
    },
  ];

  if (order.notifyByEmail) {
    notifications.push({
      orderId,
      customerId: order.customerId,
      channel: OrderNotificationChannel.email,
      status: order.customer.email && isEmailConfigured()
        ? OrderNotificationStatus.pending
        : OrderNotificationStatus.unavailable,
      eventType: event,
      title: copy.title,
      body: copy.body,
      recipient: order.customer.email,
      error: !order.customer.email
        ? "Customer email address is not available"
        : isEmailConfigured()
          ? null
          : "Email provider is not configured",
    });
  }

  if (order.notifyByWhatsapp) {
    notifications.push({
      orderId,
      customerId: order.customerId,
      channel: OrderNotificationChannel.whatsapp,
      status: isWhatsAppConfigured()
        ? OrderNotificationStatus.pending
        : OrderNotificationStatus.unavailable,
      eventType: event,
      title: copy.title,
      body: copy.body,
      recipient: order.deliveryPhone,
      error: isWhatsAppConfigured()
        ? null
        : "WhatsApp provider is not configured",
    });
  }

  await transaction.orderNotification.createMany({
    data: notifications,
    skipDuplicates: true,
  });
}
