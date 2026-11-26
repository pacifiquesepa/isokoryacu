import "server-only";

import {
  OrderNotificationChannel,
  OrderNotificationStatus,
} from "@prisma/client";
import { SMTPClient } from "emailjs";
import { prisma } from "@/lib/prisma";

class NotificationProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationProviderConfigurationError";
  }
}

function getSmtpConfiguration() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;
  const port = Number(SMTP_PORT);
  if (
    !SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !SMTP_FROM
  ) {
    throw new NotificationProviderConfigurationError(
      "SMTP email provider is not configured",
    );
  }
  return {
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE?.toLowerCase() === "true",
    user: SMTP_USER,
    password: SMTP_PASSWORD,
    from: SMTP_FROM,
  };
}

async function sendEmail(notification: {
  recipient: string | null;
  title: string;
  body: string;
  orderId: string;
}) {
  const config = getSmtpConfiguration();
  if (!notification.recipient) {
    throw new Error("Email recipient is not available");
  }
  const orderUrl = new URL(
    `/orders/${encodeURIComponent(notification.orderId)}`,
    process.env.NEXTAUTH_URL || "http://localhost:3000",
  ).toString();
  const client = new SMTPClient({
    host: config.host,
    port: config.port,
    ssl: config.secure,
    tls: !config.secure,
    user: config.user,
    password: config.password,
    timeout: 10_000,
  });
  try {
    await client.sendAsync({
      from: config.from,
      to: notification.recipient,
      subject: notification.title,
      text: `${notification.body}\n\n${orderUrl}`,
    });
  } finally {
    client.smtp.close();
  }
}

export async function dispatchOrderNotifications(
  orderId: string,
  eventType: string,
) {
  const pending = await prisma.orderNotification.findMany({
    where: {
      orderId,
      eventType,
      status: OrderNotificationStatus.pending,
      channel: {
        in: [OrderNotificationChannel.email],
      },
    },
    select: {
      id: true,
      orderId: true,
      channel: true,
      recipient: true,
      title: true,
      body: true,
    },
  });
  let sent = 0;

  for (const notification of pending) {
    try {
      if (!notification.orderId) {
        await prisma.orderNotification.update({
          where: { id: notification.id },
          data: { status: OrderNotificationStatus.failed, error: "General notification has no order to deliver" },
        });
        continue;
      }
      if (notification.channel === OrderNotificationChannel.email) {
        await sendEmail({ ...notification, orderId: notification.orderId });
      }
      await prisma.orderNotification.update({
        where: { id: notification.id },
        data: { status: OrderNotificationStatus.sent, sentAt: new Date() },
      });
      sent += 1;
    } catch (caught) {
      const isUnconfigured =
        caught instanceof NotificationProviderConfigurationError;
      const message =
        caught instanceof Error
          ? caught.message.slice(0, 500)
          : "Notification delivery failed";
      await prisma.orderNotification.update({
        where: { id: notification.id },
        data: {
          status: isUnconfigured
            ? OrderNotificationStatus.unavailable
            : OrderNotificationStatus.failed,
          error: message,
        },
      });
      console.error("Order notification delivery failed", {
        notificationId: notification.id,
        channel: notification.channel,
        error: message,
      });
    }
  }

  const undelivered = await prisma.orderNotification.findMany({
    where: {
      orderId,
      eventType,
      channel: {
        in: [OrderNotificationChannel.email, OrderNotificationChannel.whatsapp],
      },
      status: {
        in: [
          OrderNotificationStatus.failed,
          OrderNotificationStatus.unavailable,
        ],
      },
    },
    select: { status: true },
  });
  return {
    sent,
    failed: undelivered.filter(
      (notification) => notification.status === OrderNotificationStatus.failed,
    ).length,
    unavailable: undelivered.filter(
      (notification) =>
        notification.status === OrderNotificationStatus.unavailable,
    ).length,
  };
}

export async function dispatchOrderNotificationsSafely(
  orderId: string,
  eventType: string,
) {
  try {
    return {
      delivery: await dispatchOrderNotifications(orderId, eventType),
      warning: null,
    };
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Notification delivery could not be recorded";
    console.error("Could not process order notifications", {
      orderId,
      eventType,
      error: message,
    });
    return {
      delivery: null,
      warning: "Order saved, but notification delivery status could not be updated.",
    };
  }
}

export async function retryOrderNotification(id: string) {
  const result = await prisma.orderNotification.updateMany({
    where: {
      id,
      channel: {
        in: [OrderNotificationChannel.email, OrderNotificationChannel.whatsapp],
      },
      status: {
        in: [
          OrderNotificationStatus.failed,
          OrderNotificationStatus.unavailable,
        ],
      },
    },
    data: { status: OrderNotificationStatus.pending, error: null },
  });
  if (result.count !== 1) return null;

  const notification = await prisma.orderNotification.findUnique({
    where: { id },
    select: { orderId: true, eventType: true },
  });
  if (!notification?.orderId) return null;
  return dispatchOrderNotifications(
    notification.orderId,
    notification.eventType,
  );
}
