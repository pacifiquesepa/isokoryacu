ALTER TYPE "OrderNotificationStatus" ADD VALUE 'processing';

ALTER TABLE "OrderNotification"
ADD COLUMN "processingAt" TIMESTAMP(3);
