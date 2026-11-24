CREATE TYPE "DeliveryZone" AS ENUM ('kigali', 'outside_kigali', 'international');
CREATE TYPE "OrderNotificationChannel" AS ENUM ('in_app', 'email', 'whatsapp');
CREATE TYPE "OrderNotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'unavailable');

ALTER TABLE "Order"
  ADD COLUMN "deliveryZone" "DeliveryZone",
  ADD COLUMN "deliveryFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryEta" VARCHAR(120),
  ADD COLUMN "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notifyByWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "notificationLanguage" VARCHAR(2) NOT NULL DEFAULT 'en';

CREATE TABLE "DeliverySettings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "deliveryFeeRwf" INTEGER NOT NULL DEFAULT 0,
  "etaKigali" VARCHAR(120) NOT NULL DEFAULT '2h-1 day',
  "etaOutsideKigali" VARCHAR(120) NOT NULL DEFAULT '4h-2 days',
  "etaInternational" VARCHAR(120) NOT NULL DEFAULT '1-4 days',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliverySettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "DeliverySettings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP);

CREATE TABLE "OrderNotification" (
  "id" VARCHAR(100) NOT NULL,
  "orderId" VARCHAR(100) NOT NULL,
  "customerId" TEXT NOT NULL,
  "channel" "OrderNotificationChannel" NOT NULL,
  "status" "OrderNotificationStatus" NOT NULL DEFAULT 'pending',
  "eventType" VARCHAR(40) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(1000) NOT NULL,
  "recipient" VARCHAR(320),
  "error" VARCHAR(500),
  "readAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderNotification_customerId_channel_createdAt_idx"
  ON "OrderNotification"("customerId", "channel", "createdAt");
CREATE INDEX "OrderNotification_orderId_createdAt_idx"
  ON "OrderNotification"("orderId", "createdAt");
CREATE INDEX "OrderNotification_status_createdAt_idx"
  ON "OrderNotification"("status", "createdAt");
CREATE UNIQUE INDEX "OrderNotification_orderId_channel_eventType_key"
  ON "OrderNotification"("orderId", "channel", "eventType");

ALTER TABLE "OrderNotification"
  ADD CONSTRAINT "OrderNotification_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderNotification"
  ADD CONSTRAINT "OrderNotification_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
