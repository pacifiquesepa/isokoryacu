import path from "node:path";
import qrcode from "qrcode-terminal";
import whatsapp from "whatsapp-web.js";
import { PrismaClient } from "@prisma/client";

const { Client, LocalAuth } = whatsapp;

const prisma = new PrismaClient();
const expectedSender = normalizePhone(process.env.WHATSAPP_EXPECTED_NUMBER || "");
const sessionPath = path.resolve(
  process.env.WHATSAPP_WEBJS_SESSION_PATH || ".wwebjs_auth",
);
const clientId = process.env.WHATSAPP_WEBJS_CLIENT_ID || "isokoryacu-orders";
const browserPath = process.env.WHATSAPP_BROWSER_PATH;
const pollIntervalMs = 5000;
const staleProcessingMs = 10 * 60 * 1000;

if (process.env.WHATSAPP_WEBJS_ENABLED !== "true") {
  console.error("Set WHATSAPP_WEBJS_ENABLED=true to start the WhatsApp worker.");
  process.exit(1);
}

if (!expectedSender) {
  console.error("Set a valid WHATSAPP_EXPECTED_NUMBER before starting the worker.");
  process.exit(1);
}

function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `250${digits.slice(1)}`;
  } else if (digits.length === 9) {
    digits = `250${digits}`;
  }
  return digits.length >= 7 && digits.length <= 15 ? digits : "";
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId, dataPath: sessionPath }),
  puppeteer: {
    headless: true,
    ...(browserPath ? { executablePath: browserPath } : {}),
  },
});

let ready = false;
let shuttingDown = false;
let queueTimer;

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  if (queueTimer) clearTimeout(queueTimer);
  try {
    await client.destroy();
  } catch {
    // The browser may already have exited.
  }
  await prisma.$disconnect();
  process.exitCode = exitCode;
}

function orderUrl(orderId) {
  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) throw new Error("NEXTAUTH_URL is not configured");
  return new URL(`/orders/${encodeURIComponent(orderId)}`, baseUrl).toString();
}

async function sendPendingNotification() {
  const notification = await prisma.orderNotification.findFirst({
    where: {
      channel: "whatsapp",
      status: "pending",
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderId: true,
      recipient: true,
      title: true,
      body: true,
    },
  });
  if (!notification) return false;

  const claimed = await prisma.orderNotification.updateMany({
    where: { id: notification.id, status: "pending" },
    data: {
      status: "processing",
      processingAt: new Date(),
      error: null,
    },
  });
  if (claimed.count !== 1) return true;

  try {
    if (!notification.recipient) {
      throw new Error("Customer phone number is not available");
    }
    const recipient = normalizePhone(notification.recipient);
    if (!recipient) throw new Error("Customer phone number is invalid");
    const recipientId = await client.getNumberId(recipient);
    if (!recipientId) {
      throw new Error("Customer phone number is not registered on WhatsApp");
    }
    await client.sendMessage(
      recipientId._serialized,
      `${notification.title}\n${notification.body}\n\n${orderUrl(notification.orderId)}`,
    );
    await prisma.orderNotification.update({
      where: { id: notification.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        processingAt: null,
        error: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "WhatsApp send failed";
    await prisma.orderNotification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        processingAt: null,
        error: message,
      },
    });
    console.error("WhatsApp order notification failed", {
      notificationId: notification.id,
      error: message,
    });
  }
  return true;
}

async function pollQueue() {
  if (!ready || shuttingDown) return;
  try {
    await sendPendingNotification();
  } catch (error) {
    console.error(
      "WhatsApp notification queue could not be processed",
      error instanceof Error ? error.message : "Unknown worker error",
    );
  } finally {
    if (ready && !shuttingDown) {
      queueTimer = setTimeout(pollQueue, pollIntervalMs);
    }
  }
}

client.on("qr", (qr) => {
  console.log("Scan this QR code using the WhatsApp account configured as the sender:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("WhatsApp Web authentication completed.");
});

client.on("auth_failure", () => {
  console.error("WhatsApp authentication failed. Restart the worker and pair again.");
  void shutdown(1);
});

client.on("ready", async () => {
  const loggedInSender = normalizePhone(client.info?.wid?.user || "");
  if (!loggedInSender || loggedInSender !== expectedSender) {
    console.error("The paired WhatsApp account does not match WHATSAPP_EXPECTED_NUMBER.");
    try {
      await client.logout();
    } catch {
      // The session may not be fully initialized.
    }
    await shutdown(1);
    return;
  }

  ready = true;
  console.log("WhatsApp Web worker is ready and the sender account was verified.");
  await prisma.orderNotification.updateMany({
    where: {
      channel: "whatsapp",
      status: "processing",
      processingAt: { lt: new Date(Date.now() - staleProcessingMs) },
    },
    data: {
      status: "pending",
      processingAt: null,
      error: "Recovered an interrupted send; the message may be retried.",
    },
  });
  void pollQueue();
});

client.on("disconnected", (reason) => {
  if (shuttingDown) return;
  console.error("WhatsApp Web disconnected", String(reason).slice(0, 200));
  void shutdown(1);
});

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

client.initialize().catch((error) => {
  console.error(
    "Could not initialize WhatsApp Web",
    error instanceof Error ? error.message : "Unknown browser error",
  );
  void shutdown(1);
});
