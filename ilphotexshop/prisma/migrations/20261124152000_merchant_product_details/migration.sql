ALTER TYPE "ProductModerationStatus"
ADD VALUE 'scheduled';

ALTER TABLE "Product"
ADD COLUMN "sku" VARCHAR(64),
ADD COLUMN "brand" VARCHAR(120),
ADD COLUMN "description" TEXT,
ADD COLUMN "warranty" VARCHAR(1000),
ADD COLUMN "specifications" JSONB,
ADD COLUMN "returnPolicy" VARCHAR(2000);

ALTER TABLE "ProductImage"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "Product_sku_key"
ON "Product"("sku");

CREATE INDEX "Product_moderationStatus_scheduledAt_idx"
ON "Product"("moderationStatus", "scheduledAt");
